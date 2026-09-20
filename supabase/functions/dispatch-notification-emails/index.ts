import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL = Deno.env.get("NOTIFICATION_FROM_EMAIL") ?? "";
const APP_URL = (Deno.env.get("PUBLIC_APP_URL") ?? "https://acredita-frontend.vercel.app").replace(/\/$/, "");

type OutboxRow = {
  id: string;
  notification_id: string;
  recipient_profile_id: string;
  occurrence_number: number;
  attempts: number;
};

type NotificationRow = {
  id: string;
  title: string;
  body: string;
  severity: string;
  category: string;
  action_label: string;
  action_kind: string;
  project_key: string | null;
  worker_rut: string | null;
  occurred_at: string;
};

const jsonHeaders = {
  "Content-Type": "application/json",
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function actionUrl(item: NotificationRow): string {
  const project = item.project_key ? `?proyecto=${encodeURIComponent(item.project_key)}` : "";
  if (item.action_kind === "documentos") return `${APP_URL}/contratista/documentos${project}`;
  if (item.action_kind === "trabajador") return `${APP_URL}/contratista/trabajadores${project}`;
  if (item.action_kind === "operacion" || item.action_kind === "soporte") return `${APP_URL}/contratista/operacion${project}`;
  if (item.action_kind === "proyecto") return `${APP_URL}/contratista/proyectos${project}`;
  return `${APP_URL}/contratista${project}`;
}

async function rest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { ...jsonHeaders, ...(init?.headers ?? {}) },
  });
  if (!response.ok) throw new Error(`Supabase REST ${response.status}: ${await response.text()}`);
  if (response.status === 204) return undefined as T;
  return await response.json() as T;
}

async function patchOutbox(id: string, payload: Record<string, unknown>) {
  await rest<void>(`notification_email_outbox?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(payload),
  });
}

async function validateInternalSecret(secret: string): Promise<boolean> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/validate_notification_dispatch_secret`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ p_secret: secret }),
  });
  if (!response.ok) return false;
  return Boolean(await response.json());
}

async function getUserEmail(profileId: string): Promise<string | null> {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(profileId)}`, {
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
  });
  if (!response.ok) return null;
  const user = await response.json();
  return typeof user?.email === "string" && user.email.includes("@") ? user.email : null;
}

async function sendEmail(to: string, notification: NotificationRow): Promise<string> {
  const url = actionUrl(notification);
  const subjectPrefix = notification.severity === "critical" ? "[Acción requerida] " : "";
  const html = `<!doctype html>
<html lang="es">
<body style="margin:0;background:#f5f2ec;font-family:Arial,sans-serif;color:#17354e">
  <div style="max-width:620px;margin:32px auto;background:#fff;border:1px solid #e5dfd4;border-radius:14px;overflow:hidden">
    <div style="padding:22px 26px;background:#17354e;color:#fff">
      <div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;opacity:.78">Acredita</div>
      <h1 style="font-size:20px;margin:7px 0 0">${escapeHtml(notification.title)}</h1>
    </div>
    <div style="padding:24px 26px">
      <p style="font-size:14px;line-height:1.6;margin:0 0 20px">${escapeHtml(notification.body)}</p>
      <a href="${escapeHtml(url)}" style="display:inline-block;padding:11px 16px;background:#8a6544;color:#fff;text-decoration:none;border-radius:8px;font-size:13px;font-weight:700">${escapeHtml(notification.action_label || "Ver en Acredita")}</a>
      <p style="margin:22px 0 0;color:#7d858b;font-size:11px;line-height:1.5">Este correo comunica un evento registrado en Acredita. Marcar la notificación como leída no cambia el estado documental, de acceso o pago.</p>
    </div>
  </div>
</body>
</html>`;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [to],
      subject: `${subjectPrefix}${notification.title}`,
      html,
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.message || payload?.error || `Resend ${response.status}`);
  return String(payload?.id || "");
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const internalSecret = req.headers.get("x-acredita-dispatch-secret") ?? "";
  if (!internalSecret || !(await validateInternalSecret(internalSecret))) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const pending = await rest<OutboxRow[]>(
    "notification_email_outbox?select=id,notification_id,recipient_profile_id,occurrence_number,attempts&status=in.(pending,failed)&next_attempt_at=lte.now()&order=created_at.asc&limit=20",
  );

  if (!RESEND_API_KEY || !FROM_EMAIL) {
    const next = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    for (const row of pending) {
      await patchOutbox(row.id, {
        status: "pending",
        next_attempt_at: next,
        last_error: "Canal email preparado, pero falta configurar RESEND_API_KEY y NOTIFICATION_FROM_EMAIL.",
      });
    }
    return new Response(JSON.stringify({ processed: 0, queued: pending.length, emailConfigured: false }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  let sent = 0;
  let failed = 0;
  for (const row of pending) {
    try {
      await patchOutbox(row.id, { status: "sending", attempts: row.attempts + 1, last_error: null });
      const notifications = await rest<NotificationRow[]>(
        `notifications?select=id,title,body,severity,category,action_label,action_kind,project_key,worker_rut,occurred_at&id=eq.${encodeURIComponent(row.notification_id)}&limit=1`,
      );
      const notification = notifications[0];
      if (!notification) {
        await patchOutbox(row.id, { status: "skipped", last_error: "Notificación ya no disponible." });
        continue;
      }
      const email = await getUserEmail(row.recipient_profile_id);
      if (!email) {
        await patchOutbox(row.id, { status: "skipped", last_error: "La cuenta no tiene un correo válido." });
        continue;
      }
      const providerId = await sendEmail(email, notification);
      await patchOutbox(row.id, {
        status: "sent",
        provider_message_id: providerId || null,
        sent_at: new Date().toISOString(),
        last_error: null,
      });
      sent += 1;
    } catch (error) {
      failed += 1;
      const attempts = row.attempts + 1;
      const minutes = Math.min(360, Math.max(5, 5 * (2 ** Math.min(attempts, 6))));
      await patchOutbox(row.id, {
        status: "failed",
        next_attempt_at: new Date(Date.now() + minutes * 60 * 1000).toISOString(),
        last_error: error instanceof Error ? error.message.slice(0, 900) : "Error desconocido al enviar correo.",
      });
    }
  }

  return new Response(JSON.stringify({ processed: pending.length, sent, failed, emailConfigured: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
