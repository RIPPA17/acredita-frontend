import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const COMPANY_TYPES = new Set(["spa", "ltda", "sa", "eirl", "persona_natural", "otra"]);
const OCCUPATIONAL_INSURERS = new Set(["achs", "mutual_seguridad", "ist", "isl", "otro", "no_aplica"]);

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

function email(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function required(value: unknown, label: string, max = 200) {
  const text = String(value || "").trim();
  if (text.length < 2 || text.length > max) throw new Error(`${label} inválido`);
  return text;
}

function optional(value: unknown, max = 250) {
  const text = String(value || "").trim();
  if (!text) return null;
  if (text.length > max) throw new Error("Uno de los campos ingresados es demasiado largo");
  return text;
}

function validEmail(value: string) {
  return /^\S+@\S+\.\S+$/.test(value) && value.length <= 320;
}

function normalizeWebsite(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const parsed = new URL(candidate);
    if (!["http:", "https:"].includes(parsed.protocol)) throw new Error();
    return parsed.toString();
  } catch {
    throw new Error("Sitio web inválido");
  }
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

    const companyName = required(body?.company_name, "Nombre comercial");
    const legalName = required(body?.legal_name, "Razón social");
    const rut = required(body?.rut, "RUT", 20);
    if (!validRut(rut)) throw new Error("RUT de empresa inválido");

    const companyType = String(body?.company_type || "").trim();
    if (!COMPANY_TYPES.has(companyType)) throw new Error("Tipo de empresa inválido");

    const businessActivity = required(body?.business_activity, "Actividad principal", 250);
    const siiActivityCode = optional(body?.sii_activity_code, 40);
    const companyEmail = email(body?.company_email);
    if (!validEmail(companyEmail)) throw new Error("Correo general de la empresa inválido");
    const companyPhone = required(body?.company_phone, "Teléfono de la empresa", 40);
    const website = normalizeWebsite(body?.website);

    const country = required(body?.country || "Chile", "País", 100);
    const region = required(body?.region, "Región", 120);
    const commune = required(body?.commune, "Comuna", 120);
    const address = required(body?.address, "Dirección", 300);

    const legalRepresentativeName = required(body?.legal_representative_name, "Nombre del representante legal", 160);
    const legalRepresentativeRut = required(body?.legal_representative_rut, "RUT del representante legal", 20);
    if (!validRut(legalRepresentativeRut)) throw new Error("RUT del representante legal inválido");
    const legalRepresentativeEmail = email(body?.legal_representative_email);
    if (!validEmail(legalRepresentativeEmail)) throw new Error("Correo del representante legal inválido");
    const legalRepresentativePhone = required(body?.legal_representative_phone, "Teléfono del representante legal", 40);

    const adminFullName = required(body?.admin_full_name, "Nombre del administrador Acredita", 160);
    const adminRut = required(body?.admin_rut, "RUT del administrador Acredita", 20);
    if (!validRut(adminRut)) throw new Error("RUT del administrador Acredita inválido");
    const adminEmail = email(body?.admin_email);
    if (!validEmail(adminEmail)) throw new Error("Correo del administrador Acredita inválido");
    const adminPhone = required(body?.admin_phone, "Teléfono del administrador Acredita", 40);

    const occupationalInsurer = String(body?.occupational_insurer || "").trim();
    if (!OCCUPATIONAL_INSURERS.has(occupationalInsurer)) throw new Error("Organismo administrador de la Ley 16.744 inválido");
    const compensationFund = optional(body?.compensation_fund, 120);

    const employeeCountRaw = body?.employee_count;
    const employeeCount = employeeCountRaw === null || employeeCountRaw === undefined || employeeCountRaw === ""
      ? null
      : Number(employeeCountRaw);
    if (employeeCount !== null && (!Number.isInteger(employeeCount) || employeeCount < 0 || employeeCount > 1_000_000)) {
      throw new Error("Dotación aproximada inválida");
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const normalizedRut = normalizeRut(rut);

    const { data: contractorRows, error: contractorLookupError } = await admin
      .from("contratistas")
      .select("id,name,rut,integration_key,is_active,primary_contact_email,master_data_version");
    if (contractorLookupError) throw contractorLookupError;

    const legacyContractor = (contractorRows || []).find(
      (item) => normalizeRut(item.rut || "") === normalizedRut,
    ) || null;

    if (legacyContractor && Number(legacyContractor.master_data_version || 1) >= 2) {
      return json({ error: `Ya existe un contratista completo con ese RUT: ${legacyContractor.name}.` }, 409);
    }
    if (
      legacyContractor?.primary_contact_email?.trim()
      && legacyContractor.primary_contact_email.trim().toLowerCase() !== adminEmail
    ) {
      return json({ error: "Ese RUT ya existe con otro administrador registrado. Edita la empresa existente en vez de crearla nuevamente." }, 409);
    }

    let user = await findUserByEmail(admin, adminEmail);
    if (user) {
      const [{ data: staffMembership }, { data: mandanteMembership }, { data: contractorMemberships }] = await Promise.all([
        admin.from("acredita_memberships").select("id").eq("profile_id", user.id).eq("is_active", true).limit(1),
        admin.from("mandante_memberships").select("id").eq("profile_id", user.id).eq("is_active", true).limit(1),
        admin.from("contratista_memberships").select("id,contratista_id").eq("profile_id", user.id).eq("is_active", true),
      ]);
      if (staffMembership?.length || mandanteMembership?.length) {
        return json({ error: "Ese correo ya pertenece a un rol incompatible. Usa otro correo para el administrador del contratista." }, 409);
      }
      const incompatibleContractor = (contractorMemberships || []).some(
        (membership) => !legacyContractor || membership.contratista_id !== legacyContractor.id,
      );
      if (incompatibleContractor) {
        return json({ error: "Ese correo ya está asociado a otro contratista." }, 409);
      }
    }

    let invited = false;
    if (!user) {
      const { data, error } = await admin.auth.admin.inviteUserByEmail(adminEmail, {
        redirectTo: "https://acredita-frontend.vercel.app/recuperar",
        data: { full_name: adminFullName },
      });
      if (error || !data.user) throw error || new Error("No fue posible crear la invitación de acceso");
      user = data.user;
      invitedUserId = user.id;
      invited = true;
    }

    const integrationKey = legacyContractor?.integration_key
      || `contratista_${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`;

    const contractorPayload = {
      name: companyName,
      legal_name: legalName,
      rut,
      is_active: true,
      integration_key: integrationKey,
      data_environment: "production",
      address,
      company_type: companyType,
      business_activity: businessActivity,
      sii_activity_code: siiActivityCode,
      company_email: companyEmail,
      company_phone: companyPhone,
      website,
      country,
      region,
      commune,
      legal_representative_name: legalRepresentativeName,
      legal_representative_rut: legalRepresentativeRut,
      legal_representative_email: legalRepresentativeEmail,
      legal_representative_phone: legalRepresentativePhone,
      platform_admin_name: adminFullName,
      platform_admin_rut: adminRut,
      platform_admin_email: adminEmail,
      platform_admin_phone: adminPhone,
      primary_contact_name: adminFullName,
      primary_contact_email: adminEmail,
      primary_contact_phone: adminPhone,
      occupational_insurer: occupationalInsurer,
      compensation_fund: compensationFund,
      employee_count: employeeCount,
      master_data_version: 2,
      master_data_completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    let contractor: { id: string; name: string; rut: string | null; integration_key: string };

    if (legacyContractor) {
      const { data, error } = await admin
        .from("contratistas")
        .update(contractorPayload)
        .eq("id", legacyContractor.id)
        .select("id,name,rut,integration_key")
        .single();
      if (error || !data) throw error || new Error("No fue posible completar el contratista existente");
      contractor = data;
    } else {
      const { data, error } = await admin
        .from("contratistas")
        .insert(contractorPayload)
        .select("id,name,rut,integration_key")
        .single();
      if (error || !data) {
        if (error?.code === "23505") throw new Error("Ya existe un contratista con ese RUT.");
        throw error || new Error("No fue posible crear el contratista");
      }
      contractor = data;
      createdContractorId = contractor.id;
    }

    const { error: profileError } = await admin.from("profiles").upsert({
      id: user.id,
      full_name: adminFullName,
      phone: adminPhone,
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

    const { error: auditError } = await admin.from("audit_logs").insert({
      actor_profile_id: authData.user.id,
      action: legacyContractor ? "completitud_contratista" : "creacion_contratista",
      entity_type: "contratista",
      entity_id: contractor.id,
      details: {
        integration_key: contractor.integration_key,
        company_name: contractor.name,
        legal_name: legalName,
        rut: contractor.rut,
        region,
        commune,
        company_type: companyType,
        business_activity: businessActivity,
        occupational_insurer: occupationalInsurer,
        administrator_email: adminEmail,
        access_invited: invited,
        existing_contractor: Boolean(legacyContractor),
        master_data_version: 2,
      },
    });
    if (auditError) throw auditError;

    return json({
      ok: true,
      contractor,
      administrator: {
        full_name: adminFullName,
        rut: adminRut,
        email: adminEmail,
        phone: adminPhone,
      },
      legal_representative: {
        full_name: legalRepresentativeName,
        rut: legalRepresentativeRut,
        email: legalRepresentativeEmail,
        phone: legalRepresentativePhone,
      },
      invited,
      existing_user: !invited,
      existing_contractor: Boolean(legacyContractor),
      master_data_version: 2,
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
