/**
 * DEVELOPMENT/DEMO SEED ONLY.
 *
 * This script creates shared-password demo accounts for local development
 * and manual testing. It is NOT the production initialization path and must
 * never run against a production database.
 *
 * Production initialization uses the explicit operator-invoked bootstrap:
 *   npm run bootstrap:admin -- --email <admin-email> --name "<admin name>"
 */
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to run the demo auth seed with NODE_ENV=production.');
  console.error('Use "npm run bootstrap:admin" for production initialization.');
  process.exit(1);
}

const prisma = new PrismaClient();

const DEMO_PASSWORD = 'DemoPass123';
const demoUsers = [
  {
    name: 'Admin Demo User',
    email: 'admin.demo@uniosun.edu.ng',
    role: 'ADMIN'
  },
  {
    name: 'Lecturer Demo User',
    email: 'lecturer.demo@uniosun.edu.ng',
    role: 'LECTURER'
  },
  {
    name: 'Student Demo User',
    email: 'student.demo@uniosun.edu.ng',
    role: 'STUDENT'
  }
];

async function main() {
  console.log('Seeding local-only demo auth users. Do not use these credentials in production.');

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  for (const user of demoUsers) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        name: user.name,
        role: user.role,
        status: 'ACTIVE',
        mustChangePassword: false
      },
      create: {
        ...user,
        passwordHash,
        status: 'ACTIVE',
        mustChangePassword: false
      }
    });
    console.log(`Demo user ready: ${user.email}`);
  }

  await prisma.systemSetting.upsert({
    where: { key: 'demo_auth_users_notice' },
    update: { value: 'Demo users are local-only and unsafe for production.' },
    create: {
      key: 'demo_auth_users_notice',
      value: 'Demo users are local-only and unsafe for production.'
    }
  });

  console.log(`Shared local-only demo password: ${DEMO_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
