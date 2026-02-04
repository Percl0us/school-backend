import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const username = "admin";
  const password = "admin123"; // change later
  const name = "School Admin";

  const hashedPassword = await bcrypt.hash(password, 10);

  const existing = await prisma.admin.findUnique({
    where: { username },
  });

  if (existing) {
    console.log("Admin already exists");
    return;
  }

  await prisma.admin.create({
    data: {
      username,
      password: hashedPassword,
      name,
    },
  });

  console.log("Admin user created");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
