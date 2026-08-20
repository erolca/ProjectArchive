import { prisma } from "../src/lib/prisma";
import { logProjectInfoSyncFailure, syncProjectInfoFile } from "../src/modules/projects/project-info-file.service";

async function main(): Promise<void> {
  const projects = await prisma.project.findMany({
    where: {
      deletedAt: null,
    },
    include: {
      customer: {
        select: {
          customerName: true,
        },
      },
    },
    orderBy: {
      projectCode: "asc",
    },
  });

  let synced = 0;
  let skipped = 0;
  let failed = 0;

  for (const project of projects) {
    try {
      const result = await syncProjectInfoFile(project);

      if (result.synced) {
        synced += 1;
        console.log(`Synced project info file for ${result.projectCode}.`);
      } else {
        skipped += 1;
        console.log(`Skipped ${result.projectCode}: ${result.reason || "Project info file was not updated."}`);
      }
    } catch {
      failed += 1;
      logProjectInfoSyncFailure(project.projectCode, "project info maintenance sync");
    }
  }

  console.log(`Project info sync complete. Synced: ${synced}. Skipped: ${skipped}. Failed: ${failed}.`);
}

main()
  .catch((error) => {
    console.error("Project info sync failed.");
    if (error instanceof Error) {
      console.error(error.message);
    }
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
