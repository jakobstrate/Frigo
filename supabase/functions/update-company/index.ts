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

  const accessToken = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!accessToken) {
    return jsonResponse(401, { error: 'Sign in as a Superadmin to edit a company.' });
  }

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(accessToken);
  if (userError || !userData.user) {
    return jsonResponse(401, { error: 'Your session is invalid or has expired. Sign in again.' });
  }

  const { data: actingProfile, error: actingProfileError } = await supabaseAdmin
    .from('profiles')
    .select('role, status')
    .eq('id', userData.user.id)
    .maybeSingle();

  if (actingProfileError) {
    return jsonResponse(500, { error: `Could not verify your account: ${actingProfileError.message}` });
  }
  if (actingProfile?.role !== 'super_admin' || actingProfile.status !== 'active') {
    return jsonResponse(403, { error: 'Only an active Superadmin can edit companies.' });
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

  const companyId = body.companyId;
  const companyName = typeof body.companyName === 'string' ? body.companyName.trim() : '';
  const adminId = typeof body.adminId === 'string' ? body.adminId : '';
  const adminName = typeof body.adminName === 'string' ? body.adminName.trim() : '';
  const adminEmail = typeof body.adminEmail === 'string' ? body.adminEmail.trim().toLowerCase() : '';
  const departments = body.departments;

  if (typeof companyId !== 'number' || !Number.isSafeInteger(companyId) || !companyName || !adminName
    || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)
    || (adminId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(adminId))) {
    return jsonResponse(400, { error: 'Enter a company name and valid administrator details.' });
  }
  if (!Array.isArray(departments) || departments.some((department) =>
    !isRecord(department)
      || (department.id !== null && (typeof department.id !== 'number' || !Number.isSafeInteger(department.id) || department.id <= 0))
      || typeof department.name !== 'string'
      || !department.name.trim()
  )) {
    return jsonResponse(400, { error: 'Departments must have a valid name and ID.' });
  }

  const { data: company, error: companyError } = await supabaseAdmin
    .from('companies')
    .select('id, status')
    .eq('id', companyId)
    .maybeSingle();
  if (companyError) {
    return jsonResponse(500, { error: `Could not load the company: ${companyError.message}` });
  }
  if (!company || company.status === 'deleted') {
    return jsonResponse(404, { error: 'The company does not exist or has been deleted.' });
  }

  let effectiveAdminId = adminId;
  let previousEmail: string | null = null;
  let invitedAdminId: string | null = null;

  if (adminId) {
    const [{ data: adminProfile, error: adminProfileError }, { data: authAdmin, error: authAdminError }] = await Promise.all([
      supabaseAdmin.from('profiles').select('id, role, status').eq('id', adminId).eq('company_id', companyId).maybeSingle(),
      supabaseAdmin.auth.admin.getUserById(adminId),
    ]);
    if (adminProfileError || authAdminError) {
      return jsonResponse(500, { error: 'Could not load the company administrator details.' });
    }
    if (!adminProfile || adminProfile.role !== 'company_admin' || adminProfile.status !== 'active' || !authAdmin.user?.email) {
      return jsonResponse(400, { error: 'Select an active company administrator.' });
    }

    previousEmail = authAdmin.user.email;
    if (previousEmail.toLowerCase() !== adminEmail) {
      const { error: emailError } = await supabaseAdmin.auth.admin.updateUserById(adminId, {
        email: adminEmail,
        email_confirm: true,
      });
      if (emailError) {
        return jsonResponse(400, { error: `Could not update the administrator login email: ${emailError.message}` });
      }
    }
  } else {
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
    effectiveAdminId = inviteData.user.id;
    invitedAdminId = inviteData.user.id;
  }

  const { error: updateError } = await supabaseAdmin.rpc('update_company_details', {
    p_company_id: companyId,
    p_company_name: companyName,
    p_departments: departments,
    p_admin_id: effectiveAdminId,
    p_admin_name: adminName,
    p_admin_email: adminEmail,
  });

  if (updateError) {
    if (invitedAdminId) {
      const { error: cleanupError } = await supabaseAdmin.auth.admin.deleteUser(invitedAdminId);
      const cleanupMessage = cleanupError ? ` The invitation could not be revoked: ${cleanupError.message}` : '';
      return jsonResponse(400, { error: `Could not update the company: ${updateError.message}.${cleanupMessage}` });
    }
    if (previousEmail && previousEmail.toLowerCase() !== adminEmail) {
      const { error: rollbackError } = await supabaseAdmin.auth.admin.updateUserById(adminId, {
        email: previousEmail,
        email_confirm: true,
      });
      if (rollbackError) {
        return jsonResponse(500, {
          error: `Company changes failed: ${updateError.message}. The administrator email rollback also failed: ${rollbackError.message}`,
        });
      }
    }
    return jsonResponse(400, { error: `Could not update the company: ${updateError.message}` });
  }

  return jsonResponse(200, { companyId, companyName, adminEmail });
});