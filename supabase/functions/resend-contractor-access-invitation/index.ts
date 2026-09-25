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

async function findUserByEmail(admin: ReturnType<typeof createClient>, targetEmail: string) {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const found = data.users.find((user) => user.email?.toLowerCase() === targetEmail);
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

  let invitedUserId: string | null = null;

  try {
    const caller = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: authData, error: authError } = await caller.auth.getUser();
    if (authError || !authData.user) return json({ error: "Sesión inválida" }, 401);

    const { data: staff, error: staffError } = await caller
      .from("acredita_memberships")
      .select("role")
      .eq("profile_id", authData.user.id)
      .eq("role", "admin_acredita")
      .eq("is_active", true)
      .limit(1);
    if (staffError) throw staffError;
    if (!staff?.length) return json({ error: "Solo Administración Acredita puede reenviar invitaciones de acceso" }, 403);

    const body = await req.json();
    const contractorId = String(body?.contractor_id || "").trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(contractorId)) {
      throw new Error("Contratista inválido");
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: contractor, error: contractorError } = await admin
      .from("contratistas")
      .select("id,name,platform_admin_name,platform_admin_email,platform_admin_phone")
      .eq("id", contractorId)
      .eq("is_active", true)
      .single();
    if (contractorError || !contractor) throw new Error("No se encontró el contratista");

    const adminEmail = String(contractor.platform_admin_email || "").trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(adminEmail)) throw new Error("El contratista no tiene un correo de administrador válido");

    let user = await findUserByEmail(admin, adminEmail);
    if (user) {
      const [{ data: staffMembership }, { data: mandanteMembership }, { data: contractorMemberships }] = await Promise.all([
        admin.from("acredita_memberships").select("id").eq("profile_id", user.id).eq("is_active", true).limit(1),
        admin.from("mandante_memberships").select("id").eq("profile_id", user.id).eq("is_active", true).limit(1),
        admin.from("contratista_memberships").select("id,contratista_id").eq("profile_id", user.id).eq("is_active", true),
      ]);
      if (staffMembership?.length || mandanteMembership?.length) {
        return json({ error: "Ese correo ya pertenece a un rol incompatible." }, 409);
      }
      const incompatibleContractor = (contractorMemberships || []).some(
        (membership) => membership.contratista_id !== contractor.id,
      );
      if (incompatibleContractor) {
        return json({ error: "Ese correo ya está asociado a otro contratista." }, 409);
      }
    }

    let invited = false;
    if (!user) {
      const { data, error } = await admin.auth.admin.inviteUserByEmail(adminEmail, {
        redirectTo: "https://acredita-frontend.vercel.app/recuperar",
        data: { full_name: contractor.platform_admin_name || contractor.name },
      });
      if (error || !data.user) throw error || new Error("No fue posible enviar la invitación de acceso");
      user = data.user;
      invitedUserId = user.id;
      invited = true;
    }

    const { error: profileError } = await admin.from("profiles").upsert({
      id: user.id,
      full_name: contractor.platform_admin_name || contractor.name,
      phone: contractor.platform_admin_phone || null,
      is_active: true,
      updated_at: new Date().toISOString(),
    });
    if (profileError) throw profileError;

    const { error: membershipError } = await admin.from("contratista_memberships").upsert({
      profile_id: user.id,
      contratista_id: contractor.id,
      role: "contratista_admin",
      is_active: true,
    }, { onConflict: "profile_id,contratista_id,role" });
    if (membershipError) throw membershipError;

    await admin.from("audit_logs").insert({
      actor_profile_id: authData.user.id,
      action: invited ? "reenvio_invitacion_acceso_contratista" : "vinculacion_administrador_contratista",
      entity_type: "contratista",
      entity_id: contractor.id,
      details: {
        administrator_email: adminEmail,
        access_invited: invited,
      },
    });

    return json({ ok: true, invited, linked: true });
  } catch (error) {
    if (invitedUserId) {
      try {
        const admin = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        );
        await admin.auth.admin.deleteUser(invitedUserId);
      } catch {
        // Conserva el error original.
      }
    }
    return json({ error: error instanceof Error ? error.message : "No fue posible reenviar la invitación" }, 400);
  }
});
