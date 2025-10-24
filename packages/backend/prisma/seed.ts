/**
 * PRISMA SEED SCRIPT
 *
 * Seeds the database with initial data for Elara platform
 * Run with: npm run db:seed
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { seedAIModels } from './seeds/ai-models-seed.js';
import { seedConsensusConfig } from './seeds/consensus-config-seed.js';
import { seedGlobalSettings } from './seeds/global-settings-seed.js';
import { seedEnhancedThreatIntelSources } from './seeds/threat-intel-sources-enhanced-seed.js';

const prisma = new PrismaClient();

async function seedThreatIntelSources() {
  // Use the ENHANCED threat intel sources seed (13 sources total)
  await seedEnhancedThreatIntelSources();
}

async function seedAdminUser() {
  console.log('👤 Seeding admin user...');

  try {
    // Check if admin user already exists
    const existingAdmin = await prisma.user.findUnique({
      where: { email: 'admin@oelara.com' }
    });

    if (existingAdmin) {
      console.log('  ✅ Admin user already exists');
      return existingAdmin;
    }

    // Create or get admin organization
    let adminOrg = await prisma.organization.findFirst({
      where: { name: 'Elara Admin' }
    });

    if (!adminOrg) {
      adminOrg = await prisma.organization.create({
        data: {
          name: 'Elara Admin',
          tier: 'enterprise',
          isActive: true
        }
      });
      console.log('  ✅ Created admin organization');
    }

    // Hash default password: "ElaraAdmin2025!"
    const passwordHash = await bcrypt.hash('ElaraAdmin2025!', 12);

    // Create admin user
    const adminUser = await prisma.user.create({
      data: {
        email: 'admin@oelara.com',
        passwordHash,
        role: 'admin',
        firstName: 'Admin',
        lastName: 'User',
        isActive: true,
        authProvider: 'local',
        organizationId: adminOrg.id
      }
    });

    console.log(`  ✅ Created admin user: ${adminUser.email}`);
    console.log(`  📧 Email: admin@oelara.com`);
    console.log(`  🔑 Password: ElaraAdmin2025!`);
    console.log(`  ⚠️  IMPORTANT: Change this password after first login!`);

    return adminUser;
  } catch (error) {
    console.error('❌ Error seeding admin user:', error);
    throw error;
  }
}

async function main() {
  console.log('🌱 Starting database seed...\n');

  try {
    // Seed admin user and organization
    await seedAdminUser();

    // Seed threat intelligence sources
    await seedThreatIntelSources();

    // Seed Global Settings (ALL env variables)
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    await seedGlobalSettings();

    // Seed AI Models (Claude, GPT-4, Gemini) with API keys from env
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    await seedAIModels();

    // Seed AI Consensus Configuration
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    await seedConsensusConfig();

    console.log('\n✅ Database seed completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('   1. Go to Admin Panel → Global Settings to manage all configs');
    console.log('   2. Go to Scan Engine Admin → AI Models tab');
    console.log('   3. Click "Test Connection" on each model');
    console.log('   4. All 3 models should show green ✓ status');
    console.log('   5. Run a URL scan to verify AI consensus works\n');
  } catch (error) {
    console.error('\n❌ Error seeding database:', error);
    throw error;
  }
}

main()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
