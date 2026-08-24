import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function toHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const body = await req.json();
    const token = String(body?.token || "");
    const password = String(body?.password || "");
    const fullName = String(body?.full_name || "").trim();
    if (!/^[a-f0-9]{64}$/i.test(token)) throw new Error("Invitación inválida");
    if (password.length < 8) throw new Error("La contraseña debe tener al menos 8 caracteres");
    if (fullName.length < 2 || fullName.length > 120) throw new Error("Nombre inválido");

    const tokenHash = toHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)));
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: invitation, error: invError } = await admin
      .from("invitations")
      .select("id,invited_email,status,expires_at")
      .eq("token_hash", tokenHash)
      .single();
    if (invError || !invitation) throw new Error("Invitación inválida");
    if (invitation.status !== "pending") throw new Error("La invitación ya no está disponible");
    if (invitation.expires_at && new Date(invitation.expires_at).getTime() <= Date.now()) throw new Error("La invitación venció");
    if (!invitation.invited_email) throw new Error("Invitación sin correo asociado");

    const { data, error } = await admin.auth.admin.createUser({
      email: invitation.invited_email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (error) {
      const message = error.message.toLowerCase();
      if (message.includes("already") || message.includes("registered") || message.includes("exists")) {
        return new Response(JSON.stringify({ error: "ACCOUNT_EXISTS" }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      throw error;
    }

    return new Response(JSON.stringify({ ok: true, user_id: data.user?.id || null }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "No fue posible crear la cuenta" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
