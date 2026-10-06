/**
 * Keycloak One-Time Setup Script
 * 
 * Run this ONCE to configure your Keycloak realm automatically.
 * 
 * Usage: npx ts-node scripts/setup-keycloak.ts
 * 
 * What this script does:
 * 1. Authenticates with the master realm
 * 2. Configures the "omnicore" realm
 * 3. Creates the frontend client (React app)
 * 4. Creates the backend client (NestJS API)
 * 5. Creates the admin-cli client with proper permissions
 * 6. Creates realm roles (org_admin, org_member)
 * 7. Configures email/SMTP settings
 * 8. Configures required actions and password policy
 * 9. Prints all client secrets for your .env file
 */

import { getErrorMessage } from "../src/common/errorHandler";

const KEYCLOAK_URL = process.env.KEYCLOAK_URL || 'http://localhost:8080';
const REALM = process.env.KEYCLOAK_REALM || 'omnicore';
const MASTER_USERNAME = process.env.KEYCLOAK_MASTER_USER || 'admin';
const MASTER_PASSWORD = process.env.KEYCLOAK_MASTER_PASSWORD || 'admin';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// ============ SMTP CONFIGURATION ============
const SMTP_CONFIG = {
  host: 'smtp.gmail.com',
  port: '587',
  from: 'emmanuelsmoombe@gmail.com',
  fromDisplayName: 'OmniCore Africa',
  replyTo: 'emmanuelsmoombe@gmail.com',
  envelopeFrom: 'emmanuelsmoombe@gmail.com',
  auth: 'true',
  starttls: 'true',
  ssl: 'false',
  user: 'emmanuelsmoombe@gmail.com',
  password: 'ionadyqtphxeoyqu',
};

