/* eslint-disable */
// Second end-to-end pass: invitation -> set password -> login, and change-password.
const BASE = process.env.E2E_BASE || 'http://localhost:3000/api/v1';

let pass = 0, fail = 0;
const failures = [];
function check(name, ok, detail) {
  if (ok) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; failures.push(`${name} :: ${detail}`); console.log(`  FAIL  ${name}  -> ${detail}`); }
}

async function req(method, path, { token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, body: json, data: json?.data };
}

(async () => {
  const stamp = Date.now();
  const adminEmail = `flow2.admin.${stamp}@example.com`;
  const inviteeEmail = `flow2.invitee.${stamp}@example.com`;
  const adminPw = 'AdminPassw0rd!';
  const inviteePw = 'InviteePassw0rd!';

  console.log('\n--- setup: org + admin + invitation ---');
  const reg = await req('POST', '/auth/register', {
    body: { organizationName: `Flow2 ${stamp}`, adminFirstName: 'Flow', adminLastName: 'Two', email: adminEmail, password: adminPw },
  });
  check('register org', reg.status === 200 || reg.status === 201, `status=${reg.status} ${JSON.stringify(reg.body)}`);

  const loginAdmin = await req('POST', '/auth/api/login', { body: { username: adminEmail, password: adminPw } });
  check('admin login', loginAdmin.status === 200 || loginAdmin.status === 201, `status=${loginAdmin.status}`);
  const adminToken = loginAdmin.data?.accessToken;

  const invite = await req('POST', '/auth/invite', {
    token: adminToken,
    body: { email: inviteeEmail, firstName: 'Flow', lastName: 'Invitee', role: 'data_entry' },
  });
  check('create invitation', invite.status === 200 || invite.status === 201, `status=${invite.status} ${JSON.stringify(invite.body)}`);

  const list = await req('GET', '/auth/invitations', { token: adminToken });
  const row = (list.data || []).find((i) => i.email === inviteeEmail);
  check('invitation is listed as pending', !!row && row.status === 'pending', JSON.stringify(list.data));

  console.log('\n--- invitation accept -> set password -> login ---');
  let setPasswordToken;
  {
    const r = await req('POST', '/invitations/accept', { body: { token: row?.token } });
    setPasswordToken = r.data?.setPasswordToken;
    check('accept invitation', r.status === 200 || r.status === 201, `status=${r.status} ${JSON.stringify(r.body)}`);
    check('accept returns a set-password token', typeof setPasswordToken === 'string' && setPasswordToken.length > 20, JSON.stringify(r.data));
  }
  {
    const r = await req('POST', '/invitations/accept', { body: { token: row?.token } });
    check('accepting the same invitation twice is rejected', r.status === 400 || r.status === 404, `status=${r.status}`);
  }
  {
    const weak = await req('POST', '/auth/api/reset-password', {
      body: { token: setPasswordToken, newPassword: 'weak', confirmPassword: 'weak' },
    });
    check('set-password enforces strength rules', weak.status === 400, `status=${weak.status}`);
  }
  {
    const r = await req('POST', '/auth/api/reset-password', {
      body: { token: setPasswordToken, newPassword: inviteePw, confirmPassword: inviteePw },
    });
    check('set password from invitation token', r.status === 200 || r.status === 201, `status=${r.status} ${JSON.stringify(r.body)}`);
  }
  {
    const r = await req('POST', '/auth/api/reset-password', {
      body: { token: setPasswordToken, newPassword: inviteePw, confirmPassword: inviteePw },
    });
    check('set-password token is single use', r.status === 400, `status=${r.status}`);
  }
  let inviteeSession;
  {
    const r = await req('POST', '/auth/api/login', { body: { username: inviteeEmail, password: inviteePw } });
    inviteeSession = r.data;
    check('invitee can log in after setting a password', r.status === 200 || r.status === 201, `status=${r.status} ${JSON.stringify(r.body)}`);
    check('invitee requiredActions cleared (UPDATE_PASSWORD completed)', (inviteeSession?.user?.required_actions || []).length === 0, JSON.stringify(inviteeSession?.user?.required_actions));
    check('invitee joined the SAME organization as the inviter', !!inviteeSession?.user?.orgId && inviteeSession.user.orgId === reg.data?.organizationId, `invitee org=${inviteeSession?.user?.orgId} admin org=${reg.data?.organizationId}`);
  }
  {
    const r = await req('GET', '/auth/invitations', { token: inviteeSession?.accessToken });
    check("invitee (data_entry role) is blocked from users:manage", r.status === 403, `status=${r.status}`);
  }

  console.log('\n--- authenticated change-password ---');
  {
    const r = await req('POST', '/auth/api/change-password', {
      token: inviteeSession?.accessToken,
      body: { currentPassword: 'TotallyWrong123!', newPassword: 'BrandNew123!', confirmPassword: 'BrandNew123!' },
    });
    check('change-password with wrong current password -> 401', r.status === 401, `status=${r.status}`);
  }
  {
    const r = await req('POST', '/auth/api/change-password', {
      token: inviteeSession?.accessToken,
      body: { currentPassword: inviteePw, newPassword: 'BrandNew123!', confirmPassword: 'BrandNew123!' },
    });
    check('change-password with correct current password', r.status === 200 || r.status === 201, `status=${r.status} ${JSON.stringify(r.body)}`);
  }
  {
    const oldPw = await req('POST', '/auth/api/login', { body: { username: inviteeEmail, password: inviteePw } });
    check('old password no longer works', oldPw.status === 401, `status=${oldPw.status}`);
    const newPw = await req('POST', '/auth/api/login', { body: { username: inviteeEmail, password: 'BrandNew123!' } });
    check('new password works', newPw.status === 200 || newPw.status === 201, `status=${newPw.status}`);
  }

  console.log('\n--- force-change path (UPDATE_PASSWORD required action) ---');
  {
    // Users carried over from Keycloak have this action set by the migration
    // backfill. Verify the force branch skips the current-password check.
    const r = await req('POST', '/auth/api/change-password', {
      token: inviteeSession?.accessToken,
      body: { newPassword: 'ForcedNew123!', confirmPassword: 'ForcedNew123!', forceChange: true },
    });
    check('forceChange skips current-password requirement', r.status === 200 || r.status === 201, `status=${r.status} ${JSON.stringify(r.body)}`);
  }

  console.log('\n--- validation guards ---');
  {
    const r = await req('POST', '/auth/api/change-password', {
      token: inviteeSession?.accessToken,
      body: { currentPassword: 'x', newPassword: 'aa', confirmPassword: 'bb' },
    });
    check('password mismatch -> 400', r.status === 400, `status=${r.status}`);
  }
  {
    const r = await req('POST', '/auth/register', {
      body: { organizationName: `Dup ${stamp}`, adminFirstName: 'D', adminLastName: 'U', email: adminEmail, password: adminPw },
    });
    check('duplicate admin email rejected at registration', r.status === 400, `status=${r.status}`);
  }

  console.log(`\n================ ${pass} passed, ${fail} failed ================`);
  if (failures.length) { console.log('Failures:'); failures.forEach((f) => console.log(`  - ${f}`)); }
  process.exit(fail === 0 ? 0 : 1);
})().catch((e) => { console.error('harness crashed:', e); process.exit(2); });
