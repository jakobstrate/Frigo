import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (request.method !== 'POST') {
    return jsonResponse(405, { error: 'Only POST requests are supported.' });
  }

  const authorization = request.headers.get('authorization');
  const accessToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!accessToken) {
    return jsonResponse(401, { error: 'Sign in as a Superadmin to create a company.' });
  }

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(accessToken);
  if (userError || !userData.user) {
    return jsonResponse(401, { error: 'Your session is invalid or has expired. Sign in again.' });
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('role, status')
    .eq('id', userData.user.id)
    .maybeSingle();

  if (profileError) {
    return jsonResponse(500, { error: `Could not verify your account: ${profileError.message}` });
  }
  if (profile?.role !== 'super_admin' || profile.status !== 'active') {
    return jsonResponse(403, { error: 'Only an active Superadmin can create companies.' });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(400, { error: 'The request body must be valid JSON.' });
  }

  if (!isRecord(body)) {
    return jsonResponse(400, { error: 'Company details are required.' });
  }

  const companyName = typeof body.companyName === 'string' ? body.companyName.trim() : '';
  const adminName = typeof body.adminName === 'string' ? body.adminName.trim() : '';
  const adminEmail = typeof body.adminEmail === 'string' ? body.adminEmail.trim().toLowerCase() : '';
  const departments = body.departments;

  if (!companyName) {
    return jsonResponse(400, { error: 'Enter a company name.' });
  }
  if (Boolean(adminName) !== Boolean(adminEmail)) {
    return jsonResponse(400, { error: 'Enter both administrator name and email, or leave both blank.' });
  }
  if (adminEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) {
    return jsonResponse(400, { error: 'Enter a valid administrator email address.' });
  }
  if (!Array.isArray(departments) || departments.some((department) => typeof department !== 'string')) {
    return jsonResponse(400, { error: 'Departments must be a list of names.' });
  }

  const departmentNames = departments
    .map((department: string) => department.trim())
    .filter((department: string) => department.length > 0);

  let invitedAdminId: string | null = null;
  if (adminEmail) {
    const requestOrigin = request.headers.get('origin');
    const inviteRedirectUrl = Deno.env.get('INVITE_REDIRECT_URL')
      ?? (requestOrigin ? new URL('/invite', requestOrigin).toString() : undefined);
    const inviteOptions: {
      data: { display_name: string; frigo_invitation_role: string };
      redirectTo?: string;
    } = {
      data: { display_name: adminName, frigo_invitation_role: 'company_admin' },
    };
    if (inviteRedirectUrl) inviteOptions.redirectTo = inviteRedirectUrl;

    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin
      .inviteUserByEmail(adminEmail, inviteOptions);
    if (inviteError) {
      return jsonResponse(400, { error: `Could not send the administrator invitation: ${inviteError.message}` });
    }
    if (!inviteData.user) {
      return jsonResponse(500, { error: 'The invitation was sent without returning an administrator account.' });
    }
    invitedAdminId = inviteData.user.id;
  }

  const { data: companyId, error: createError } = await supabaseAdmin.rpc('create_company_without_admin', {
    p_company_name: companyName,
    p_department_names: departmentNames,
    p_admin_id: invitedAdminId,
    p_admin_name: adminName || null,
    p_admin_email: adminEmail || null,
  });

  if (createError) {
    if (invitedAdminId) {
      const { error: cleanupError } = await supabaseAdmin.auth.admin.deleteUser(invitedAdminId);
      const cleanupMessage = cleanupError ? ` The invitation could not be revoked: ${cleanupError.message}` : '';
      return jsonResponse(400, { error: `Could not create the company: ${createError.message}.${cleanupMessage}` });
    }
    return jsonResponse(400, { error: `Could not create the company: ${createError.message}` });
  }

  return jsonResponse(200, { companyId, companyName, invitedEmail: adminEmail || null });
});
