/* eslint-disable */
// Temporary end-to-end verification for the Keycloak -> custom auth migration.
const BASE = process.env.E2E_BASE || 'http://localhost:3000/api/v1';

let pass = 0;
let fail = 0;
const failures = [];

function check(name, ok, detail) {
  if (ok) {
    pass++;
    console.log(`  PASS  ${name}`);
  } else {
    fail++;
    failures.push(`${name} :: ${detail}`);
    console.log(`  FAIL  ${name}  -> ${detail}`);
  }
}

async function req(method, path, { token, apiKey, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (apiKey) headers['x-api-key'] = apiKey;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* no body */ }
  return { status: res.status, body: json, data: json?.data };
}

(async () => {
  const stamp = Date.now();
  const email = `e2e.admin.${stamp}@example.com`;
  const password = 'E2ePassw0rd!';
  const orgName = `E2E Auth ${stamp}`;
  const slug = `e2e-auth-${stamp}`;

  console.log('\n--- 1. Public endpoints (no token) ---');
  {
    const r = await req('GET', `/health`);
    check('GET /health 200 without token', r.status === 200, `status=${r.status}`);
  }
  {
    const r = await req('GET', `/auth/check-slug/${slug}`);
    check('GET /auth/check-slug public + available', r.status === 200 && r.data?.available === true, `status=${r.status} body=${JSON.stringify(r.body)}`);
  }
  {
    const r = await req('GET', '/auth/api/me');
    check('GET /auth/api/me without token -> 401', r.status === 401, `status=${r.status}`);
  }
  {
    const r = await req('GET', '/users', { token: 'not-a-real-token' });
    check('Protected route with garbage token -> 401', r.status === 401, `status=${r.status}`);
  }

  console.log('\n--- 2. Registration (org + admin atomically) ---');
  let orgId;
  {
    const r = await req('POST', '/auth/register', {
      body: { organizationName: orgName, adminFirstName: 'E2E', adminLastName: 'Admin', email, password },
    });
    orgId = r.data?.organizationId;
    check('POST /auth/register 201/200', r.status === 200 || r.status === 201, `status=${r.status} body=${JSON.stringify(r.body)}`);
    check('register returned organizationId', !!orgId, JSON.stringify(r.body));
    check('register reports userCreated + rolesSeeded', r.data?.details?.userCreated === true && r.data?.details?.rolesSeeded === true, JSON.stringify(r.data?.details));
  }
  {
    const r = await req('GET', `/auth/check-slug/${slug}`);
    check('slug now taken', r.data?.available === false, JSON.stringify(r.body));
  }

  console.log('\n--- 3. Direct login (no OTP step) ---');
  let session;
  {
    const r = await req('POST', '/auth/api/login', { body: { username: email, password } });
    session = r.data;
    check('login 200', r.status === 200 || r.status === 201, `status=${r.status} body=${JSON.stringify(r.body)}`);
    check('login returns accessToken', typeof session?.accessToken === 'string' && session.accessToken.split('.').length === 3, 'no JWT');
    check('login returns refreshToken', typeof session?.refreshToken === 'string' && session.refreshToken.length > 20, 'missing');
    check('login has NO requires2FA challenge', session?.requires2FA === false, `requires2FA=${session?.requires2FA}`);
    check('JWT sub is the local user id (uuid)', /^[0-9a-f-]{36}$/.test(session?.user?.sub || ''), `sub=${session?.user?.sub}`);
    check('JWT carries orgId', session?.user?.orgId === orgId, `orgId=${session?.user?.orgId} expected=${orgId}`);
    check('JWT carries local org_admin role', (session?.user?.realm_access?.roles || []).includes('org_admin'), JSON.stringify(session?.user?.realm_access));
  }

  console.log('\n--- 4. Bad credentials ---');
  {
    const r = await req('POST', '/auth/api/login', { body: { username: email, password: 'WrongPassw0rd!' } });
    check('wrong password -> 401', r.status === 401, `status=${r.status}`);
    check('wrong password error is generic', /Invalid email or password/.test(JSON.stringify(r.body)), JSON.stringify(r.body));
  }
  {
    const r = await req('POST', '/auth/api/login', { body: { username: `nobody.${stamp}@example.com`, password } });
    check('unknown user -> 401 (no enumeration)', r.status === 401, `status=${r.status}`);
  }

  console.log('\n--- 5. Authenticated access + permissions ---');
  {
    const r = await req('GET', '/auth/api/me', { token: session.accessToken });
    check('GET /auth/api/me 200 with token', r.status === 200, `status=${r.status}`);
    check('me returns orgId from DB', r.data?.orgId === orgId, JSON.stringify(r.data));
    check('me returns no pending required actions', Array.isArray(r.data?.requiredActions) && r.data.requiredActions.length === 0, JSON.stringify(r.data?.requiredActions));
    check('me reports emailVerified=false', r.data?.emailVerified === false, JSON.stringify(r.data?.emailVerified));
  }
  {
    // Requires users:manage — org_admin has it, so this also proves the
    // PermissionsGuard resolves permissions from the DB by local user id.
    const r = await req('GET', '/auth/invitations', { token: session.accessToken });
    check('GET /auth/invitations authorised via DB role (users:manage)', r.status === 200, `status=${r.status} body=${JSON.stringify(r.body)}`);
  }

  console.log('\n--- 6. Invitation (creates a local user, no password) ---');
  const inviteeEmail = `e2e.invitee.${stamp}@example.com`;
  {
    const r = await req('POST', '/auth/invite', {
      token: session.accessToken,
      body: { email: inviteeEmail, firstName: 'Inv', lastName: 'Itee', role: 'data_entry' },
    });
    check('POST /auth/invite 200/201', r.status === 200 || r.status === 201, `status=${r.status} body=${JSON.stringify(r.body)}`);
    check('invite returns invitationId', !!r.data?.invitationId, JSON.stringify(r.body));
  }
  {
    const r = await req('POST', '/auth/api/login', { body: { username: inviteeEmail, password: 'Anything123!' } });
    check('invited user cannot log in before setting a password', r.status === 401, `status=${r.status}`);
    check('invited user gets actionable "no password" message', /no password set yet/i.test(JSON.stringify(r.body)), JSON.stringify(r.body));
  }

  console.log('\n--- 7. Refresh rotation ---');
  let rotated;
  {
    const r = await req('POST', '/auth/api/refresh', { body: { refreshToken: session.refreshToken } });
    rotated = r.data;
    check('refresh 200', r.status === 200 || r.status === 201, `status=${r.status} body=${JSON.stringify(r.body)}`);
    check('refresh returns a NEW access token', !!rotated?.accessToken, 'missing');
    check('refresh returns a NEW refresh token', !!rotated?.refreshToken && rotated.refreshToken !== session.refreshToken, 'not rotated');
    check('refreshed token still works', (await req('GET', '/auth/api/me', { token: rotated.accessToken })).status === 200, 'me failed');
  }
  {
    const r = await req('POST', '/auth/api/refresh', { body: { refreshToken: session.refreshToken } });
    check('replaying the OLD refresh token -> 401', r.status === 401, `status=${r.status}`);
  }

  console.log('\n--- 8. Logout revocation ---');
  {
    const r = await req('POST', '/auth/api/logout', { body: { refreshToken: rotated.refreshToken } });
    check('logout 200', r.status === 200 || r.status === 201, `status=${r.status}`);
  }
  {
    const r = await req('POST', '/auth/api/refresh', { body: { refreshToken: rotated.refreshToken } });
    check('refresh after logout -> 401 (revoked)', r.status === 401, `status=${r.status}`);
  }
  {
    const r = await req('POST', '/auth/api/refresh', { body: { refreshToken: 'garbage-token' } });
    check('refresh with garbage token -> 401', r.status === 401, `status=${r.status}`);
  }

  console.log('\n--- 9. Forgot password (no enumeration) ---');
  {
    const r1 = await req('POST', '/auth/api/forgot-password', { body: { email } });
    const r2 = await req('POST', '/auth/api/forgot-password', { body: { email: `ghost.${stamp}@example.com` } });
    check('forgot-password 200 for known email', r1.status === 200 || r1.status === 201, `status=${r1.status}`);
    check('forgot-password 200 for unknown email', r2.status === 200 || r2.status === 201, `status=${r2.status}`);
    check('identical response for known/unknown email', JSON.stringify(r1.data) === JSON.stringify(r2.data), `${JSON.stringify(r1.data)} vs ${JSON.stringify(r2.data)}`);
  }
  {
    const r = await req('POST', '/auth/api/reset-password', { body: { token: 'bogus', newPassword: password, confirmPassword: password } });
    check('reset with invalid token -> 400', r.status === 400, `status=${r.status}`);
  }

  console.log('\n--- 10. API-key path still separate from JWT ---');
  let apiKeySecret;
  {
    const r = await req('POST', '/api-keys', { token: session.accessToken, body: { name: 'e2e key', scopes: ['records:read'] } });
    apiKeySecret = r.data?.key || r.data?.apiKey || r.data?.secret || r.data?.plainKey;
    check('POST /api-keys creates a key', !!apiKeySecret, `status=${r.status} body=${JSON.stringify(r.body)}`);
  }
  if (apiKeySecret) {
    {
      const r = await req('GET', '/users', { apiKey: apiKeySecret });
      check('API key on blocked endpoint -> 403 (ApiKeyScopeGuard, not JWT 401)', r.status === 403, `status=${r.status} body=${JSON.stringify(r.body)}`);
    }
    {
      const r = await req('GET', '/auth/api/me', { apiKey: apiKeySecret });
      check('API key cannot use user-only auth endpoint -> 401/403', r.status === 401 || r.status === 403, `status=${r.status}`);
    }
  }
  {
    const r = await req('GET', '/users', { apiKey: 'definitely-not-a-real-key' });
    check('invalid API key -> 403', r.status === 403, `status=${r.status}`);
  }

  console.log(`\n================ ${pass} passed, ${fail} failed ================`);
  if (failures.length) {
    console.log('Failures:');
    failures.forEach((f) => console.log(`  - ${f}`));
  }
  process.exit(fail === 0 ? 0 : 1);
})().catch((e) => {
  console.error('E2E harness crashed:', e);
  process.exit(2);
});
