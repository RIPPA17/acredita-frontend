import {
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_URL,
  authenticateSupabaseCredentials,
  finalizeSupabaseSession,
  tokensFromAuthHash,
  updateSupabaseUser,
  type SupabaseRawTokens,
  type SupabaseUserSession,
} from './supabaseAuth';

export type InvitationPreview = {
  invitation_id: string;
  invited_email: string;
  contractor_name: string;
  contractor_rut: string | null;
  project_id: string;
  project_name: string;
  mandante_name: string;
  message: string | null;
  expires_at: string | null;
  requirement_names: string[];
};

type CreateInvitationResult = {
  invitation_id: string;
  token: string;
  expires_at: string;
};

type AcceptInvitationResult = {
  invitation_id: string;
  contractor_id: string;
  contractor_integration_key: string;
  project_id: string;
  project_integration_key: string;
};

function headers(accessToken?: string): HeadersInit {
  return {
    apikey: SUPABASE_PUBLISHABLE_KEY,
    'Content-Type': 'application/json',
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  };
}

async function parseResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.message || payload?.hint || payload?.error_description || payload?.error || 'Error de invitación';
    throw new Error(message);
  }
  return payload as T;
}

async function rpc<T>(name: string, body: Record<string, unknown>, accessToken?: string): Promise<T> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: headers(accessToken),
    body: JSON.stringify(body),
  });
  return parseResponse<T>(response);
}

async function lookupBackendId(table: 'projects' | 'contratistas', integrationKey: string, accessToken: string): Promise<string> {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
  url.searchParams.set('select', 'id');
  url.searchParams.set('integration_key', `eq.${integrationKey}`);
  url.searchParams.set('limit', '1');
  const response = await fetch(url.toString(), { headers: headers(accessToken) });
  const rows = await parseResponse<Array<{ id: string }>>(response);
  if (!rows[0]?.id) throw new Error(`No se encontró ${table === 'projects' ? 'el proyecto' : 'el contratista'} en Supabase`);
  return rows[0].id;
}

export async function createContractorInvitation(input: {
  session: SupabaseUserSession;
  projectKey: string;
  email: string;
  contractorKey?: string;
  contractorName?: string;
  contractorRut?: string;
  message?: string;
}): Promise<CreateInvitationResult> {
  const token = input.session._supabase.accessToken;
  const projectId = await lookupBackendId('projects', input.projectKey, token);
  const contractorId = input.contractorKey
    ? await lookupBackendId('contratistas', input.contractorKey, token)
    : null;
  const rows = await rpc<CreateInvitationResult[]>('create_contractor_invitation', {
    p_project_id: projectId,
    p_email: input.email.trim().toLowerCase(),
    p_contractor_id: contractorId,
    p_contractor_name: input.contractorName?.trim() || null,
    p_contractor_rut: input.contractorRut?.trim() || null,
    p_message: input.message?.trim() || null,
  }, token);
  if (!rows[0]) throw new Error('Supabase no devolvió la invitación creada');
  return rows[0];
}

export async function sendContractorInvitationEmail(
  invitationId: string,
  token: string,
  accessToken: string,
): Promise<{ ok: boolean; mode?: string }> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/send-contractor-invitation`, {
    method: 'POST',
    headers: headers(accessToken),
    body: JSON.stringify({ invitation_id: invitationId, token }),
  });
  return parseResponse(response);
}

export function contractorInvitationLink(token: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://acredita-frontend.vercel.app';
  return `${origin}/invitacion?token=${encodeURIComponent(token)}`;
}

export async function getContractorInvitationPreview(token: string): Promise<InvitationPreview> {
  const rows = await rpc<InvitationPreview[]>('get_contractor_invitation_preview', { p_token: token });
  if (!rows[0]) throw new Error('La invitación no existe, venció o ya fue utilizada');
  return rows[0];
}

export async function signupFromContractorInvitation(token: string, fullName: string, password: string): Promise<void> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/signup-contractor-invitation`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ token, full_name: fullName.trim(), password }),
  });
  const payload = await response.json().catch(() => ({}));
  if (response.status === 409 && payload?.error === 'ACCOUNT_EXISTS') throw new Error('Ya existe una cuenta con este correo. Usa “Ya tengo cuenta”.');
  if (!response.ok) throw new Error(payload?.error || 'No fue posible crear la cuenta');
}

export async function acceptContractorInvitation(token: string, auth: SupabaseRawTokens): Promise<SupabaseUserSession> {
  await rpc<AcceptInvitationResult[]>('accept_contractor_invitation', { p_token: token }, auth.accessToken);
  return finalizeSupabaseSession(auth);
}

export async function rejectContractorInvitation(token: string, auth: SupabaseRawTokens): Promise<void> {
  await rpc<boolean>('reject_contractor_invitation', { p_token: token }, auth.accessToken);
}

export async function loginAndAcceptContractorInvitation(
  token: string,
  email: string,
  password: string,
): Promise<SupabaseUserSession> {
  const auth = await authenticateSupabaseCredentials(email, password);
  return acceptContractorInvitation(token, auth);
}

export async function signupAndAcceptContractorInvitation(
  token: string,
  email: string,
  fullName: string,
  password: string,
): Promise<SupabaseUserSession> {
  await signupFromContractorInvitation(token, fullName, password);
  const auth = await authenticateSupabaseCredentials(email, password);
  return acceptContractorInvitation(token, auth);
}

export async function finishEmailInvite(
  token: string,
  fullName: string | undefined,
  password: string | undefined,
): Promise<SupabaseUserSession | null> {
  const parsed = tokensFromAuthHash();
  if (!parsed) return null;
  if (parsed.type === 'invite') {
    if (!password || password.length < 8) throw new Error('Debes crear una contraseña de al menos 8 caracteres');
    await updateSupabaseUser(parsed.tokens.accessToken, { password, fullName });
  }
  const session = await acceptContractorInvitation(token, parsed.tokens);
  if (typeof window !== 'undefined') window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.search}`);
  return session;
}

export { tokensFromAuthHash };
