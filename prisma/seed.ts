import { RoleName } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { hashPassword } from "../src/lib/password";

const DEFAULT_ROLES: Record<RoleName, string> = {
  ADMIN: "Full access to users, roles, projects, files, backups, and audit logs.",
  ENGINEER: "Can create and update projects, upload files, download files, and create versions.",
  SERVICE: "Can view projects, download files, and add service records.",
  GUEST: "Limited read-only project metadata access.",
};

async function main(): Promise<void> {
  for (const [name, description] of Object.entries(DEFAULT_ROLES) as Array<[RoleName, string]>) {
    await prisma.role.upsert({
      where: {
        name,
      },
      update: {
        description,
      },
      create: {
        name,
        description,
      },
    });
  }

  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    throw new Error("ADMIN_PASSWORD is required to seed the default admin user.");
  }

  const adminRole = await prisma.role.findUniqueOrThrow({
    where: {
      name: RoleName.ADMIN,
    },
  });
  const adminUsername = process.env.ADMIN_USERNAME || "admin";
  const adminEmail = process.env.ADMIN_EMAIL || "admin@example.local";
  const passwordHash = await hashPassword(adminPassword);
  const existingByUsername = await prisma.user.findUnique({
    where: {
      username: adminUsername,
    },
  });
  const existingByEmail = await prisma.user.findUnique({
    where: {
      email: adminEmail,
    },
  });
  const existingAdminUser = existingByUsername || existingByEmail;

  if (existingAdminUser) {
    await prisma.user.update({
      where: {
        id: existingAdminUser.id,
      },
      data: {
        username: adminUsername,
        email: existingByEmail && existingByEmail.id !== existingAdminUser.id ? existingAdminUser.email : adminEmail,
        passwordHash,
        roleId: adminRole.id,
        isActive: true,
        deletedAt: null,
      },
    });

    return;
  }

  await prisma.user.create({
    data: {
      username: adminUsername,
      email: adminEmail,
      passwordHash,
      roleId: adminRole.id,
      isActive: true,
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
