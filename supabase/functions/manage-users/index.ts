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

type JsonRecord = Record<string, unknown>;
type AppRole = 'super_admin' | 'company_admin' | 'employee';
type UserStatus = 'active' | 'inactive' | 'pending' | 'rejected' | 'deleted';

function jsonResponse(status: number, body: JsonRecord) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function positiveId(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : null;
}

function validRole(value: unknown): value is AppRole {
  return value === 'super_admin' || value === 'company_admin' || value === 'employee';
}

function validRoles(value: unknown): value is AppRole[] {
  return Array.isArray(value)
    && value.length > 0
    && value.every(validRole)
    && new Set(value).size === value.length;
}

function primaryRole(roles: AppRole[]): AppRole {
  if (roles.includes('super_admin')) return 'super_admin';
  if (roles.includes('company_admin')) return 'company_admin';
  return 'employee';
}

function sameRoles(left: AppRole[], right: AppRole[]) {
  return left.length === right.length && left.every((role) => right.includes(role));
}

function validEmail(value: unknown): value is string {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

async function validateCompanyAndDepartment(companyId: number | null, departmentId: number | null) {
  if (companyId === null) {
    if (departmentId !== null) throw new Error('Choose a company before selecting a department.');
    return;
  }

  const { data: company, error: companyError } = await supabaseAdmin
    .from('companies')
    .select('id, status')
    .eq('id', companyId)
    .maybeSingle();
  if (companyError) throw new Error(`Could not load the company: ${companyError.message}`);
  if (!company || company.status !== 'active') throw new Error('Select an active company.');

  if (departmentId !== null) {
    const { data: department, error: departmentError } = await supabaseAdmin
      .from('departments')
      .select('id')
      .eq('id', departmentId)
      .eq('company_id', companyId)
      .maybeSingle();
    if (departmentError) throw new Error(`Could not load the department: ${departmentError.message}`);
    if (!department) throw new Error('Select a department that belongs to the selected company.');
  }
}

async function verifyAvatarPath(avatarPath: string | null, companyId: number) {
  if (!avatarPath) return;
  const prefix = `${companyId}/`;
  if (!avatarPath.startsWith(prefix) || avatarPath.includes('..')) {
    throw new Error('The uploaded image does not belong to the selected company.');
  }

  const fileName = avatarPath.slice(prefix.length);
  if (!fileName || fileName.includes('/')) throw new Error('The uploaded image path is invalid.');
  const { data: files, error } = await supabaseAdmin.storage.from('profile-images').list(String(companyId), {
    search: fileName,
  });
  if (error) throw new Error(`Could not validate the uploaded image: ${error.message}`);
  const uploadedFile = files?.find((file) => file.name === fileName);
  const metadata = uploadedFile?.metadata;
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  const fileSize = metadata && Number(metadata.size);
  if (!metadata || !allowedTypes.includes(String(metadata.mimetype))
    || !Number.isFinite(fileSize) || fileSize <= 0 || fileSize > 5 * 1024 * 1024) {
    throw new Error('Profile images must be JPG, PNG, or WEBP and no larger than 5 MB.');
  }
}

async function assignPendingRequests(companyId: number, adminId: string, adminEmail: string) {
  const [employeeRequests, deletionRequests] = await Promise.all([
    supabaseAdmin
      .from('employee_requests')
      .update({ requested_admin_id: adminId, requested_admin_email: adminEmail })
      .eq('company_id', companyId)
      .eq('status', 'pending'),
    supabaseAdmin
      .from('account_deletion_requests')
      .update({ requested_admin_id: adminId })
      .eq('company_id', companyId)
      .eq('status', 'pending'),
  ]);
  const error = employeeRequests.error ?? deletionRequests.error;
  if (error) throw new Error(`The administrator was saved, but pending requests could not be reassigned: ${error.message}`);
}

async function hasOtherActiveCompanyAdmins(companyId: number, excludedUserId?: string) {
  let query = supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('company_id', companyId)
    .contains('roles', ['company_admin'])
    .eq('status', 'active');
  if (excludedUserId) query = query.neq('id', excludedUserId);
  const { data, error } = await query.limit(1);
  if (error) throw new Error(`Could not check the company administrators: ${error.message}`);
  return (data?.length ?? 0) > 0;
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse(405, { error: 'Only POST requests are supported.' });

  const accessToken = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!accessToken) return jsonResponse(401, { error: 'Sign in as an administrator to manage users.' });

  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(accessToken);
  if (authError || !authData.user) return jsonResponse(401, { error: 'Your session is invalid or has expired. Sign in again.' });

  const { data: actor, error: actorError } = await supabaseAdmin
    .from('profiles')
    .select('id, role, status, company_id')
    .eq('id', authData.user.id)
    .maybeSingle();
  if (actorError) return jsonResponse(500, { error: `Could not verify your account: ${actorError.message}` });
  if (!actor || actor.status !== 'active' || !['super_admin', 'company_admin'].includes(actor.role)) {
    return jsonResponse(403, { error: 'Only an active administrator can manage users.' });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(400, { error: 'The request body must be valid JSON.' });
  }
  if (!isRecord(body) || typeof body.action !== 'string') {
    return jsonResponse(400, { error: 'Choose a user-management action.' });
  }

  try {
    if (body.action === 'review-account-deletion-request') {
      const requestId = positiveId(body.requestId);
      if (requestId === null || typeof body.accept !== 'boolean') {
        return jsonResponse(400, { error: 'Choose a valid account deletion request and review decision.' });
      }

      const { data: deletionRequest, error: requestError } = await supabaseAdmin
        .from('account_deletion_requests')
        .select('id, user_id, company_id, requested_admin_id, status')
        .eq('id', requestId)
        .maybeSingle();
      if (requestError) return jsonResponse(500, { error: `Could not load the account deletion request: ${requestError.message}` });
      if (!deletionRequest || deletionRequest.status !== 'pending') {
        return jsonResponse(404, { error: 'This account deletion request is no longer pending.' });
      }
      if (actor.role === 'company_admin' && deletionRequest.company_id !== actor.company_id) {
        return jsonResponse(403, { error: 'You can only review requests from your own company.' });
      }
      if (body.accept) {
        const { data: target, error: targetError } = await supabaseAdmin
          .from('profiles')
          .select('id, status')
          .eq('id', deletionRequest.user_id)
          .maybeSingle();
        if (targetError) return jsonResponse(500, { error: `Could not load the requested account: ${targetError.message}` });
        if (!target || target.status !== 'active') {
          return jsonResponse(409, { error: 'The requested account is no longer active.' });
        }

        const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(target.id, {
          ban_duration: '876000h',
        });
        if (banError) return jsonResponse(500, { error: `Could not block login for this user: ${banError.message}` });
      }

      const { error: reviewError } = await supabaseAdmin.rpc('review_account_deletion_request', {
        p_request_id: requestId,
        p_reviewer_id: actor.id,
        p_accept: body.accept,
      });
      if (reviewError) {
        let rollbackMessage = '';
        if (body.accept) {
          const { data: currentRequest, error: currentRequestError } = await supabaseAdmin
            .from('account_deletion_requests')
            .select('status')
            .eq('id', requestId)
            .maybeSingle();
          if (!currentRequestError && currentRequest?.status !== 'accepted') {
            const { error: rollbackError } = await supabaseAdmin.auth.admin.updateUserById(deletionRequest.user_id, {
              ban_duration: 'none',
            });
            if (rollbackError) rollbackMessage = ` Login rollback also failed: ${rollbackError.message}`;
          } else if (currentRequestError) {
            rollbackMessage = ` Login status could not be verified and remains blocked: ${currentRequestError.message}`;
          }
        }
        return jsonResponse(409, { error: `Could not review the deletion request: ${reviewError.message}.${rollbackMessage}` });
      }

      return jsonResponse(200, { requestId, status: body.accept ? 'accepted' : 'declined' });
    }

    if (body.action === 'restore') {
      if (actor.role !== 'super_admin') {
        return jsonResponse(403, { error: 'Only a Superadmin can restore deleted users.' });
      }

      const userId = typeof body.userId === 'string' ? body.userId : '';
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
        return jsonResponse(400, { error: 'Choose a valid user.' });
      }

      const { data: target, error: targetError } = await supabaseAdmin
        .from('profiles')
        .select('id, status, invitation_completed, company_id')
        .eq('id', userId)
        .maybeSingle();
      if (targetError) return jsonResponse(500, { error: `Could not load the user: ${targetError.message}` });
      if (!target || target.status !== 'deleted') {
        return jsonResponse(404, { error: 'The deleted user does not exist or is no longer available to restore.' });
      }

      if (target.company_id !== null) {
        const { data: company, error: companyError } = await supabaseAdmin
          .from('companies')
          .select('status')
          .eq('id', target.company_id)
          .maybeSingle();
        if (companyError) return jsonResponse(500, { error: `Could not load the company: ${companyError.message}` });
        if (!company || company.status !== 'active') {
          return jsonResponse(400, { error: "Reactivate the user's company before restoring this account." });
        }
      }

      const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        ban_duration: 'none',
      });
      if (authUpdateError) {
        return jsonResponse(400, { error: `Could not restore the login account: ${authUpdateError.message}` });
      }

      const { data: restoredProfile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .update({ status: target.invitation_completed ? 'active' : 'inactive', deleted_at: null })
        .eq('id', userId)
        .eq('status', 'deleted')
        .select('id')
        .maybeSingle();
      if (profileError || !restoredProfile) {
        const { error: rollbackError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
          ban_duration: '876000h',
        });
        const rollbackMessage = rollbackError ? ` Login rollback also failed: ${rollbackError.message}` : '';
        const message = profileError?.message ?? 'The deleted profile is no longer available.';
        return jsonResponse(profileError ? 400 : 404, {
          error: `Could not restore the user profile: ${message}.${rollbackMessage}`,
        });
      }

      return jsonResponse(200, {
        userId,
        status: target.invitation_completed ? 'active' : 'inactive',
      });
    }

    if (body.action === 'create') {
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
      const requestedRoles = body.roles === undefined && validRole(body.role) ? [body.role] : body.roles;
      const companyId = positiveId(body.companyId);
      const departmentId = body.departmentId === null ? null : positiveId(body.departmentId);
      const avatarPath = typeof body.avatarPath === 'string' ? body.avatarPath : null;

      if (!name || !validEmail(email) || !validRoles(requestedRoles)) {
        return jsonResponse(400, { error: 'Enter a name, valid email address, and at least one role.' });
      }
      if (body.canEditProducts !== undefined && actor.role !== 'super_admin') {
        return jsonResponse(403, { error: 'Only a Superadmin can grant product editing access.' });
      }
      if (body.canEditProducts !== undefined && typeof body.canEditProducts !== 'boolean') {
        return jsonResponse(400, { error: 'Choose a valid product editing permission.' });
      }
      if (body.canEditProducts === true && primaryRole(requestedRoles) !== 'company_admin') {
        return jsonResponse(400, { error: 'Only company admins can have product editing access.' });
      }
      const requestedRole = primaryRole(requestedRoles);
      if (actor.role === 'company_admin'
        && (requestedRoles.length !== 1 || requestedRole !== 'employee')) {
        return jsonResponse(403, { error: 'Company admins can only create employees.' });
      }
      const assignedCompanyId = actor.role === 'company_admin' ? actor.company_id : companyId;
      if ((requestedRoles.includes('employee') || requestedRoles.includes('company_admin'))
        && assignedCompanyId === null) {
        return jsonResponse(400, { error: 'Choose a company for this user.' });
      }
      if (body.departmentId !== null && departmentId === null) {
        return jsonResponse(400, { error: 'Choose a valid department.' });
      }
      await validateCompanyAndDepartment(assignedCompanyId, departmentId);
      if (assignedCompanyId !== null) await verifyAvatarPath(avatarPath, assignedCompanyId);
      const requestOrigin = request.headers.get('origin');
      const inviteRedirectUrl = Deno.env.get('INVITE_REDIRECT_URL')
        ?? (requestOrigin ? new URL('/invite', requestOrigin).toString() : undefined);
      const inviteOptions: {
        data: { display_name: string; frigo_invitation_role: string; frigo_admin_created: boolean };
        redirectTo?: string;
      } = {
        data: {
          display_name: name,
          frigo_invitation_role: requestedRole,
          frigo_admin_created: true,
        },
      };
      if (inviteRedirectUrl) inviteOptions.redirectTo = inviteRedirectUrl;
      const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin
        .inviteUserByEmail(email, inviteOptions);
      if (inviteError) return jsonResponse(400, { error: `Could not send the login invitation: ${inviteError.message}` });
      if (!inviteData.user) return jsonResponse(500, { error: 'The invitation was sent without returning a user account.' });

      const { error: profileError } = await supabaseAdmin.from('profiles').insert({
        id: inviteData.user.id,
        display_name: name,
        email,
        role: requestedRole,
        roles: requestedRoles,
        status: 'inactive',
        invitation_completed: false,
        company_id: assignedCompanyId,
        department_id: departmentId,
        avatar_path: avatarPath,
        can_edit_products: requestedRole === 'company_admin' && body.canEditProducts === true,
      });
      if (profileError) {
        const { error: cleanupError } = await supabaseAdmin.auth.admin.deleteUser(inviteData.user.id);
        const cleanupMessage = cleanupError ? ` The invitation could not be revoked: ${cleanupError.message}` : '';
        return jsonResponse(400, { error: `Could not create the user profile: ${profileError.message}.${cleanupMessage}` });
      }

      return jsonResponse(200, { userId: inviteData.user.id, email });
    }

    if (body.action === 'update' || body.action === 'delete') {
      const userId = typeof body.userId === 'string' ? body.userId : '';
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
        return jsonResponse(400, { error: 'Choose a valid user.' });
      }
      if (userId === actor.id) return jsonResponse(400, { error: 'You cannot deactivate or delete your own account.' });

      const { data: target, error: targetError } = await supabaseAdmin
        .from('profiles')
        .select('id, display_name, email, role, roles, status, invitation_completed, company_id, department_id, can_edit_products')
        .eq('id', userId)
        .maybeSingle();
      if (targetError) return jsonResponse(500, { error: `Could not load the user: ${targetError.message}` });
      if (!target || target.status === 'deleted') return jsonResponse(404, { error: 'The user does not exist or has already been deleted.' });
      if (actor.role === 'company_admin'
        && (target.company_id !== actor.company_id || target.role !== 'employee')) {
        return jsonResponse(403, { error: 'Company admins can only manage employees in their own company.' });
      }

      if (body.action === 'delete') {
        const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
          ban_duration: '876000h',
        });
        if (banError) return jsonResponse(500, { error: `Could not block login for this user: ${banError.message}` });

        const { error: profileError } = await supabaseAdmin
          .from('profiles')
          .update({ status: 'deleted' })
          .eq('id', userId);
        if (profileError) {
          const previousBan = target.status === 'inactive' || target.status === 'rejected' ? '876000h' : 'none';
          const { error: rollbackError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
            ban_duration: previousBan,
          });
          const rollbackMessage = rollbackError ? ` Login rollback also failed: ${rollbackError.message}` : '';
          return jsonResponse(400, { error: `Could not delete the user profile: ${profileError.message}.${rollbackMessage}` });
        }
        return jsonResponse(200, { userId, status: 'deleted' });
      }

      const name = typeof body.name === 'string' ? body.name.trim() : target.display_name;
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : target.email;
      const requestedRoles = body.roles === undefined
        ? body.role === undefined ? target.roles : [body.role]
        : body.roles;
      const companyId = body.companyId === undefined ? target.company_id : positiveId(body.companyId);
      const departmentId = body.departmentId === undefined
        ? target.department_id
        : body.departmentId === null ? null : positiveId(body.departmentId);
      const requestedStatus = body.status === undefined ? target.status : body.status as UserStatus;

      if (!name || !validEmail(email) || !validRoles(requestedRoles)
        || !['active', 'inactive', 'pending', 'rejected'].includes(requestedStatus)) {
        return jsonResponse(400, { error: 'Enter valid user details and status.' });
      }
      if (body.canEditProducts !== undefined && actor.role !== 'super_admin') {
        return jsonResponse(403, { error: 'Only a Superadmin can grant product editing access.' });
      }
      if (body.canEditProducts !== undefined && typeof body.canEditProducts !== 'boolean') {
        return jsonResponse(400, { error: 'Choose a valid product editing permission.' });
      }
      if (body.canEditProducts === true && primaryRole(requestedRoles) !== 'company_admin') {
        return jsonResponse(400, { error: 'Only company admins can have product editing access.' });
      }
      const canEditProducts = primaryRole(requestedRoles) === 'company_admin'
        && (body.canEditProducts === undefined ? target.can_edit_products : body.canEditProducts);
      const requestedRole = primaryRole(requestedRoles);
      if (actor.role === 'company_admin'
        && (requestedRoles.length !== 1 || requestedRole !== 'employee')) {
        return jsonResponse(403, { error: 'Company admins cannot change user roles.' });
      }
      if (actor.role !== 'super_admin'
        && (!sameRoles(requestedRoles, target.roles) || companyId !== target.company_id)) {
        return jsonResponse(403, { error: 'Only a Superadmin can change roles or company assignments.' });
      }
      if ((requestedRoles.includes('employee') || requestedRoles.includes('company_admin'))
        && companyId === null) {
        return jsonResponse(400, { error: 'Choose a company for this user.' });
      }
      if (requestedStatus === 'active' && ['pending', 'rejected'].includes(target.status)) {
        return jsonResponse(400, { error: 'Pending or rejected users must be approved through the requests page.' });
      }
      if (!target.invitation_completed && requestedStatus === 'active') {
        return jsonResponse(400, { error: 'Users must create their password through the invitation before activation.' });
      }
      if (body.departmentId !== undefined && body.departmentId !== null && departmentId === null) {
        return jsonResponse(400, { error: 'Choose a valid department.' });
      }
      await validateCompanyAndDepartment(companyId, departmentId);
      const becomesActiveCompanyAdmin = requestedRoles.includes('company_admin')
        && requestedStatus === 'active'
        && (!target.roles.includes('company_admin') || target.status !== 'active' || target.company_id !== companyId);
      const hadOtherCompanyAdmin = becomesActiveCompanyAdmin && companyId !== null
        ? await hasOtherActiveCompanyAdmins(companyId, userId)
        : true;

      const { data: authTarget, error: authTargetError } = await supabaseAdmin.auth.admin.getUserById(userId);
      if (authTargetError || !authTarget.user) {
        return jsonResponse(500, { error: `Could not load the login account: ${authTargetError?.message ?? 'User not found.'}` });
      }
      const previousEmail = authTarget.user.email ?? target.email;
      const authChanges: { email?: string; email_confirm?: boolean; ban_duration?: string } = {};
      if (previousEmail.toLowerCase() !== email) {
        authChanges.email = email;
        authChanges.email_confirm = true;
      }
      if (requestedStatus === 'inactive' || requestedStatus === 'rejected') authChanges.ban_duration = '876000h';
      if (requestedStatus === 'active') authChanges.ban_duration = 'none';
      if (Object.keys(authChanges).length > 0) {
        const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(userId, authChanges);
        if (authUpdateError) return jsonResponse(400, { error: `Could not update the login account: ${authUpdateError.message}` });
      }

      const { error: profileError } = await supabaseAdmin.from('profiles').update({
        display_name: name,
        email,
        role: requestedRole,
        roles: requestedRoles,
        status: requestedStatus,
        company_id: companyId,
        department_id: departmentId,
        can_edit_products: canEditProducts,
      }).eq('id', userId);
      if (profileError) {
        const rollbackChanges: { email?: string; email_confirm?: boolean; ban_duration?: string } = {};
        if (authChanges.email) {
          rollbackChanges.email = previousEmail;
          rollbackChanges.email_confirm = true;
        }
        if (authChanges.ban_duration) {
          rollbackChanges.ban_duration = target.status === 'inactive' || target.status === 'rejected' ? '876000h' : 'none';
        }
        const { error: rollbackError } = Object.keys(rollbackChanges).length > 0
          ? await supabaseAdmin.auth.admin.updateUserById(userId, rollbackChanges)
          : { error: null };
        const rollbackMessage = rollbackError ? ` Login rollback also failed: ${rollbackError.message}` : '';
        return jsonResponse(400, { error: `Could not update the user profile: ${profileError.message}.${rollbackMessage}` });
      }

      if (becomesActiveCompanyAdmin && companyId !== null && !hadOtherCompanyAdmin) {
        await assignPendingRequests(companyId, userId, email);
      }
      return jsonResponse(200, { userId, email });
    }

    if (body.action === 'delete-company') {
      if (actor.role !== 'super_admin') return jsonResponse(403, { error: 'Only a Superadmin can delete a company.' });
      const companyId = positiveId(body.companyId);
      if (companyId === null) return jsonResponse(400, { error: 'Choose a valid company.' });
      const { data: company, error: companyError } = await supabaseAdmin
        .from('companies')
        .select('id, status')
        .eq('id', companyId)
        .maybeSingle();
      if (companyError) return jsonResponse(500, { error: `Could not load the company: ${companyError.message}` });
      if (!company || company.status === 'deleted') return jsonResponse(404, { error: 'The company does not exist or has already been deleted.' });

      const { data: companyProfiles, error: profilesError } = await supabaseAdmin
        .from('profiles')
        .select('id, status')
        .eq('company_id', companyId)
        .neq('status', 'deleted');
      if (profilesError) return jsonResponse(500, { error: `Could not load company users: ${profilesError.message}` });

      const bannedProfiles: { id: string; status: string }[] = [];
      for (const profile of companyProfiles ?? []) {
        const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(profile.id, {
          ban_duration: '876000h',
        });
        if (banError) {
          const rollbackErrors: string[] = [];
          for (const bannedProfile of bannedProfiles) {
            const previousBan = bannedProfile.status === 'inactive' || bannedProfile.status === 'rejected' ? '876000h' : 'none';
            const { error: rollbackError } = await supabaseAdmin.auth.admin.updateUserById(bannedProfile.id, {
              ban_duration: previousBan,
            });
            if (rollbackError) rollbackErrors.push(rollbackError.message);
          }
          const rollbackMessage = rollbackErrors.length ? ` Some login rollbacks failed: ${rollbackErrors.join('; ')}` : '';
          return jsonResponse(500, { error: `Could not block login for every company user: ${banError.message}.${rollbackMessage}` });
        }
        bannedProfiles.push(profile);
      }

      const { error: deleteError } = await supabaseAdmin.rpc('soft_delete_company', {
        p_company_id: companyId,
      });
      if (deleteError) {
        const rollbackErrors: string[] = [];
        for (const bannedProfile of bannedProfiles) {
          const previousBan = bannedProfile.status === 'inactive' || bannedProfile.status === 'rejected' ? '876000h' : 'none';
          const { error: rollbackError } = await supabaseAdmin.auth.admin.updateUserById(bannedProfile.id, {
            ban_duration: previousBan,
          });
          if (rollbackError) rollbackErrors.push(rollbackError.message);
        }
        const rollbackMessage = rollbackErrors.length ? ` Some login rollbacks failed: ${rollbackErrors.join('; ')}` : '';
        return jsonResponse(400, { error: `Could not delete the company: ${deleteError.message}.${rollbackMessage}` });
      }

      return jsonResponse(200, { companyId, status: 'deleted' });
    }

    if (body.action === 'set-company-status') {
      if (actor.role !== 'super_admin') return jsonResponse(403, { error: 'Only a Superadmin can change a company status.' });
      const companyId = positiveId(body.companyId);
      const requestedStatus = body.status;
      if (companyId === null || (requestedStatus !== 'active' && requestedStatus !== 'inactive')) {
        return jsonResponse(400, { error: 'Choose a valid company and status.' });
      }

      const { data: company, error: companyError } = await supabaseAdmin
        .from('companies')
        .select('id, status')
        .eq('id', companyId)
        .maybeSingle();
      if (companyError) return jsonResponse(500, { error: `Could not load the company: ${companyError.message}` });
      if (!company || company.status === 'deleted') {
        return jsonResponse(404, { error: 'The company does not exist or has already been deleted.' });
      }
      if (company.status === requestedStatus) return jsonResponse(200, { companyId, status: requestedStatus });

      const { data: companyProfiles, error: profilesError } = await supabaseAdmin
        .from('profiles')
        .select('id, status, invitation_completed')
        .eq('company_id', companyId)
        .neq('status', 'deleted');
      if (profilesError) return jsonResponse(500, { error: `Could not load company users: ${profilesError.message}` });

      const changedProfiles: { id: string; status: string; invitation_completed: boolean }[] = [];
      const restoreLoginStates = async () => {
        const rollbackErrors: string[] = [];
        for (const profile of changedProfiles) {
          const shouldRemainBanned = profile.status === 'rejected'
            || (profile.status === 'inactive' && profile.invitation_completed);
          const { error: rollbackError } = await supabaseAdmin.auth.admin.updateUserById(profile.id, {
            ban_duration: shouldRemainBanned ? '876000h' : 'none',
          });
          if (rollbackError) rollbackErrors.push(rollbackError.message);
        }
        return rollbackErrors;
      };

      if (requestedStatus === 'inactive') {
        for (const profile of companyProfiles ?? []) {
          const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(profile.id, {
            ban_duration: '876000h',
          });
          if (banError) {
            const { data: currentCompany, error: currentCompanyError } = await supabaseAdmin
              .from('companies')
              .select('status')
              .eq('id', companyId)
              .maybeSingle();
            const rollbackErrors = !currentCompanyError && currentCompany?.status === 'active'
              ? await restoreLoginStates()
              : [];
            if (currentCompanyError || !currentCompany || currentCompany.status !== 'active') {
              rollbackErrors.push('Login remains blocked because the company is no longer active or its status could not be verified.');
            }
            const rollbackMessage = rollbackErrors.length ? ` Some login rollbacks failed: ${rollbackErrors.join('; ')}` : '';
            return jsonResponse(500, { error: `Could not block login for every company user: ${banError.message}.${rollbackMessage}` });
          }
          changedProfiles.push(profile);
        }
      }

      const { data: updatedCompany, error: updateError } = await supabaseAdmin
        .from('companies')
        .update({ status: requestedStatus })
        .eq('id', companyId)
        .eq('status', company.status)
        .select('id')
        .maybeSingle();
      if (updateError || !updatedCompany) {
        const { data: currentCompany, error: currentCompanyError } = await supabaseAdmin
          .from('companies')
          .select('status')
          .eq('id', companyId)
          .maybeSingle();
        if (!currentCompanyError && currentCompany?.status === requestedStatus) {
          return jsonResponse(200, { companyId, status: requestedStatus });
        }
        const rollbackErrors = requestedStatus === 'inactive'
          && !currentCompanyError
          && currentCompany?.status === 'active'
          ? await restoreLoginStates()
          : [];
        if (requestedStatus === 'inactive' && (currentCompanyError || !currentCompany || currentCompany.status !== 'active')) {
          rollbackErrors.push('Login remains blocked because the company status could not be verified as active.');
        }
        const rollbackMessage = rollbackErrors.length ? ` Some login rollbacks failed: ${rollbackErrors.join('; ')}` : '';
        const errorMessage = updateError?.message ?? 'The company status changed before this update completed.';
        return jsonResponse(409, { error: `Could not update the company status: ${errorMessage}.${rollbackMessage}` });
      }

      if (requestedStatus === 'active') {
        for (const profile of companyProfiles ?? []) {
          if (profile.status !== 'active' && profile.status !== 'pending'
            && !(profile.status === 'inactive' && !profile.invitation_completed)) continue;
          const { error: unbanError } = await supabaseAdmin.auth.admin.updateUserById(profile.id, {
            ban_duration: 'none',
          });
          if (unbanError) {
            const { error: companyRollbackError } = await supabaseAdmin
              .from('companies')
              .update({ status: 'inactive' })
              .eq('id', companyId)
              .eq('status', 'active');
            const rebanErrors: string[] = [];
            for (const reactivatedProfile of changedProfiles) {
              const { error: rebanError } = await supabaseAdmin.auth.admin.updateUserById(reactivatedProfile.id, {
                ban_duration: '876000h',
              });
              if (rebanError) rebanErrors.push(rebanError.message);
            }
            const rollbackErrors = [
              ...(companyRollbackError ? [`Company status rollback failed: ${companyRollbackError.message}`] : []),
              ...rebanErrors,
            ];
            const rollbackMessage = rollbackErrors.length ? ` Rollback issues: ${rollbackErrors.join('; ')}` : '';
            return jsonResponse(500, { error: `The company was activated, but login could not be restored for every user: ${unbanError.message}.${rollbackMessage}` });
          }
          changedProfiles.push(profile);
        }
      }

      return jsonResponse(200, { companyId, status: requestedStatus });
    }

    return jsonResponse(400, { error: 'Unknown user-management action.' });
  } catch (error) {
    return jsonResponse(400, { error: error instanceof Error ? error.message : 'The user could not be managed.' });
  }
});