async function setupKeycloak() {
  console.log('🔧 Setting up Keycloak for OmniCore Africa...\n');

  // ============================================================
  // STEP 1: Authenticate with Master Realm
  // ============================================================
  console.log('📡 Authenticating with master realm...');
  
  const tokenRes = await fetch(`${KEYCLOAK_URL}/realms/master/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'password',
      client_id: 'admin-cli',
      username: MASTER_USERNAME,
      password: MASTER_PASSWORD,
    }),
  });

  if (!tokenRes.ok) {
    console.error('❌ Failed to authenticate. Check your master username/password.');
    console.error('   Set KEYCLOAK_MASTER_USER and KEYCLOAK_MASTER_PASSWORD env vars if not admin/admin');
    process.exit(1);
  }

  const tokenData = await tokenRes.json();
  const masterToken = tokenData.access_token;
  console.log('✅ Authenticated with master realm\n');

  const headers = {
    'Authorization': `Bearer ${masterToken}`,
    'Content-Type': 'application/json',
  };

  // ============================================================
  // STEP 2: Configure the OmniCore Realm
  // ============================================================
  console.log(`📁 Configuring realm: ${REALM}...`);

  const realmConfig = {
    realm: REALM,
    enabled: true,
    displayName: 'OmniCore Africa',
    loginWithEmailAllowed: true,
    duplicateEmailsAllowed: false,
    resetPasswordAllowed: true,
    editUsernameAllowed: true,
    registrationAllowed: false,
    verifyEmail: true,                    // Enable email verification
    loginTheme: 'keycloak',
    accessTokenLifespan: 3600,
    ssoSessionIdleTimeout: 1800,
    ssoSessionMaxLifespan: 36000,
    passwordPolicy: 'length(8) and digits(1) and specialChars(1) and upperCase(1) and lowerCase(1) and notUsername(undefined) and hashAlgorithm(pbkdf2-sha256)',
    
    // SMTP Settings
    smtpServer: {
      host: SMTP_CONFIG.host,
      port: SMTP_CONFIG.port,
      from: SMTP_CONFIG.from,
      fromDisplayName: SMTP_CONFIG.fromDisplayName,
      replyTo: SMTP_CONFIG.replyTo,
      envelopeFrom: SMTP_CONFIG.envelopeFrom,
      auth: SMTP_CONFIG.auth,
      starttls: SMTP_CONFIG.starttls,
      ssl: SMTP_CONFIG.ssl,
      user: SMTP_CONFIG.user,
      password: SMTP_CONFIG.password,
    },
  };

  const realmCheck = await fetch(`${KEYCLOAK_URL}/admin/realms/${REALM}`, { headers });
  
  if (realmCheck.ok) {
    console.log('   Realm exists, updating configuration...');
    await fetch(`${KEYCLOAK_URL}/admin/realms/${REALM}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(realmConfig),
    });
    console.log('✅ Realm updated');
  } else {
    console.log('   Creating new realm...');
    await fetch(`${KEYCLOAK_URL}/admin/realms`, {
      method: 'POST',
      headers,
      body: JSON.stringify(realmConfig),
    });
    console.log('✅ Realm created');
  }

  // ============================================================
  // STEP 3: Test SMTP Connection
  // ============================================================
  console.log('\n📧 Testing SMTP connection...');
  
  try {
    const testRes = await fetch(`${KEYCLOAK_URL}/admin/realms/${REALM}/test-smtp-connection`, {
      method: 'POST',
      headers,
    });
    
    if (testRes.ok) {
      console.log('✅ SMTP connection successful!');
    } else {
      const errText = await testRes.text();
      console.log('⚠️  SMTP test failed:', errText.substring(0, 200));
    }
  } catch (err) {
    console.log('⚠️  Could not test SMTP:', getErrorMessage(err));
  }

  // ============================================================
  // STEP 4: Create/Configure Frontend Client
  // ============================================================
  console.log('\n🌐 Configuring frontend client...');
  
  let frontendClient: any;
  const feClientsRes = await fetch(`${KEYCLOAK_URL}/admin/realms/${REALM}/clients?clientId=frontend`, { headers });
  const feClients = await feClientsRes.json();

  const frontendConfig = {
    clientId: 'frontend',
    name: 'OmniCore Frontend',
    description: 'React frontend application',
    enabled: true,
    publicClient: true,
    standardFlowEnabled: true,
    directAccessGrantsEnabled: true,
    redirectUris: [
      `${FRONTEND_URL}/*`,
      `${FRONTEND_URL}/verify-email`,
      `${FRONTEND_URL}/accept-invitation`,
      `${FRONTEND_URL}/login`,
    ],
    webOrigins: [FRONTEND_URL, 'http://localhost:5173'],
    rootUrl: FRONTEND_URL,
    baseUrl: FRONTEND_URL,
    adminUrl: '',
  };

  if (feClients.length === 0) {
    await fetch(`${KEYCLOAK_URL}/admin/realms/${REALM}/clients`, {
      method: 'POST',
      headers,
      body: JSON.stringify(frontendConfig),
    });
    const updated = await fetch(`${KEYCLOAK_URL}/admin/realms/${REALM}/clients?clientId=frontend`, { headers });
    const updatedList = await updated.json();
    frontendClient = updatedList[0];
    console.log('✅ Frontend client created');
  } else {
    frontendClient = feClients[0];
    await fetch(`${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${frontendClient.id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ ...frontendClient, ...frontendConfig }),
    });
    console.log('✅ Frontend client updated');
  }

  // ============================================================
  // STEP 5: Create/Configure Backend Client
  // ============================================================
  console.log('🔧 Configuring backend client...');
  
  let backendClient: any;
  let backendSecret = '';
  const beClientsRes = await fetch(`${KEYCLOAK_URL}/admin/realms/${REALM}/clients?clientId=backend`, { headers });
  const beClients = await beClientsRes.json();

  if (beClients.length === 0) {
    await fetch(`${KEYCLOAK_URL}/admin/realms/${REALM}/clients`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        clientId: 'backend',
        name: 'OmniCore Backend',
        description: 'NestJS backend API',
        enabled: true,
        publicClient: false,
        standardFlowEnabled: false,
        directAccessGrantsEnabled: true,
        serviceAccountsEnabled: false,
        clientAuthenticatorType: 'client-secret',
      }),
    });
    const updated = await fetch(`${KEYCLOAK_URL}/admin/realms/${REALM}/clients?clientId=backend`, { headers });
    const updatedList = await updated.json();
    backendClient = updatedList[0];
    console.log('✅ Backend client created');
  } else {
    backendClient = beClients[0];
    console.log('✅ Backend client already exists');
  }

  // Get backend client secret
  const beSecretRes = await fetch(
    `${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${backendClient.id}/client-secret`,
    { method: 'POST', headers },
  );
  const beSecretData = await beSecretRes.json();
  backendSecret = beSecretData.value;
  console.log('   Backend client secret obtained');

  // ============================================================
  // STEP 6: Configure admin-cli Client (Service Account)
  // ============================================================
  console.log('\n🔑 Configuring admin-cli client...');

  const clientsRes = await fetch(`${KEYCLOAK_URL}/admin/realms/${REALM}/clients?clientId=admin-cli`, { headers });
  const clients = await clientsRes.json();
  
  let adminClient: any;

  if (clients.length === 0) {
    await fetch(`${KEYCLOAK_URL}/admin/realms/${REALM}/clients`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        clientId: 'admin-cli',
        name: 'OmniCore Admin Client',
        description: 'Service account for OmniCore backend user management',
        enabled: true,
        serviceAccountsEnabled: true,
        publicClient: false,
        standardFlowEnabled: false,
        directAccessGrantsEnabled: false,
        clientAuthenticatorType: 'client-secret',
      }),
    });
    const newClients = await fetch(`${KEYCLOAK_URL}/admin/realms/${REALM}/clients?clientId=admin-cli`, { headers });
    const newClientList = await newClients.json();
    adminClient = newClientList[0];
    console.log('✅ admin-cli client created');
  } else {
    adminClient = clients[0];
    await fetch(`${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${adminClient.id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        ...adminClient,
        serviceAccountsEnabled: true,
        clientAuthenticatorType: 'client-secret',
      }),
    });
    console.log('✅ admin-cli client already exists');
  }

  // Get admin client secret
  console.log('🔐 Getting admin client secret...');
  const secretRes = await fetch(
    `${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${adminClient.id}/client-secret`,
    { method: 'POST', headers },
  );
  const secretData = await secretRes.json();
  const adminSecret = secretData.value;
  console.log('✅ Admin client secret obtained');

  // ============================================================
  // STEP 7: Assign ALL Required Roles to Service Account
  // ============================================================
  console.log('\n👤 Assigning admin roles to service account...');

  const serviceAccountRes = await fetch(
    `${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${adminClient.id}/service-account-user`,
    { headers },
  );
  const serviceAccount = await serviceAccountRes.json();

  const rmClientsRes = await fetch(
    `${KEYCLOAK_URL}/admin/realms/${REALM}/clients?clientId=realm-management`,
    { headers },
  );
  const rmClients = await rmClientsRes.json();
  const rmClient = rmClients[0];

  const rolesRes = await fetch(
    `${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${rmClient.id}/roles`,
    { headers },
  );
  const allRoles = await rolesRes.json();

  const neededRoles = [
    'manage-users', 'view-users', 'query-users', 'query-realms',
    'query-groups', 'manage-realm', 'view-realm',
    'manage-clients', 'view-clients',
    'manage-authorization', 'view-authorization',
    'manage-events', 'view-events',
    'manage-identity-providers', 'view-identity-providers',
    'impersonation',
  ];
  
  const rolesToAssign = allRoles.filter((r: any) => neededRoles.includes(r.name));

  await fetch(
    `${KEYCLOAK_URL}/admin/realms/${REALM}/users/${serviceAccount.id}/role-mappings/clients/${rmClient.id}`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify(rolesToAssign),
    },
  );
  console.log(`✅ Assigned ${rolesToAssign.length} roles: ${rolesToAssign.map((r: any) => r.name).join(', ')}`);

  // ============================================================
  // STEP 8: Create Realm Roles
  // ============================================================
  console.log('\n🏷️  Creating realm roles...');

  const realmRoles = [
    { name: 'org_admin', description: 'Organization administrator with full access' },
    { name: 'org_member', description: 'Organization team member' },
  ];

  for (const role of realmRoles) {
    const existingRole = await fetch(
      `${KEYCLOAK_URL}/admin/realms/${REALM}/roles/${role.name}`,
      { headers },
    );

    if (existingRole.ok) {
      console.log(`   Role "${role.name}" already exists`);
    } else {
      await fetch(`${KEYCLOAK_URL}/admin/realms/${REALM}/roles`, {
        method: 'POST',
        headers,
        body: JSON.stringify(role),
      });
      console.log(`   Role "${role.name}" created`);
    }
  }

  // ============================================================
  // STEP 9: Configure Required Actions
  // ============================================================
  console.log('\n⚙️  Configuring required actions...');

  const requiredActions = [
    { alias: 'UPDATE_PASSWORD', enabled: true, defaultAction: false },
    { alias: 'VERIFY_EMAIL', enabled: true, defaultAction: false },
    { alias: 'CONFIGURE_TOTP', enabled: true, defaultAction: false },
  ];

  for (const action of requiredActions) {
    await fetch(`${KEYCLOAK_URL}/admin/realms/${REALM}/authentication/required-actions/${action.alias}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(action),
    });
  }
  console.log('✅ Required actions configured');

  // ============================================================
  // DONE!
  // ============================================================
  console.log('\n' + '='.repeat(60));
  console.log('🎉 Keycloak setup complete!');
  console.log('='.repeat(60));
  console.log('\n📋 Add these to your backend/.env file:');
  console.log('─'.repeat(60));
  console.log(`KEYCLOAK_CLIENT_ID=backend`);
  console.log(`KEYCLOAK_CLIENT_SECRET=${backendSecret}`);
  console.log(`KEYCLOAK_ADMIN_CLIENT_ID=admin-cli`);
  console.log(`KEYCLOAK_ADMIN_CLIENT_SECRET=${adminSecret}`);
  console.log('─'.repeat(60));
  
  console.log('\n📋 Add these to your client/.env file:');
  console.log('─'.repeat(60));
  console.log(`VITE_KEYCLOAK_CLIENT_ID=frontend`);
  console.log('─'.repeat(60));

  console.log('\n📧 SMTP Configuration:');
  console.log('─'.repeat(60));
  console.log(`   Host: ${SMTP_CONFIG.host}`);
  console.log(`   Port: ${SMTP_CONFIG.port}`);
  console.log(`   From: ${SMTP_CONFIG.from}`);
  console.log(`   User: ${SMTP_CONFIG.user}`);
  console.log('─'.repeat(60));
  
  console.log('\n🔗 Redirect URIs configured:');
  console.log('─'.repeat(60));
  console.log(`   ${FRONTEND_URL}/*`);
  console.log(`   ${FRONTEND_URL}/verify-email`);
  console.log(`   ${FRONTEND_URL}/accept-invitation`);
  console.log(`   ${FRONTEND_URL}/login`);
  console.log('─'.repeat(60));

  console.log('\n✅ Setup complete! Run: npm run start:dev\n');
}

setupKeycloak().catch((err) => {
  console.error('❌ Setup failed:', err.message);
  process.exit(1);
});