import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function findUserByEmail(admin: ReturnType<typeof createClient>, email: string) {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const found = data.users.find((user) => user.email?.toLowerCase() === email);
    if (found) return found;
    if (data.users.length < 1000) return null;
  }
  throw new Error("No fue posible verificar si la cuenta ya existe");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authHeader = req.headers.get("Authorization") || "";

  try {
    const caller = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: authData, error: authError } = await caller.auth.getUser();
    if (authError || !authData.user) return json({ error: "Sesión inválida" }, 401);

    const { data: staff } = await caller
      .from("acredita_memberships")
      .select("role")
      .eq("profile_id", authData.user.id)
      .eq("is_active", true)
      .limit(1);
    if (!staff?.length) return json({ error: "Solo el equipo Acredita puede otorgar accesos Mandante" }, 403);

    const body = await req.json();
    const mandanteId = String(body?.mandante_id || "");
    const email = String(body?.email || "").trim().toLowerCase();
    const fullName = String(body?.full_name || "").trim();
    if (!/^[0-9a-f-]{36}$/i.test(mandanteId)) throw new Error("Mandante inválido");
    if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 320) throw new Error("Correo inválido");
    if (fullName.length < 2 || fullName.length > 160) throw new Error("Nombre inválido");

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: mandante, error: mandanteError } = await admin
      .from("mandantes")
      .select("id,name,is_active")
      .eq("id", mandanteId)
      .eq("is_active", true)
      .single();
    if (mandanteError || !mandante) throw new Error("El Mandante no existe o está inactivo");

    let user = await findUserByEmail(admin, email);
    let invited = false;

    if (user) {
      const [{ data: staffMembership }, { data: contractorMemberships }, { data: mandanteMemberships }] = await Promise.all([
        admin.from("acredita_memberships").select("id").eq("profile_id", user.id).eq("is_active", true).limit(1),
        admin.from("contratista_memberships").select("id").eq("profile_id", user.id).eq("is_active", true).limit(1),
        admin.from("mandante_memberships").select("id,mandante_id,role").eq("profile_id", user.id).eq("is_active", true),
      ]);
      if (staffMembership?.length || contractorMemberships?.length) {
        return json({ error: "Ese correo ya pertenece a un rol incompatible. Usa un correo distinto para este acceso Mandante." }, 409);
      }
      if ((mandanteMemberships || []).some((membership) => membership.mandante_id !== mandanteId)) {
        return json({ error: "Ese correo ya tiene acceso a otra organización Mandante. Usa una cuenta separada para evitar ambigüedad." }, 409);
      }
    } else {
      const redirectTo = "https://acredita-frontend.vercel.app/recuperar";
      const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
        redirectTo,
        data: { full_name: fullName },
      });
      if (error || !data.user) throw error || new Error("No fue posible crear la invitación");
      user = data.user;
      invited = true;
    }

    const { error: profileError } = await admin.from("profiles").upsert({
      id: user.id,
      full_name: fullName,
      is_active: true,
      updated_at: new Date().toISOString(),
    });
    if (profileError) throw profileError;

    const { error: membershipError } = await admin.from("mandante_memberships").upsert({
      profile_id: user.id,
      mandante_id: mandanteId,
      role: "mandante_admin",
      is_active: true,
    }, { onConflict: "profile_id,mandante_id,role" });
    if (membershipError) throw membershipError;

    return json({
      ok: true,
      invited,
      existing_user: !invited,
      mandante: mandante.name,
      email,
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "No fue posible otorgar el acceso Mandante" }, 400);
  }
});
