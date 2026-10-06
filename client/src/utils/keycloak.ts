const KEYCLOAK_URL = import.meta.env.VITE_KEYCLOAK_URL;
const REALM = import.meta.env.VITE_KEYCLOAK_REALM;
const CLIENT_ID = import.meta.env.VITE_KEYCLOAK_CLIENT_ID;

export async function loginWithKeycloak(username: string, password: string) {
  const body = new URLSearchParams({
    grant_type: 'password',
    client_id: CLIENT_ID,
    username,
    password,
  });

  // Only add secret if it's configured (for confidential clients)
  const clientSecret = import.meta.env.VITE_KEYCLOAK_CLIENT_SECRET;
  if (clientSecret) {
    body.append('client_secret', clientSecret);
  }

  const response = await fetch(
    `${KEYCLOAK_URL}/realms/${REALM}/protocol/openid-connect/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    },
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error_description || error.error || 'Login failed');
  }

  const data = await response.json();
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
  };
}

export function getLoginUrl() {
  const redirectUri = encodeURIComponent(window.location.origin + '/callback');
  return `${KEYCLOAK_URL}/realms/${REALM}/protocol/openid-connect/auth?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${redirectUri}`;
}

export function getLogoutUrl() {
  const redirectUri = encodeURIComponent(window.location.origin);
  return `${KEYCLOAK_URL}/realms/${REALM}/protocol/openid-connect/logout?redirect_uri=${redirectUri}`;
}

export function getAccountUrl() {
  return `${KEYCLOAK_URL}/realms/${REALM}/account`;
}


export function getForgotPasswordUrl() {
  return `${KEYCLOAK_URL}/realms/${REALM}/login-actions/reset-credentials?client_id=${CLIENT_ID}`;
}

export function parseJwt(token: string) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join(''),
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}