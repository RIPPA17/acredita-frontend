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

function normalizeRut(value: string) {
  return value.replace(/[^0-9kK]/g, "").toUpperCase();
}

function validRut(value: string) {
  const clean = normalizeRut(value);
  if (!/^\d{7,8}[0-9K]$/.test(clean)) return false;
  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);
  let sum = 0;
  let multiplier = 2;
  for (let index = body.length - 1; index >= 0; index -= 1) {
    sum += Number(body[index]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }
  const raw = 11 - (sum % 11);
  const expected = raw === 11 ? "0" : raw === 10 ? "K" : String(raw);
  return expected === dv;
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

  let createdContractorId: string | null = null;
  let invitedUserId: string | null = null;

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
    if (!staff?.length) return json({ error: "Solo Administración de Acredita puede crear contratistas" }, 403);

    const body = await req.json();
    const companyName = String(body?.company_name || "").trim();
    const rut = String(body?.rut || "").trim();
    const fullName = String(body?.full_name || "").trim();
    const email = String(body?.email || "").trim().toLowerCase();
    const phone = String(body?.phone || "").trim();

    if (companyName.length < 2 || companyName.length > 200) throw new Error("Nombre de empresa inválido");
    if (!validRut(rut)) throw new Error("RUT inválido");
    if (fullName.length < 2 || fullName.length > 160) throw new Error("Nombre del responsable inválido");
    if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 320) throw new Error("Correo inválido");
    if (phone.length > 40) throw new Error("Teléfono inválido");

    const admin = createClient(supabaseUrl, serviceKey);
    const normalizedRut = normalizeRut(rut);

    const { data: contractorRows, error: contractorLookupError } = await admin
      .from("contratistas")
      .select("id,name,rut,integration_key,is_active,primary_contact_email");
    if (contractorLookupError) throw contractorLookupError;

    const legacyContractor = (contractorRows || []).find(
      (item) => normalizeRut(item.rut || "") === normalizedRut,
    ) || null;

    if (legacyContractor?.primary_contact_email?.trim()) {
      return json({ error: `Ya existe un contratista habilitado con ese RUT: ${legacyContractor.name}.` }, 409);
    }

    let user = await findUserByEmail(admin, email);
    if (user) {
      const [{ data: staffMembership }, { data: mandanteMembership }, { data: contractorMemberships }] = await Promise.all([
        admin.from("acredita_memberships").select("id").eq("profile_id", user.id).eq("is_active", true).limit(1),
        admin.from("mandante_memberships").select("id").eq("profile_id", user.id).eq("is_active", true).limit(1),
        admin.from("contratista_memberships").select("id,contratista_id").eq("profile_id", user.id).eq("is_active", true),
      ]);
      if (staffMembership?.length || mandanteMembership?.length) {
        return json({ error: "Ese correo ya pertenece a un rol incompatible. Usa otro correo para el responsable del contratista." }, 409);
      }
      const incompatibleContractor = (contractorMemberships || []).some(
        (membership) => !legacyContractor || membership.contratista_id !== legacyContractor.id,
      );
      if (incompatibleContractor) {
        return json({ error: "Ese correo ya está asociado a otro contratista." }, 409);
      }
    }

    let contractor: { id: string; name: string; rut: string | null; integration_key: string };
    const existingContractor = Boolean(legacyContractor);

    if (legacyContractor) {
      const integrationKey = legacyContractor.integration_key
        || `contratista_${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`;
      contractor = {
        id: legacyContractor.id,
        name: legacyContractor.name,
        rut: legacyContractor.rut,
        integration_key: integrationKey,
      };
    } else {
      const integrationKey = `contratista_${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`;
      const { data, error } = await admin
        .from("contratistas")
        .insert({
          name: companyName,
          legal_name: companyName,
          rut,
          is_active: true,
          integration_key: integrationKey,
          data_environment: "production",
          primary_contact_name: fullName,
          primary_contact_email: email,
          primary_contact_phone: phone || null,
        })
        .select("id,name,rut,integration_key")
        .single();
      if (error || !data) {
        if (error?.code === "23505") throw new Error("Ya existe un contratista con ese RUT.");
        throw error || new Error("No fue posible crear el contratista");
      }
      contractor = data;
      createdContractorId = contractor.id;
    }

    let invited = false;
    if (!user) {
      const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
        redirectTo: "https://acredita-frontend.vercel.app/recuperar",
        data: { full_name: fullName },
      });
      if (error || !data.user) throw error || new Error("No fue posible crear la invitación de acceso");
      user = data.user;
      invitedUserId = user.id;
      invited = true;
    }

    const { error: profileError } = await admin.from("profiles").upsert({
      id: user.id,
      full_name: fullName,
      phone: phone || null,
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

    if (legacyContractor) {
      const { error: updateError } = await admin
        .from("contratistas")
        .update({
          is_active: true,
          integration_key: contractor.integration_key,
          primary_contact_name: fullName,
          primary_contact_email: email,
          primary_contact_phone: phone || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", contractor.id);
      if (updateError) throw updateError;
    }

    const { error: auditError } = await admin.from("audit_logs").insert({
      actor_profile_id: authData.user.id,
      action: existingContractor ? "habilitacion_contratista" : "creacion_contratista",
      entity_type: "contratista",
      entity_id: contractor.id,
      details: {
        integration_key: contractor.integration_key,
        company_name: contractor.name,
        rut: contractor.rut,
        responsible_email: email,
        access_invited: invited,
        existing_contractor: existingContractor,
      },
    });
    if (auditError) throw auditError;

    return json({
      ok: true,
      contractor,
      responsible: { full_name: fullName, email, phone: phone || null },
      invited,
      existing_user: !invited,
      existing_contractor: existingContractor,
    });
  } catch (error) {
    try {
      const admin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
      if (createdContractorId) await admin.from("contratistas").delete().eq("id", createdContractorId);
      if (invitedUserId) await admin.auth.admin.deleteUser(invitedUserId);
    } catch {
      // Conserva el error original.
    }
    return json({ error: error instanceof Error ? error.message : "No fue posible crear el contratista" }, 400);
  }
});
