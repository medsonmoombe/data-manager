import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as crypto from 'crypto';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const ORG_ID = 'b13ad0b6-66f8-4e26-bcc9-fac9c3f45a97';
const NOW = new Date();
const DAY = 24 * 60 * 60 * 1000;

function daysAgo(n: number): Date {
  return new Date(NOW.getTime() - n * DAY);
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function hashIdentifier(val: string): string {
  return crypto.createHash('sha256').update(val.toLowerCase().trim()).digest('hex');
}

// ===================================================================
// STATIC DATA POOLS
// ===================================================================
const FIRST_NAMES = ['John', 'Mary', 'Peter', 'Grace', 'James', 'Elizabeth', 'David', 'Susan', 'Joseph', 'Patricia', 'Charles', 'Alice', 'Samuel', 'Catherine', 'Daniel', 'Ruth', 'Thomas', 'Dorothy', 'Christopher', 'Sarah', 'Brian', 'Nancy', 'Edward', 'Margaret', 'Patrick', 'Florence', 'Kenneth', 'Esther', 'Michael', 'Agnes', 'Simon', 'Joyce', 'Andrew', 'Beatrice', 'Stephen', 'Lydia', 'George', 'Rebecca', 'Paul', 'Monica', 'Victor', 'Veronica', 'Henry', 'Alicia', 'Raymond', 'Martha', 'Gilbert', 'Eunice', 'Lazarus', 'Esnart'];
const LAST_NAMES = ['Banda', 'Phiri', 'Mulenga', 'Chanda', 'Mwila', 'Tembo', 'Zulu', 'Mwale', 'Kasonde', 'Musonda', 'Chilufya', 'Simwanza', 'Sakala', 'Mbewe', 'Nyanga', 'Chisanga', 'Mumba', 'Kabwe', 'Lungu', 'Banda', 'Chibwe', 'Mkandawire', 'Kamanga', 'Mwale', 'Chama', 'Nkhoma', 'Gondwe', 'Manda', 'Nyirenda', 'Chimuka'];
const DISTRICTS = ['Lusaka', 'Kitwe', 'Ndola', 'Kabwe', 'Chingola', 'Mufulira', 'Luanshya', 'Livingstone', 'Chipata', 'Kasama', 'Mongu', 'Solwezi', 'Mansa', 'Kafue', 'Mazabuka', 'Choma', 'Siavonga', 'Mpika', 'Mkushi', 'Mumbwa', 'Serenje', 'Chinsali', 'Isoka', 'Nakonde', 'Petauke', 'Lundazi', 'Chama', 'Kalabo', 'Senanga', 'Kaoma'];
const PROVINCES = ['Lusaka', 'Copperbelt', 'Central', 'Southern', 'Eastern', 'Northern', 'Western', 'North-Western', 'Luapula'];
const VILLAGES = ['Mukuni', 'Matero', 'Chibolya', 'Kanyama', 'Mpulungu', 'Senanga', 'Kaoma', 'Siavonga', 'Mambwe', 'Nchelenge', 'Mkushi', 'Mumbwa', 'Choma', 'Mazabuka', 'Katete', 'Chadiza', 'Lundazi', 'Mkushi', 'Serenje', 'Mpika', 'Luwingu', 'Mporokoso', 'Kawambwa', 'Mwense', 'Nchelenge', 'Mwansabombwe', 'Samfya', 'Milenge', 'Mansa', 'Mwense'];
const OCCUPATIONS = ['Farmer', 'Teacher', 'Nurse', 'Trader', 'Miner', 'Driver', 'Carpenter', 'Fisherman', 'Tailor', 'Civil Servant', 'Electrician', 'Plumber', 'Mechanic', 'Security Guard', 'Shop Keeper', 'Cleaner', 'Soldier', 'Police Officer', 'Social Worker', 'Community Health Worker'];
const DWELLING_TYPES = ['Brick House', 'Mud House', 'Concrete Flat', 'Traditional Hut', 'Townhouse', 'Semi-detached House'];
const LAND_USES = ['Residential', 'Commercial', 'Agricultural', 'Industrial', 'Mixed Use', 'Conservation', 'Recreational'];
const DEPT_NAMES = ['Information Technology', 'Data Operations', 'Field Services', 'Compliance & Audit', 'Executive Management', 'Human Resources', 'Finance', 'Communications'];
const TEAM_NAMES = ['Data Collection Unit', 'Verification Squad', 'Quality Assurance', 'Rapid Response Team', 'Training & Support', 'Research & Analysis', 'Community Engagement', 'Monitoring & Evaluation'];
const CONNECTOR_TYPES = ['csv', 'rest_api'];

async function main() {
  console.log('\n=== OMNICORE AFRICA — MASSIVE RAW DATA SEED ===');
  console.log('   (Only inserting raw data — system handles detection, linking, suggestions, etc.)\n');

  // ===================================================================
  // CLEANUP — remove old data for this org so seed is re-runnable
  // ===================================================================
  console.log('[0/8] Cleaning existing data...');
  await prisma.entityProfile.deleteMany({ where: { organizationId: ORG_ID } });
  await prisma.recordTimelineEvent.deleteMany({ where: { organizationId: ORG_ID } });
  await prisma.recordRelationship.deleteMany({ where: { organizationId: ORG_ID } });
  await prisma.suggestion.deleteMany({ where: { organizationId: ORG_ID } });
  await prisma.recordVersion.deleteMany({ where: { goldenRecord: { organizationId: ORG_ID } } });
  await prisma.sourceRecord.deleteMany({ where: { goldenRecord: { organizationId: ORG_ID } } });
  await prisma.mergeHistory.deleteMany({ where: { entityDefinitionId: { in: (await prisma.entityDefinition.findMany({ where: { organizationId: ORG_ID }, select: { id: true } })).map((e: { id: string }) => e.id) } } });
  await prisma.goldenRecord.deleteMany({ where: { organizationId: ORG_ID } });
  await prisma.matchingRule.deleteMany({ where: { entityDefinitionId: { in: (await prisma.entityDefinition.findMany({ where: { organizationId: ORG_ID }, select: { id: true } })).map((e: { id: string }) => e.id) } } });
  await prisma.entityAttribute.deleteMany({ where: { entityDefinition: { organizationId: ORG_ID } } });
  await prisma.entityDefinition.deleteMany({ where: { organizationId: ORG_ID } });
  await prisma.autoLinkRule.deleteMany({ where: { organizationId: ORG_ID } });
  await prisma.validationResult.deleteMany({ where: { rule: { organizationId: ORG_ID } } });
  await prisma.validationRule.deleteMany({ where: { organizationId: ORG_ID } });
  await prisma.formSubmission.deleteMany({ where: { organizationId: ORG_ID } });
  await prisma.formDefinition.deleteMany({ where: { organizationId: ORG_ID } });
  await prisma.connectorRunItem.deleteMany({ where: { run: { job: { connector: { organizationId: ORG_ID } } } } });
  await prisma.connectorRun.deleteMany({ where: { job: { connector: { organizationId: ORG_ID } } } });
  await prisma.connectorJob.deleteMany({ where: { connector: { organizationId: ORG_ID } } });
  await prisma.connector.deleteMany({ where: { organizationId: ORG_ID } });
  await prisma.workflowTask.deleteMany({ where: { instance: { organizationId: ORG_ID } } });
  await prisma.workflowCompensation.deleteMany({ where: { instance: { organizationId: ORG_ID } } });
  await prisma.workflowInstance.deleteMany({ where: { organizationId: ORG_ID } });
  await prisma.workflowDefinition.deleteMany({ where: { organizationId: ORG_ID } });
  await prisma.dashboardWidget.deleteMany({ where: { dashboard: { organizationId: ORG_ID } } });
  await prisma.dashboard.deleteMany({ where: { organizationId: ORG_ID } });
  await prisma.savedSearch.deleteMany({ where: { organizationId: ORG_ID } });
  await prisma.accessPolicy.deleteMany({ where: { organizationId: ORG_ID } });
  await prisma.activityEvent.deleteMany({ where: { organizationId: ORG_ID } });
  await prisma.activitySubscription.deleteMany({ where: { organizationId: ORG_ID } });
  await prisma.notificationPreference.deleteMany({ where: { organizationId: ORG_ID } });
  await prisma.notification.deleteMany({ where: { organizationId: ORG_ID } });
  await prisma.notificationChannel.deleteMany({ where: { organizationId: ORG_ID } });
  await prisma.notificationTemplate.deleteMany({ where: { organizationId: ORG_ID } });
  await prisma.webhookDelivery.deleteMany({ where: { webhook: { organizationId: ORG_ID } } });
  await prisma.webhook.deleteMany({ where: { organizationId: ORG_ID } });
  await prisma.apiKeyUsageLog.deleteMany({ where: { organizationId: ORG_ID } });
  await prisma.apiKey.deleteMany({ where: { organizationId: ORG_ID } });
  await prisma.invitation.deleteMany({ where: { organizationId: ORG_ID } });
  await prisma.duplicateScanJob.deleteMany({ where: { organizationId: ORG_ID } });
  await prisma.userActivity.deleteMany({ where: { organizationId: ORG_ID } });
  await prisma.userAttribute.deleteMany({ where: { user: { organizationId: ORG_ID } } });
  await prisma.userRole.deleteMany({ where: { user: { organizationId: ORG_ID } } });
  await prisma.teamMember.deleteMany({ where: { team: { organizationId: ORG_ID } } });
  await prisma.team.deleteMany({ where: { organizationId: ORG_ID } });
  await prisma.department.deleteMany({ where: { organizationId: ORG_ID } });
  await prisma.user.deleteMany({ where: { organizationId: ORG_ID } });
  await prisma.role.deleteMany({ where: { organizationId: ORG_ID } });
  console.log('   Old data cleaned');

  // ===================================================================
  // 1. ORGANIZATION
  // ===================================================================
  console.log('[1/8] Organization...');
  const org = await prisma.organization.upsert({
    where: { id: ORG_ID },
    update: {},
    create: {
      id: ORG_ID,
      name: 'OmniCore Africa HQ',
      slug: 'omnicore-hq',
      domain: 'omnicore.africa',
      primaryContactEmail: 'hq@omnicore.africa',
      phone: '+260 123 456789',
      isActive: true,
      subscriptionTier: 'enterprise',
      maxApiKeys: 50,
      settings: { theme: 'dark', timezone: 'Africa/Lusaka', dateFormat: 'DD/MM/YYYY', language: 'en' },
    },
  });
  console.log(`   ${org.name} (${org.id})`);

  // ===================================================================
  // 2. DEPARTMENTS
  // ===================================================================
  console.log('[2/8] Departments...');
  const depts = await Promise.all(
    DEPT_NAMES.map((name) =>
      prisma.department.create({ data: { name, organizationId: ORG_ID } })
    )
  );
  console.log(`   ${depts.length} departments`);

  // ===================================================================
  // 3. ROLES (system roles + custom)
  // ===================================================================
  console.log('[3/8] Roles...');
  const roleDefs = [
    { name: 'Admin', description: 'Full system access', isSys: true, perms: ['*:*'] },
    { name: 'Organization Admin', description: 'Org-wide management', isSys: true, perms: ['records:*', 'forms:*', 'workflows:*', 'dashboards:*', 'reports:*', 'users:manage', 'exports:*', 'templates:*', 'settings:manage', 'connectors:*', 'notifications:*', 'webhooks:*'] },
    { name: 'Data Manager', description: 'Manages data', isSys: true, perms: ['records:read', 'records:create', 'records:update', 'records:delete', 'forms:submit', 'forms:read', 'forms:manage', 'workflows:view', 'workflows:approve', 'dashboards:view', 'dashboards:create', 'reports:view', 'reports:create', 'exports:create', 'connectors:view', 'connectors:run'] },
    { name: 'Data Entry', description: 'Enters records', isSys: true, perms: ['records:read', 'records:create', 'forms:submit', 'forms:read', 'dashboards:view'] },
    { name: 'Reviewer', description: 'Reviews & approves', isSys: true, perms: ['records:read', 'forms:read', 'workflows:view', 'workflows:approve', 'dashboards:view', 'reports:view'] },
    { name: 'Viewer', description: 'Read-only access', isSys: true, perms: ['records:read', 'forms:read', 'dashboards:view', 'reports:view'] },
    { name: 'Field Coordinator', description: 'Coordinates field ops', isSys: false, perms: ['records:read', 'records:create', 'records:update', 'forms:submit', 'forms:read'] },
    { name: 'Auditor', description: 'Reviews audit data', isSys: false, perms: ['records:read', 'reports:view', 'workflows:view'] },
  ];
  const roles = await Promise.all(
    roleDefs.map((r) =>
      prisma.role.upsert({
        where: { organizationId_name: { organizationId: ORG_ID, name: r.name } },
        update: { description: r.description, permissions: r.perms },
        create: { name: r.name, description: r.description, isSystemRole: r.isSys, permissions: r.perms, organizationId: ORG_ID },
      })
    )
  );
  console.log(`   ${roles.length} roles`);

  // ===================================================================
  // 4. USERS (25 users across departments)
  // ===================================================================
  console.log('[4/8] Users...');
  const userDefs = [
    { first: 'John', last: 'Admin', email: 'admin@omnicore.africa', job: 'System Administrator', dept: 0, role: 0 },
    { first: 'Sarah', last: 'Manager', email: 'sarah@omnicore.africa', job: 'Org Operations Manager', dept: 4, role: 1 },
    { first: 'Michael', last: 'Banda', email: 'michael.banda@omnicore.africa', job: 'Senior Data Manager', dept: 1, role: 2 },
    { first: 'Jane', last: 'Mwewa', email: 'jane.mwewa@omnicore.africa', job: 'Data Entry Officer', dept: 1, role: 3 },
    { first: 'David', last: 'Chilufya', email: 'david.chilufya@omnicore.africa', job: 'Field Data Collector', dept: 2, role: 6 },
    { first: 'Grace', last: 'Musonda', email: 'grace.musonda@omnicore.africa', job: 'Compliance Officer', dept: 3, role: 7 },
    { first: 'Peter', last: 'Mwila', email: 'peter.mwila@omnicore.africa', job: 'Data Analyst', dept: 1, role: 2 },
    { first: 'Elizabeth', last: 'Tembo', email: 'elizabeth.tembo@omnicore.africa', job: 'Field Coordinator', dept: 2, role: 6 },
    { first: 'Joseph', last: 'Phiri', email: 'joseph.phiri@omnicore.africa', job: 'IT Support Engineer', dept: 0, role: 3 },
    { first: 'Catherine', last: 'Zulu', email: 'catherine.zulu@omnicore.africa', job: 'Data Entry Officer', dept: 1, role: 3 },
    { first: 'Samuel', last: 'Banda', email: 'samuel.banda@omnicore.africa', job: 'Field Supervisor', dept: 2, role: 6 },
    { first: 'Alice', last: 'Mulenga', email: 'alice.mulenga@omnicore.africa', job: 'Internal Auditor', dept: 3, role: 7 },
    { first: 'Patrick', last: 'Kasonde', email: 'patrick.kasonde@omnicore.africa', job: 'Data Manager', dept: 1, role: 2 },
    { first: 'Ruth', last: 'Mwale', email: 'ruth.mwale@omnicore.africa', job: 'Viewer (Read-Only)', dept: 1, role: 5 },
    { first: 'Felix', last: 'Nyanga', email: 'felix.nyanga@omnicore.africa', job: 'Field Data Collector', dept: 2, role: 3 },
    { first: 'Agnes', last: 'Chisanga', email: 'agnes.chisanga@omnicore.africa', job: 'HR Officer', dept: 5, role: 5 },
    { first: 'Kennedy', last: 'Mumba', email: 'kennedy.mumba@omnicore.africa', job: 'Finance Officer', dept: 6, role: 5 },
    { first: 'Esther', last: 'Lungu', email: 'esther.lungu@omnicore.africa', job: 'Communications Officer', dept: 7, role: 5 },
    { first: 'Brian', last: 'Sakala', email: 'brian.sakala@omnicore.africa', job: 'Field Data Collector', dept: 2, role: 3 },
    { first: 'Nancy', last: 'Chama', email: 'nancy.chama@omnicore.africa', job: 'Data Entry Officer', dept: 1, role: 3 },
    { first: 'Raymond', last: 'Mkandawire', email: 'raymond.mkandawire@omnicore.africa', job: 'M&E Officer', dept: 1, role: 4 },
    { first: 'Beatrice', last: 'Gondwe', email: 'beatrice.gondwe@omnicore.africa', job: 'Field Coordinator', dept: 2, role: 6 },
    { first: 'Stephen', last: 'Kamanga', email: 'stephen.kamanga@omnicore.africa', job: 'Data Manager', dept: 1, role: 2 },
    { first: 'Lydia', last: 'Nyirenda', email: 'lydia.nyirenda@omnicore.africa', job: 'Viewer (Read-Only)', dept: 1, role: 5 },
    { first: 'Inactive', last: 'User', email: 'inactive@omnicore.africa', job: 'Former Employee', dept: 1, role: 3, active: false },
  ];
  const users = await Promise.all(
    userDefs.map((u, i) =>
      prisma.user.create({
        data: {
          email: u.email,
          keycloakUserId: `kc-user-${String(i + 1).padStart(3, '0')}`,
          username: u.email.split('@')[0],
          firstName: u.first,
          lastName: u.last,
          jobTitle: u.job,
          departmentId: depts[u.dept].id,
          isActive: u.active !== false,
          timezone: 'Africa/Lusaka',
          locale: 'en',
          phone: `+2607${String(700000000 + i).slice(0, 9)}`,
          avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.first}`,
          preferences: { emailNotifications: true, theme: i % 2 === 0 ? 'dark' : 'light' },
          lastLoginAt: u.active !== false ? daysAgo(randInt(0, 30)) : null,
          lastActiveAt: u.active !== false ? daysAgo(randInt(0, 7)) : null,
          organizationId: ORG_ID,
        },
      })
    )
  );
  // Assign roles
  await Promise.all(
    userDefs.map((u, i) =>
      prisma.userRole.create({ data: { userId: users[i].id, roleId: roles[u.role].id } }).catch(() => {})
    )
  );
  // Extra roles for some users
  const extraRoles: [number, number][] = [[3, 4], [4, 6], [7, 2], [11, 4], [13, 3], [21, 2]];
  await Promise.all(
    extraRoles.map(([ui, ri]) =>
      prisma.userRole.create({ data: { userId: users[ui].id, roleId: roles[ri].id } }).catch(() => {})
    )
  );
  console.log(`   ${users.length} users with roles`);

  // ===================================================================
  // 5. TEAMS & MEMBERS
  // ===================================================================
  console.log('[5/8] Teams & Members...');
  const teamDefs = [
    { name: 'Data Collection Unit', desc: 'Field data gathering team', lead: 4 },
    { name: 'Verification Squad', desc: 'Validates collected data', lead: 7 },
    { name: 'Quality Assurance', desc: 'Data accuracy & compliance', lead: 5 },
    { name: 'Rapid Response Team', desc: 'Emergency data ops', lead: 11 },
    { name: 'Training & Support', desc: 'User training & helpdesk', lead: 8 },
    { name: 'Research & Analysis', desc: 'Data analysis & insights', lead: 6 },
    { name: 'Community Engagement', desc: 'Community liaison', lead: 18 },
    { name: 'Monitoring & Evaluation', desc: 'Impact assessment', lead: 21 },
  ];
  const teams = await Promise.all(
    teamDefs.map((t) =>
      prisma.team.create({ data: { name: t.name, description: t.desc, organizationId: ORG_ID, createdBy: users[t.lead].id } })
    )
  );

  // Assign members to teams
  const teamMembers: { teamIdx: number; userIdx: number; role: string }[] = [];
  teamDefs.forEach((t, ti) => {
    teamMembers.push({ teamIdx: ti, userIdx: t.lead, role: 'owner' });
    const candidates = users.map((u, i) => i).filter((i) => i !== t.lead);
    const memberCount = randInt(3, 6);
    for (let m = 0; m < memberCount; m++) {
      const idx = pick(candidates);
      teamMembers.push({ teamIdx: ti, userIdx: idx, role: pick(['member', 'member', 'member', 'manager']) });
      candidates.splice(candidates.indexOf(idx), 1);
      if (candidates.length === 0) break;
    }
  });
  await Promise.all(
    teamMembers.map((m) =>
      prisma.teamMember
        .create({ data: { teamId: teams[m.teamIdx].id, userId: users[m.userIdx].id, role: m.role, invitedBy: users[0].id } })
        .catch(() => {})
    )
  );
  console.log(`   ${teams.length} teams, ${teamMembers.length} members`);

  // ===================================================================
  // 6. ENTITY DEFINITIONS & ATTRIBUTES
  // ===================================================================
  console.log('[6/8] Entity Definitions...');

  const beneficiaryDef = await prisma.entityDefinition.create({
    data: {
      name: 'Beneficiary',
      description: 'Social program beneficiary',
      organizationId: ORG_ID,
      attributes: {
        create: [
          { name: 'firstName', displayName: 'First Name', dataType: 'string', isRequired: true, sortOrder: 1 },
          { name: 'lastName', displayName: 'Last Name', dataType: 'string', isRequired: true, sortOrder: 2 },
          { name: 'fullName', displayName: 'Full Name', dataType: 'string', sortOrder: 3 },
          { name: 'nrc', displayName: 'NRC Number', dataType: 'string', isRequired: true, isIdentifier: true, sortOrder: 4 },
          { name: 'phone', displayName: 'Phone Number', dataType: 'string', sortOrder: 5 },
          { name: 'email', displayName: 'Email', dataType: 'string', sortOrder: 6 },
          { name: 'dob', displayName: 'Date of Birth', dataType: 'date', sortOrder: 7 },
          { name: 'gender', displayName: 'Gender', dataType: 'string', sortOrder: 8 },
          { name: 'nationality', displayName: 'Nationality', dataType: 'string', sortOrder: 9 },
          { name: 'maritalStatus', displayName: 'Marital Status', dataType: 'string', sortOrder: 10 },
          { name: 'education', displayName: 'Education Level', dataType: 'string', sortOrder: 11 },
          { name: 'occupation', displayName: 'Occupation', dataType: 'string', sortOrder: 12 },
          { name: 'district', displayName: 'District', dataType: 'string', sortOrder: 13 },
          { name: 'province', displayName: 'Province', dataType: 'string', sortOrder: 14 },
          { name: 'village', displayName: 'Village', dataType: 'string', sortOrder: 15 },
          { name: 'ward', displayName: 'Ward', dataType: 'string', sortOrder: 16 },
          { name: 'constituency', displayName: 'Constituency', dataType: 'string', sortOrder: 17 },
          { name: 'householdSize', displayName: 'Household Size', dataType: 'number', sortOrder: 18 },
          { name: 'monthlyIncome', displayName: 'Monthly Income (ZMW)', dataType: 'number', sortOrder: 19 },
          { name: 'hasDisability', displayName: 'Has Disability', dataType: 'string', sortOrder: 20 },
          { name: 'registrationDate', displayName: 'Registration Date', dataType: 'date', sortOrder: 21 },
          { name: 'programEnrolled', displayName: 'Program Enrolled', dataType: 'string', sortOrder: 22 },
          { name: 'caseWorker', displayName: 'Case Worker', dataType: 'string', sortOrder: 23 },
          { name: 'bankBranch', displayName: 'Bank Branch', dataType: 'string', sortOrder: 24 },
          { name: 'accountNumber', displayName: 'Account Number', dataType: 'string', sortOrder: 25 },
          { name: 'latitude', displayName: 'Latitude', dataType: 'number', sortOrder: 26 },
          { name: 'longitude', displayName: 'Longitude', dataType: 'number', sortOrder: 27 },
        ],
      },
    },
  });

  const householdDef = await prisma.entityDefinition.create({
    data: {
      name: 'Household',
      description: 'Household unit for social programs',
      organizationId: ORG_ID,
      attributes: {
        create: [
          { name: 'householdCode', displayName: 'Household Code', dataType: 'string', isRequired: true, isIdentifier: true, sortOrder: 1 },
          { name: 'headName', displayName: 'Head of Household', dataType: 'string', isRequired: true, sortOrder: 2 },
          { name: 'headNrc', displayName: 'Head NRC', dataType: 'string', isRequired: true, isIdentifier: true, sortOrder: 3 },
          { name: 'headGender', displayName: 'Head Gender', dataType: 'string', sortOrder: 4 },
          { name: 'headPhone', displayName: 'Head Phone', dataType: 'string', sortOrder: 5 },
          { name: 'village', displayName: 'Village', dataType: 'string', isRequired: true, sortOrder: 6 },
          { name: 'district', displayName: 'District', dataType: 'string', isRequired: true, sortOrder: 7 },
          { name: 'province', displayName: 'Province', dataType: 'string', sortOrder: 8 },
          { name: 'ward', displayName: 'Ward', dataType: 'string', sortOrder: 9 },
          { name: 'totalMembers', displayName: 'Total Members', dataType: 'number', sortOrder: 10 },
          { name: 'totalIncome', displayName: 'Monthly Income (ZMW)', dataType: 'number', sortOrder: 11 },
          { name: 'hasElectricity', displayName: 'Has Electricity', dataType: 'string', sortOrder: 12 },
          { name: 'hasCleanWater', displayName: 'Has Clean Water', dataType: 'string', sortOrder: 13 },
          { name: 'hasSanitation', displayName: 'Has Sanitation', dataType: 'string', sortOrder: 14 },
          { name: 'dwellingType', displayName: 'Dwelling Type', dataType: 'string', sortOrder: 15 },
          { name: 'ownsLivestock', displayName: 'Owns Livestock', dataType: 'string', sortOrder: 16 },
          { name: 'cultivatesLand', displayName: 'Cultivates Land', dataType: 'string', sortOrder: 17 },
          { name: 'foodSecure', displayName: 'Food Secure', dataType: 'string', sortOrder: 18 },
          { name: 'distanceToClinic', displayName: 'Distance to Clinic (km)', dataType: 'number', sortOrder: 19 },
          { name: 'distanceToSchool', displayName: 'Distance to School (km)', dataType: 'number', sortOrder: 20 },
          { name: 'latitude', displayName: 'Latitude', dataType: 'number', sortOrder: 21 },
          { name: 'longitude', displayName: 'Longitude', dataType: 'number', sortOrder: 22 },
        ],
      },
    },
  });

  const landParcelDef = await prisma.entityDefinition.create({
    data: {
      name: 'Land Parcel',
      description: 'Land & property records',
      organizationId: ORG_ID,
      attributes: {
        create: [
          { name: 'parcelNumber', displayName: 'Parcel Number', dataType: 'string', isRequired: true, isIdentifier: true, sortOrder: 1 },
          { name: 'titleDeedNumber', displayName: 'Title Deed', dataType: 'string', sortOrder: 2 },
          { name: 'ownerName', displayName: 'Owner Name', dataType: 'string', isRequired: true, sortOrder: 3 },
          { name: 'ownerNrc', displayName: 'Owner NRC', dataType: 'string', isRequired: true, isIdentifier: true, sortOrder: 4 },
          { name: 'ownerPhone', displayName: 'Owner Phone', dataType: 'string', sortOrder: 5 },
          { name: 'location', displayName: 'Location', dataType: 'text', sortOrder: 6 },
          { name: 'district', displayName: 'District', dataType: 'string', isRequired: true, sortOrder: 7 },
          { name: 'ward', displayName: 'Ward', dataType: 'string', sortOrder: 8 },
          { name: 'sizeHectares', displayName: 'Size (Ha)', dataType: 'number', sortOrder: 9 },
          { name: 'landUse', displayName: 'Land Use', dataType: 'string', sortOrder: 10 },
          { name: 'isRegistered', displayName: 'Is Registered', dataType: 'string', sortOrder: 11 },
          { name: 'registrationDate', displayName: 'Registration Date', dataType: 'date', sortOrder: 12 },
          { name: 'marketValue', displayName: 'Market Value (ZMW)', dataType: 'number', sortOrder: 13 },
          { name: 'latitude', displayName: 'Latitude', dataType: 'number', sortOrder: 14 },
          { name: 'longitude', displayName: 'Longitude', dataType: 'number', sortOrder: 15 },
        ],
      },
    },
  });

  const schoolDef = await prisma.entityDefinition.create({
    data: {
      name: 'School',
      description: 'Educational institution records',
      organizationId: ORG_ID,
      attributes: {
        create: [
          { name: 'schoolName', displayName: 'School Name', dataType: 'string', isRequired: true, sortOrder: 1 },
          { name: 'schoolCode', displayName: 'School Code', dataType: 'string', isRequired: true, isIdentifier: true, sortOrder: 2 },
          { name: 'schoolType', displayName: 'School Type', dataType: 'string', sortOrder: 3 },
          { name: 'district', displayName: 'District', dataType: 'string', isRequired: true, sortOrder: 4 },
          { name: 'province', displayName: 'Province', dataType: 'string', sortOrder: 5 },
          { name: 'headTeacher', displayName: 'Head Teacher', dataType: 'string', sortOrder: 6 },
          { name: 'totalStudents', displayName: 'Total Students', dataType: 'number', sortOrder: 7 },
          { name: 'totalTeachers', displayName: 'Total Teachers', dataType: 'number', sortOrder: 8 },
          { name: 'hasLibrary', displayName: 'Has Library', dataType: 'string', sortOrder: 9 },
          { name: 'hasComputerLab', displayName: 'Has Computer Lab', dataType: 'string', sortOrder: 10 },
          { name: 'hasWater', displayName: 'Has Water', dataType: 'string', sortOrder: 11 },
          { name: 'hasElectricity', displayName: 'Has Electricity', dataType: 'string', sortOrder: 12 },
          { name: 'latitude', displayName: 'Latitude', dataType: 'number', sortOrder: 13 },
          { name: 'longitude', displayName: 'Longitude', dataType: 'number', sortOrder: 14 },
          { name: 'status', displayName: 'Status', dataType: 'string', sortOrder: 15 },
        ],
      },
    },
  });
  console.log('   4 entity defs: Beneficiary, Household, Land Parcel, School');

  // ===================================================================
  // 7. MATCHING RULES (so system knows how to detect duplicates)
  // ===================================================================
  console.log('[7/8] Matching Rules & Auto-Link Rules...');
  await Promise.all([
    prisma.matchingRule.create({ data: { entityDefinitionId: beneficiaryDef.id, name: 'Exact NRC Match', ruleType: 'exact', fieldWeights: { nrc: 1.0 }, threshold: 1.0, isActive: true } }),
    prisma.matchingRule.create({ data: { entityDefinitionId: beneficiaryDef.id, name: 'Exact Phone Match', ruleType: 'exact', fieldWeights: { phone: 1.0 }, threshold: 1.0, isActive: true } }),
    prisma.matchingRule.create({ data: { entityDefinitionId: beneficiaryDef.id, name: 'Fuzzy Name+District', ruleType: 'fuzzy', fieldWeights: { firstName: 0.2, lastName: 0.25, district: 0.25, village: 0.15, occupation: 0.15 }, threshold: 0.7, isActive: true } }),
    prisma.matchingRule.create({ data: { entityDefinitionId: beneficiaryDef.id, name: 'Fuzzy Name+Village', ruleType: 'fuzzy', fieldWeights: { firstName: 0.2, lastName: 0.3, village: 0.3, gender: 0.2 }, threshold: 0.65, isActive: true } }),
    prisma.matchingRule.create({ data: { entityDefinitionId: householdDef.id, name: 'Household Code Exact', ruleType: 'exact', fieldWeights: { householdCode: 1.0 }, threshold: 1.0, isActive: true } }),
    prisma.matchingRule.create({ data: { entityDefinitionId: householdDef.id, name: 'Head NRC Exact', ruleType: 'exact', fieldWeights: { headNrc: 1.0 }, threshold: 1.0, isActive: true } }),
    prisma.matchingRule.create({ data: { entityDefinitionId: landParcelDef.id, name: 'Parcel Number Exact', ruleType: 'exact', fieldWeights: { parcelNumber: 1.0 }, threshold: 1.0, isActive: true } }),
    prisma.matchingRule.create({ data: { entityDefinitionId: landParcelDef.id, name: 'Owner NRC Exact', ruleType: 'exact', fieldWeights: { ownerNrc: 1.0 }, threshold: 1.0, isActive: true } }),
    prisma.matchingRule.create({ data: { entityDefinitionId: schoolDef.id, name: 'School Code Exact', ruleType: 'exact', fieldWeights: { schoolCode: 1.0 }, threshold: 1.0, isActive: true } }),
  ]);

  // Auto-link rules (system uses these to create relationships)
  await Promise.all([
    prisma.autoLinkRule.create({ data: { organizationId: ORG_ID, name: 'Beneficiary → Household by NRC', sourceEntityType: 'Beneficiary', targetEntityType: 'Household', fieldMappings: [{ sourceField: 'nrc', targetField: 'headNrc', matchType: 'exact' }], relationshipType: 'household_member', autoAcceptAbove: 0.9, suggestAbove: 0.6, isActive: true, priority: 10 } }),
    prisma.autoLinkRule.create({ data: { organizationId: ORG_ID, name: 'Land Parcel → Beneficiary by NRC', sourceEntityType: 'Land Parcel', targetEntityType: 'Beneficiary', fieldMappings: [{ sourceField: 'ownerNrc', targetField: 'nrc', matchType: 'exact' }], relationshipType: 'property_owner', autoAcceptAbove: 0.9, suggestAbove: 0.6, isActive: true, priority: 8 } }),
    prisma.autoLinkRule.create({ data: { organizationId: ORG_ID, name: 'Beneficiary Same Village', sourceEntityType: 'Beneficiary', targetEntityType: 'Beneficiary', fieldMappings: [{ sourceField: 'village', targetField: 'village', matchType: 'exact' }], relationshipType: 'neighbor', autoAcceptAbove: 0.8, suggestAbove: 0.5, isActive: true, priority: 5 } }),
    prisma.autoLinkRule.create({ data: { organizationId: ORG_ID, name: 'Household → Land Parcel by District', sourceEntityType: 'Household', targetEntityType: 'Land Parcel', fieldMappings: [{ sourceField: 'district', targetField: 'district', matchType: 'exact' }], relationshipType: 'resides_on', autoAcceptAbove: 0.75, suggestAbove: 0.4, isActive: true, priority: 3 } }),
    prisma.autoLinkRule.create({ data: { organizationId: ORG_ID, name: 'Household Same Village', sourceEntityType: 'Household', targetEntityType: 'Household', fieldMappings: [{ sourceField: 'village', targetField: 'village', matchType: 'exact' }], relationshipType: 'neighbor_household', autoAcceptAbove: 0.85, suggestAbove: 0.5, isActive: true, priority: 4 } }),
  ]);
  console.log('   9 matching rules + 5 auto-link rules');

  // ===================================================================
  // 8. RAW GOLDEN RECORDS — SYSTEM WILL HANDLE THE REST
  // ===================================================================
  console.log('[8/8] Raw Golden Records...');
  const records: any[] = [];
  const systemUserId = users[0].id;

  // --- BENEFICIARIES (150 records) ---
  const genders = ['Male', 'Female'];
  const maritalStatuses = ['Single', 'Married', 'Divorced', 'Widowed', 'Separated'];
  const educationLevels = ['None', 'Primary', 'Junior Secondary', 'Senior Secondary', 'Certificate', 'Diploma', 'Degree'];
  const programs = ['Social Cash Transfer', 'Food Security Pack', 'FISP', 'School Bursary', 'Public Works', 'Health Insurance', 'Nutrition Support', 'Emergency Relief', 'Skills Training', 'Womens Empowerment'];
  const yesNo = ['Yes', 'No'];
  const wards = ['Ward 1', 'Ward 2', 'Ward 3', 'Ward 4', 'Ward 5', 'Ward 6', 'Ward 7', 'Ward 8', 'Ward 9', 'Ward 10'];
  const constituencies = ['Central', 'Matero', 'Munyaule', 'Chifubu', 'Nkana', 'Kamfinsa', 'Kwacha', 'Mandevu'];

  // --- NRC POOL with built-in duplicates ---
  // Layout: indices 0-129 = unique NRCs, 130-149 = copies creating exact duplicates
  const nrcPool: string[] = [];
  for (let i = 0; i < 130; i++) {
    nrcPool.push(`${randInt(100000, 999999)}/${randInt(10, 99)}/${randInt(1, 9)}`);
  }
  // 3 NRCs appear 3 times (triplicates at indices 0,1,2)
  nrcPool.push(nrcPool[0]);  // 130 = copy of 0  (2nd copy)
  nrcPool.push(nrcPool[1]);  // 131 = copy of 1  (2nd copy)
  nrcPool.push(nrcPool[2]);  // 132 = copy of 2  (2nd copy)
  nrcPool.push(nrcPool[0]);  // 133 = copy of 0  (3rd copy)
  nrcPool.push(nrcPool[1]);  // 134 = copy of 1  (3rd copy)
  nrcPool.push(nrcPool[2]);  // 135 = copy of 2  (3rd copy)
  // 14 NRCs appear 2 times (duplicates at indices 3-16)
  for (let d = 0; d < 14; d++) {
    nrcPool.push(nrcPool[3 + d]); // 136-149 = copies of indices 3-16
  }

  // Shared phone number pool
  const sharedPhones: string[] = [];
  for (let p = 0; p < 5; p++) {
    sharedPhones.push(`+2607${String(randInt(700000000, 799999999))}`);
  }

  function generateBeneficiary(i: number) {
    const fn = pick(FIRST_NAMES);
    const ln = pick(LAST_NAMES);
    const nrc = nrcPool[i];
    const district = pick(DISTRICTS);
    const province = pick(PROVINCES);
    const village = pick(VILLAGES);
    const gender = pick(genders);
    const dobDay = randInt(1, 28);
    const dobMonth = randInt(1, 12);
    const dobYear = randInt(1950, 2003);
    // Make ~1/3 of records share a phone with another
    const useSharedPhone = i % 3 === 0 && i < 140;
    const phone = useSharedPhone && i < 135
      ? pick(sharedPhones)
      : `+2607${String(randInt(700000000, 799999999))}`;

    return {
      entityDefinitionId: beneficiaryDef.id,
      organizationId: ORG_ID,
      hashedIdentifier: hashIdentifier(nrc),
      externalId: `BEN-${String(i + 1).padStart(4, '0')}`,
      data: {
        firstName: fn,
        lastName: ln,
        fullName: `${fn} ${ln}`,
        nrc,
        phone,
        email: `${fn.toLowerCase()}.${ln.toLowerCase()}.${i}@example.com`,
        dob: `${dobYear}-${String(dobMonth).padStart(2, '0')}-${String(dobDay).padStart(2, '0')}`,
        gender,
        nationality: 'Zambian',
        maritalStatus: pick(maritalStatuses),
        education: pick(educationLevels),
        occupation: pick(OCCUPATIONS),
        district,
        province,
        village,
        ward: pick(wards),
        constituency: pick(constituencies),
        householdSize: randInt(1, 12),
        monthlyIncome: randInt(200, 8000),
        hasDisability: pick(yesNo),
        registrationDate: `${randInt(2020, 2025)}-${String(randInt(1, 12)).padStart(2, '0')}-${String(randInt(1, 28)).padStart(2, '0')}`,
        programEnrolled: pick(programs),
        caseWorker: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
        bankBranch: pick(['Bank of Zambia', 'ZANACO', 'Stanbic', 'Barclays', 'FNB', 'ABSA', 'Indo-Zambia']),
        accountNumber: `ACC-${String(randInt(10000, 99999))}`,
        latitude: parseFloat((-15 - Math.random() * 10).toFixed(6)),
        longitude: parseFloat((27 + Math.random() * 6).toFixed(6)),
      },
      status: 'active',
      matchConfidence: 1.0,
      createdBy: pick(users).id,
    };
  }

  for (let i = 0; i < 150; i++) {
    const rec = generateBeneficiary(i);
    // Override status for some records to be non-active (system shouldn't match on these)
    if (i >= 145) {
      rec.status = 'archived';
    }
    records.push(rec);
  }

  // --- HOUSEHOLDS (60 records, some head NRCs match beneficiary NRCs) ---
  for (let i = 0; i < 60; i++) {
    const matchedNrc = i < 25 ? nrcPool[i] : `${randInt(100000, 999999)}/${randInt(10, 99)}/${randInt(1, 9)}`;
    const district = pick(DISTRICTS);
    records.push({
      entityDefinitionId: householdDef.id,
      organizationId: ORG_ID,
      hashedIdentifier: hashIdentifier(`HH-${String(randInt(1000, 99999))}`),
      externalId: `HH-${String(i + 1).padStart(4, '0')}`,
      data: {
        householdCode: `HH-${String(randInt(10000, 99999))}`,
        headName: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
        headNrc: matchedNrc,
        headGender: pick(genders),
        headPhone: `+2607${String(randInt(700000000, 799999999))}`,
        village: pick(VILLAGES),
        district,
        province: pick(PROVINCES),
        ward: pick(wards),
        totalMembers: randInt(1, 15),
        totalIncome: randInt(300, 12000),
        hasElectricity: pick(yesNo),
        hasCleanWater: pick(yesNo),
        hasSanitation: pick(yesNo),
        dwellingType: pick(DWELLING_TYPES),
        ownsLivestock: pick(yesNo),
        cultivatesLand: pick(yesNo),
        foodSecure: pick(yesNo),
        distanceToClinic: parseFloat((Math.random() * 15).toFixed(1)),
        distanceToSchool: parseFloat((Math.random() * 10).toFixed(1)),
        latitude: parseFloat((-15 - Math.random() * 10).toFixed(6)),
        longitude: parseFloat((27 + Math.random() * 6).toFixed(6)),
      },
      status: 'active',
      matchConfidence: 1.0,
      createdBy: pick(users).id,
    });
  }

  // --- LAND PARCELS (40 records, some owner NRCs match beneficiary NRCs) ---
  const parcelPrefixes = ['LUS', 'NDL', 'KIT', 'KAB', 'LIV', 'CHI', 'MUF', 'LUA', 'CHP', 'KAS', 'SOL', 'MNS', 'MGB', 'MPK', 'SRJ', 'KFW', 'MZB', 'SNS', 'CHI', 'MPS'];
  for (let i = 0; i < 40; i++) {
    const prefix = pick(parcelPrefixes);
    const parcelNum = `${prefix}/${String(randInt(1000, 9999))}/${String(randInt(1, 100))}`;
    const matchedOwnerNrc = i < 20 ? nrcPool[i + 50] : `${randInt(100000, 999999)}/${randInt(10, 99)}/${randInt(1, 9)}`;
    records.push({
      entityDefinitionId: landParcelDef.id,
      organizationId: ORG_ID,
      hashedIdentifier: hashIdentifier(parcelNum),
      externalId: `LP-${String(i + 1).padStart(3, '0')}`,
      data: {
        parcelNumber: parcelNum,
        titleDeedNumber: i % 3 === 0 ? `TD-${String(randInt(10000, 99999))}/${randInt(2020, 2025)}` : null,
        ownerName: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
        ownerNrc: matchedOwnerNrc,
        ownerPhone: `+2607${String(randInt(700000000, 799999999))}`,
        location: `${randInt(1, 500)} ${pick(['Great East Road', 'Independence Ave', 'Cairo Road', 'Freedom Way', 'Katima Mulilo Road', 'Mosi-oa-Tunya Road', 'Kafue Road'])}`,
        district: pick(DISTRICTS),
        ward: pick(wards),
        sizeHectares: parseFloat((Math.random() * 100 + 0.2).toFixed(2)),
        landUse: pick(LAND_USES),
        isRegistered: pick(yesNo),
        registrationDate: `${randInt(2015, 2025)}-${String(randInt(1, 12)).padStart(2, '0')}-${String(randInt(1, 28)).padStart(2, '0')}`,
        marketValue: randInt(50000, 5000000),
        latitude: parseFloat((-15 - Math.random() * 10).toFixed(6)),
        longitude: parseFloat((27 + Math.random() * 6).toFixed(6)),
      },
      status: 'active',
      matchConfidence: 1.0,
      createdBy: pick(users).id,
    });
  }

  // --- SCHOOLS (20 records) ---
  const schoolTypes = ['Primary', 'Secondary', 'Combined', 'Community', 'Private'];
  for (let i = 0; i < 20; i++) {
    const schoolName = `${pick(['Mukuni', 'Matero', 'Chibolya', 'Kanyama', 'Mpulungu', 'Senanga', 'Kaoma', 'Siavonga', 'Libala', 'Kabwata', 'Chilenje', 'Chelstone', 'Makeni', 'Ibex Hill', 'Woodlands', 'Rhodes Park', 'Avondale', 'Lilayi', 'Chamba Valley', 'Mtendere'])} ${pick(['Primary', 'Basic', 'Secondary', 'High', 'Community'])} School`;
    records.push({
      entityDefinitionId: schoolDef.id,
      organizationId: ORG_ID,
      hashedIdentifier: hashIdentifier(`SCH-${String(randInt(1000, 9999))}`),
      externalId: `SCH-${String(i + 1).padStart(3, '0')}`,
      data: {
        schoolName,
        schoolCode: `SCH-${String(randInt(1000, 9999))}`,
        schoolType: pick(schoolTypes),
        district: pick(DISTRICTS),
        province: pick(PROVINCES),
        headTeacher: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
        totalStudents: randInt(100, 3000),
        totalTeachers: randInt(5, 80),
        hasLibrary: pick(yesNo),
        hasComputerLab: pick(yesNo),
        hasWater: pick(yesNo),
        hasElectricity: pick(yesNo),
        latitude: parseFloat((-15 - Math.random() * 10).toFixed(6)),
        longitude: parseFloat((27 + Math.random() * 6).toFixed(6)),
        status: pick(['Active', 'Active', 'Active', 'Inactive']),
      },
      status: 'active',
      matchConfidence: 1.0,
      createdBy: pick(users).id,
    });
  }

  // Bulk insert all golden records
  let inserted = 0;
  const BATCH = 20;
  for (let i = 0; i < records.length; i += BATCH) {
    const batch = records.slice(i, i + BATCH);
    await Promise.all(batch.map((r: any) => prisma.goldenRecord.create({ data: r })));
    inserted += batch.length;
    if (inserted % 50 === 0 || inserted === records.length) {
      console.log(`   ${inserted}/${records.length} golden records inserted...`);
    }
  }
  console.log(`   ✅ ${records.length} total golden records seeded`);
  console.log(`      - 150 Beneficiaries (with exact NRC dups, shared phones, partial matches)`);
  console.log(`      - 60 Households (25 with head NRCs matching beneficiaries)`);
  console.log(`      - 40 Land Parcels (20 with owner NRCs matching beneficiaries)`);
  console.log(`      - 20 Schools (full entity)`);

  // ===================================================================
  // SUMMARY
  // ===================================================================
  console.log('\n' + '='.repeat(60));
  console.log('  ✅ MASSIVE RAW DATA SEED COMPLETE');
  console.log('='.repeat(60));
  console.log(`\n  ORGANIZATION     : ${org.name}`);
  console.log(`  DEPARTMENTS      : ${depts.length}`);
  console.log(`  ROLES            : ${roles.length}`);
  console.log(`  USERS            : ${users.length}`);
  console.log(`  TEAMS            : ${teams.length} (${teamMembers.length} members)`);
  console.log(`  ENTITIES         : 4 (Beneficiary, Household, Land Parcel, School)`);
  console.log(`  MATCHING RULES   : 9 (for duplicate detection)`);
  console.log(`  AUTO-LINK RULES  : 5 (for relationship creation)`);
  console.log(`  GOLDEN RECORDS   : ${records.length}`);
  console.log(`\n  ${'─'.repeat(55)}`);
  console.log('  🔄 SYSTEM WILL NOW HANDLE:');
  console.log('     1. Duplicate detection (exact NRC + fuzzy name/district)');
  console.log('     2. Suggestions creation (Intelligence → Duplicates)');
  console.log('     3. Auto-linking (Beneficiary ↔ Household by NRC)');
  console.log('     4. Relationship generation (property_owner, neighbor, etc.)');
  console.log('     5. Timeline events (record creation/updates)');
  console.log('     6. Entity profiles (360° view data)');
  console.log(`\n  DUPLICATE PROFILE:`);
  console.log(`     - 3 NRCs appear 3 times each (triplicates)`);
  console.log(`     - 14 NRCs appear 2 times each (exact duplicates)`);
  console.log(`     - ~45 records share 5 phone numbers (phone groups)`);
  console.log(`     - 30% share same lastName + same district (fuzzy matches)`);
  console.log(`\n  CROSS-ENTITY LINKS:`);
  console.log(`     - 25 household headNRCs match beneficiary NRCs (auto-link target)`);
  console.log(`     - 20 land parcel ownerNRCs match beneficiary NRCs (auto-link target)`);
  console.log(`\n  ${'─'.repeat(55)}`);
  console.log('  Run duplicate scan from Intelligence → Duplicates to see results.\n');
}

main()
  .catch((e) => {
    console.error('\n❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
