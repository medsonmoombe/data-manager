import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcryptjs';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

function randomDate(start: Date, end: Date) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

async function main() {
  console.log('Starting database seeding...');

  // ============================================
  // 1. ORGANIZATIONS
  // ============================================
  console.log('Creating organizations...');

  const organizations = await Promise.all([
    prisma.organization.create({
      data: {
        name: 'OmniCore Africa HQ',
        slug: 'omnicore-hq',
        domain: 'omnicore.africa',
        primaryContactEmail: 'hq@omnicore.africa',
        phone: '+260 123 456789',
        isActive: true,
        settings: { theme: 'dark', timezone: 'Africa/Lusaka' },
      },
    }),
    prisma.organization.create({
      data: {
        name: 'Ministry of Lands',
        slug: 'ministry-lands',
        domain: 'gov.zm',
        primaryContactEmail: 'lands@gov.zm',
        phone: '+260 987 654321',
        isActive: true,
        settings: { theme: 'light', timezone: 'Africa/Lusaka' },
      },
    }),
    prisma.organization.create({
      data: {
        name: 'Zambia Electricity Supply Corporation',
        slug: 'zesco',
        domain: 'zesco.co.zm',
        primaryContactEmail: 'info@zesco.co.zm',
        phone: '+260 555 123456',
        isActive: true,
        settings: { theme: 'light', timezone: 'Africa/Lusaka' },
      },
    }),
    prisma.organization.create({
      data: {
        name: 'Ministry of Agriculture',
        slug: 'ministry-agriculture',
        domain: 'gov.zm',
        primaryContactEmail: 'agriculture@gov.zm',
        phone: '+260 555 789012',
        isActive: true,
        settings: { theme: 'light', timezone: 'Africa/Lusaka' },
      },
    }),
  ]);

  console.log(`Created ${organizations.length} organizations`);

  // ============================================
  // 2. ROLES
  // ============================================
  console.log('Creating roles...');

  const superAdminRole = await prisma.role.create({
    data: {
      name: 'SUPER_ADMIN',
      description: 'Super Administrator',
      isSystemRole: true,
      organizationId: organizations[0].id,
      permissions: ['*'],
    },
  });

  const orgAdminRole = await prisma.role.create({
    data: {
      name: 'ORG_ADMIN',
      description: 'Organization Administrator',
      isSystemRole: true,
      organizationId: organizations[0].id,
      permissions: ['manage_users', 'manage_settings', 'view_reports'],
    },
  });

  const projectManagerRole = await prisma.role.create({
    data: {
      name: 'PROJECT_MANAGER',
      description: 'Project Manager',
      isSystemRole: true,
      organizationId: organizations[0].id,
      permissions: ['create_records', 'edit_records', 'approve_workflows'],
    },
  });

  const userRole = await prisma.role.create({
    data: {
      name: 'USER',
      description: 'Regular User',
      isSystemRole: true,
      organizationId: organizations[0].id,
      permissions: ['view_records', 'create_records'],
    },
  });

  console.log('Created roles');

  // ============================================
  // 3. USERS (auth handled via Keycloak)
  // ============================================
  console.log('Creating users...');

  const users = await Promise.all([
    prisma.user.create({
      data: {
        email: 'admin@omnicore.africa',
        keycloakUserId: 'kc-admin-001',
        username: 'john.admin',
        firstName: 'John',
        lastName: 'Admin',
        jobTitle: 'System Administrator',
        isActive: true,
        lastLoginAt: new Date(),
        organizationId: organizations[0].id,
      },
    }),
    prisma.user.create({
      data: {
        email: 'orgadmin@omnicore.africa',
        keycloakUserId: 'kc-orgadmin-001',
        username: 'sarah.manager',
        firstName: 'Sarah',
        lastName: 'Manager',
        jobTitle: 'Organization Manager',
        isActive: true,
        lastLoginAt: new Date(),
        organizationId: organizations[0].id,
      },
    }),
    prisma.user.create({
      data: {
        email: 'pm@omnicore.africa',
        keycloakUserId: 'kc-pm-001',
        username: 'michael.banda',
        firstName: 'Michael',
        lastName: 'Banda',
        jobTitle: 'Senior Project Manager',
        isActive: true,
        lastLoginAt: new Date(),
        organizationId: organizations[0].id,
      },
    }),
    prisma.user.create({
      data: {
        email: 'user@omnicore.africa',
        keycloakUserId: 'kc-user-001',
        username: 'jane.mewang',
        firstName: 'Jane',
        lastName: 'Mewang',
        jobTitle: 'Data Entry Officer',
        isActive: true,
        lastLoginAt: new Date(),
        organizationId: organizations[0].id,
      },
    }),
    prisma.user.create({
      data: {
        email: 'lands.admin@gov.zm',
        keycloakUserId: 'kc-lands-admin-001',
        username: 'peter.mbewa',
        firstName: 'Peter',
        lastName: 'Mbewa',
        jobTitle: 'Land Registry Manager',
        isActive: true,
        lastLoginAt: new Date(),
        organizationId: organizations[1].id,
      },
    }),
    prisma.user.create({
      data: {
        email: 'surveyor@lands.gov.zm',
        keycloakUserId: 'kc-surveyor-001',
        username: 'charles.phiri',
        firstName: 'Charles',
        lastName: 'Phiri',
        jobTitle: 'Chief Land Surveyor',
        isActive: true,
        organizationId: organizations[1].id,
      },
    }),
    prisma.user.create({
      data: {
        email: 'zesco.admin@zesco.co.zm',
        keycloakUserId: 'kc-zesco-admin-001',
        username: 'mary.chilufya',
        firstName: 'Mary',
        lastName: 'Chilufya',
        jobTitle: 'Energy Distribution Manager',
        isActive: true,
        lastLoginAt: new Date(),
        organizationId: organizations[2].id,
      },
    }),
    prisma.user.create({
      data: {
        email: 'technician@zesco.co.zm',
        keycloakUserId: 'kc-technician-001',
        username: 'james.mwila',
        firstName: 'James',
        lastName: 'Mwila',
        jobTitle: 'Senior Electrical Technician',
        isActive: true,
        organizationId: organizations[2].id,
      },
    }),
    prisma.user.create({
      data: {
        email: 'agriculture.admin@gov.zm',
        keycloakUserId: 'kc-agri-admin-001',
        username: 'grace.musonda',
        firstName: 'Grace',
        lastName: 'Musonda',
        jobTitle: 'Agricultural Director',
        isActive: true,
        lastLoginAt: new Date(),
        organizationId: organizations[3].id,
      },
    }),
    prisma.user.create({
      data: {
        email: 'inactive@omnicore.africa',
        keycloakUserId: 'kc-inactive-001',
        username: 'inactive.user',
        firstName: 'Inactive',
        lastName: 'User',
        jobTitle: 'Former Employee',
        isActive: false,
        organizationId: organizations[0].id,
      },
    }),
  ]);

  // Assign roles
  await Promise.all([
    prisma.userRole.create({ data: { userId: users[0].id, roleId: superAdminRole.id } }),
    prisma.userRole.create({ data: { userId: users[1].id, roleId: orgAdminRole.id } }),
    prisma.userRole.create({ data: { userId: users[2].id, roleId: projectManagerRole.id } }),
    prisma.userRole.create({ data: { userId: users[3].id, roleId: userRole.id } }),
    prisma.userRole.create({ data: { userId: users[4].id, roleId: orgAdminRole.id } }),
    prisma.userRole.create({ data: { userId: users[5].id, roleId: userRole.id } }),
    prisma.userRole.create({ data: { userId: users[6].id, roleId: orgAdminRole.id } }),
    prisma.userRole.create({ data: { userId: users[7].id, roleId: userRole.id } }),
    prisma.userRole.create({ data: { userId: users[8].id, roleId: orgAdminRole.id } }),
    prisma.userRole.create({ data: { userId: users[9].id, roleId: userRole.id } }),
  ]);

  console.log(`Created ${users.length} users with roles`);

  // ============================================
  // 4. WORKFLOW DEFINITIONS
  // ============================================
  console.log('Creating workflow definitions...');

  const workflowDefs = await Promise.all([
    prisma.workflowDefinition.create({
      data: {
        name: 'Onboarding Flow',
        description: 'New employee onboarding process',
        triggerType: 'manual',
        triggerConfig: {},
        steps: [
          { id: 'step-1', name: 'Create Account', type: 'task', assigneeRole: 'ORG_ADMIN' },
          { id: 'step-2', name: 'Assign Mentor', type: 'task', assigneeRole: 'PROJECT_MANAGER' },
          { id: 'step-3', name: 'Complete Training', type: 'task', assigneeRole: 'USER' },
        ],
        isActive: true,
        organizationId: organizations[0].id,
      },
    }),
    prisma.workflowDefinition.create({
      data: {
        name: 'Land Survey Workflow',
        description: 'Land parcel survey and approval process',
        triggerType: 'form_submission',
        triggerConfig: { formName: 'Land Survey Request' },
        steps: [
          { id: 'step-1', name: 'Review Application', type: 'approval', assigneeRole: 'ORG_ADMIN' },
          { id: 'step-2', name: 'Conduct Survey', type: 'task', assigneeRole: 'USER' },
          { id: 'step-3', name: 'Approve Survey', type: 'approval', assigneeRole: 'ORG_ADMIN' },
        ],
        isActive: true,
        organizationId: organizations[1].id,
      },
    }),
    prisma.workflowDefinition.create({
      data: {
        name: 'Procurement Flow',
        description: 'Supplier invoice validation and payment',
        triggerType: 'manual',
        triggerConfig: {},
        steps: [
          { id: 'step-1', name: 'Validate Invoice', type: 'task', assigneeRole: 'USER' },
          { id: 'step-2', name: 'Approve Payment', type: 'approval', assigneeRole: 'PROJECT_MANAGER' },
          { id: 'step-3', name: 'Process Payment', type: 'task', assigneeRole: 'ORG_ADMIN' },
        ],
        isActive: true,
        organizationId: organizations[0].id,
      },
    }),
  ]);

  console.log(`Created ${workflowDefs.length} workflow definitions`);

  // ============================================
  // 5. ENTITY DEFINITION & GOLDEN RECORDS (Beneficiaries)
  // ============================================
  console.log('Creating entity definition and golden records...');

  const beneficiaryEntity = await prisma.entityDefinition.create({
    data: {
      name: 'Beneficiary',
      description: 'Program beneficiary records',
      organizationId: organizations[0].id,
      attributes: {
        create: [
          { name: 'firstName', displayName: 'First Name', dataType: 'string', isRequired: true, sortOrder: 1 },
          { name: 'lastName', displayName: 'Last Name', dataType: 'string', isRequired: true, sortOrder: 2 },
          { name: 'nationalId', displayName: 'National ID', dataType: 'string', isIdentifier: true, sortOrder: 3 },
          { name: 'phone', displayName: 'Phone Number', dataType: 'string', sortOrder: 4 },
          { name: 'email', displayName: 'Email', dataType: 'string', sortOrder: 5 },
          { name: 'district', displayName: 'District', dataType: 'string', sortOrder: 6 },
          { name: 'village', displayName: 'Village', dataType: 'string', sortOrder: 7 },
        ],
      },
    },
  });

  const firstNames = ['John', 'Mary', 'Peter', 'Grace', 'James', 'Elizabeth', 'David', 'Susan', 'Joseph', 'Patricia'];
  const lastNames = ['Banda', 'Mbewa', 'Phiri', 'Mulenga', 'Chanda', 'Mwila', 'Tembo', 'Zulu', 'Mwale', 'Kasonde'];
  const districts = ['Lusaka', 'Kitwe', 'Ndola', 'Kabwe', 'Chingola', 'Mufulira', 'Luanshya', 'Livingstone', 'Chipata', 'Kasama'];

  const beneficiaries = await Promise.all(
    Array.from({ length: 50 }, (_, i) =>
      prisma.goldenRecord.create({
        data: {
          entityDefinitionId: beneficiaryEntity.id,
          organizationId: organizations[i % organizations.length].id,
          data: {
            firstName: firstNames[Math.floor(Math.random() * firstNames.length)],
            lastName: lastNames[Math.floor(Math.random() * lastNames.length)],
            nationalId: `${Math.floor(Math.random() * 9000000) + 1000000}`,
            phone: `+260${Math.floor(Math.random() * 900000000) + 100000000}`,
            email: `beneficiary${i + 1}@example.com`,
            district: districts[Math.floor(Math.random() * districts.length)],
            village: `Village ${Math.floor(Math.random() * 50) + 1}`,
          },
          status: ['active', 'active', 'active', 'merged', 'archived'][Math.floor(Math.random() * 5)],
          createdBy: users[Math.floor(Math.random() * users.length)].id,
        },
      })
    )
  );

  console.log(`Created ${beneficiaries.length} beneficiary golden records`);

  // ============================================
  // 6. ACTIVITY EVENTS
  // ============================================
  console.log('Creating activity events...');

  const eventTypes = [
    'record_created', 'record_updated', 'form_submitted', 'workflow_started',
    'workflow_completed', 'task_assigned', 'task_completed',
  ];

  const activityEvents = await Promise.all(
    Array.from({ length: 100 }, (_, i) =>
      prisma.activityEvent.create({
        data: {
          organizationId: organizations[Math.floor(Math.random() * organizations.length)].id,
          eventType: eventTypes[Math.floor(Math.random() * eventTypes.length)],
          summary: `Activity ${i + 1} performed`,
          entityType: 'golden_record',
          action: 'created',
          actorUserId: users[Math.floor(Math.random() * users.length)].id,
          severity: 'info',
          details: {
            ipAddress: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
          },
          createdAt: randomDate(new Date(2025, 5, 1), new Date()),
        },
      })
    )
  );

  console.log(`Created ${activityEvents.length} activity events`);

  // ============================================
  // 7. NOTIFICATIONS
  // ============================================
  console.log('Creating notifications...');

  const notifications = await Promise.all(
    Array.from({ length: 50 }, (_, i) =>
      prisma.notification.create({
        data: {
          organizationId: organizations[Math.floor(Math.random() * organizations.length)].id,
          channel: 'in_app',
          recipient: users[Math.floor(Math.random() * users.length)].id,
          subject: `Notification ${i + 1}`,
          body: `This is notification message ${i + 1}`,
          priority: Math.floor(Math.random() * 3),
          status: Math.random() > 0.3 ? 'sent' : 'pending',
          createdAt: randomDate(new Date(2025, 5, 1), new Date()),
        },
      })
    )
  );

  console.log(`Created ${notifications.length} notifications`);

  // ============================================
  // SUMMARY
  // ============================================
  console.log('\nSeeding completed successfully!');
  console.log('Summary:');
  console.log(`   - Organizations: ${organizations.length}`);
  console.log(`   - Users: ${users.length}`);
  console.log(`   - Beneficiaries (Golden Records): ${beneficiaries.length}`);
  console.log(`   - Activity Events: ${activityEvents.length}`);
  console.log(`   - Notifications: ${notifications.length}`);
  console.log(`   - Workflow Definitions: ${workflowDefs.length}`);
}

main()
  .catch((e) => {
    console.error('Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
