import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authHeader = req.headers.get("Authorization") || "";

  try {
    const body = await req.json();
    const invitationId = String(body?.invitation_id || "");
    const token = String(body?.token || "");
    if (!invitationId || !/^[a-f0-9]{64}$/i.test(token)) throw new Error("Invitación inválida");

    const caller = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: invitation, error: readError } = await caller
      .from("invitations")
      .select("id,invited_email,status,expires_at")
      .eq("id", invitationId)
      .single();
    if (readError || !invitation) throw new Error("No tienes permisos para enviar esta invitación");
    if (invitation.status !== "pending") throw new Error("La invitación ya no está pendiente");
    if (invitation.expires_at && new Date(invitation.expires_at).getTime() <= Date.now()) throw new Error("La invitación venció");
    if (!invitation.invited_email) throw new Error("La invitación no tiene correo");

    const redirectTo = `https://acredita-frontend.vercel.app/invitacion?token=${encodeURIComponent(token)}`;
    const admin = createClient(supabaseUrl, serviceKey);

    let sentMode = "invite";
    const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(invitation.invited_email, { redirectTo });
    if (inviteError) {
      const publicClient = createClient(supabaseUrl, anonKey);
      const { error: otpError } = await publicClient.auth.signInWithOtp({
        email: invitation.invited_email,
        options: { shouldCreateUser: false, emailRedirectTo: redirectTo },
      });
      if (otpError) throw otpError;
      sentMode = "magiclink";
    }

    await caller.from("invitations").update({ sent_at: new Date().toISOString(), send_error: null }).eq("id", invitationId);
    return new Response(JSON.stringify({ ok: true, mode: sentMode }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "No fue posible enviar la invitación" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
