import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function seedAdmin() {
  const username = "admin";
  const password = "admin123";
  const name = "School Admin";

  const hashedPassword = await bcrypt.hash(password, 10);

  const existing = await prisma.admin.findUnique({
    where: { username },
  });

  if (existing) {
    console.log("✓ Admin user already exists");
    return;
  }

  await prisma.admin.create({
    data: {
      username,
      password: hashedPassword,
      name,
    },
  });

  console.log("✓ Admin user created (username: admin, password: admin123)");
}

async function seedAcademicSession() {
  const academicYear = "2024-2025";

  const existing = await prisma.academicSession.findUnique({
    where: { academicYear },
  }).catch(() => null);

  if (existing) {
    console.log(`✓ Academic session ${academicYear} already exists`);
    return;
  }

  await prisma.academicSession.create({
    data: {
      academicYear,
      startDate: new Date("2024-04-01"),
      endDate: new Date("2025-03-31"),
      isActive: true,
    },
  }).catch((err) => {
    if (!err.message.includes("relation")) {
      console.warn(`⚠️  Could not create academic session: ${err.message}`);
    }
  });

  console.log(`✓ Academic session created (${academicYear})`);
}

async function main() {
  console.log("🌱 Starting database seed...\n");

  await seedAdmin();
  await seedAcademicSession();

  console.log("\n✅ Database seeding completed!");
}

main()
  .catch((err) => {
    console.error("❌ Seeding failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
