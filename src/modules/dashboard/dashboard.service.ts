import { FileCategory, ProjectStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { requirePermission } from "../auth/permissions";
import type { AuthenticatedUser } from "../auth/auth.types";

export async function getDashboardSummary(user: AuthenticatedUser) {
  requirePermission(user, "projects:read");
  requirePermission(user, "files:read");
  requirePermission(user, "activity:read");

  const [
    totalProjects,
    activeProjects,
    customers,
    plcBackups,
    hmiBackups,
    robotBackups,
    electricalFiles,
    documents,
    mechanicalFiles,
    visionFiles,
    cameraFiles,
    fatDocuments,
    satDocuments,
    serviceFiles,
    sparePartsFiles,
    lastUploadedFiles,
    recentActivities,
  ] =
    await prisma.$transaction([
      prisma.project.count({
        where: {
          deletedAt: null,
        },
      }),
      prisma.project.count({
        where: {
          deletedAt: null,
          status: {
            not: ProjectStatus.ARCHIVED,
          },
        },
      }),
      prisma.customer.count({
        where: {
          deletedAt: null,
        },
      }),
      countFilesByCategory(FileCategory.PLC),
      countFilesByCategory(FileCategory.HMI),
      countFilesByCategory(FileCategory.ROBOT),
      countFilesByCategory(FileCategory.ELECTRICAL),
      countFilesByCategory(FileCategory.DOCUMENT),
      countFilesByCategory(FileCategory.MECHANICAL),
      countFilesByCategory(FileCategory.VISION),
      countFilesByCategory(FileCategory.CAMERA),
      countFilesByCategory(FileCategory.FAT),
      countFilesByCategory(FileCategory.SAT),
      countFilesByCategory(FileCategory.SERVICE),
      countFilesByCategory(FileCategory.SPARE_PARTS),
      prisma.projectFile.findMany({
        where: {
          deletedAt: null,
          project: {
            deletedAt: null,
          },
        },
        include: {
          project: {
            select: {
              id: true,
              projectCode: true,
              machineName: true,
            },
          },
          uploadedBy: {
            select: {
              id: true,
              username: true,
              email: true,
            },
          },
          versions: {
            orderBy: {
              uploadedAt: "desc",
            },
            take: 1,
          },
        },
        orderBy: {
          uploadedAt: "desc",
        },
        take: 8,
      }),
      prisma.activityLog.findMany({
        include: {
          user: {
            select: {
              id: true,
              username: true,
              email: true,
            },
          },
          project: {
            select: {
              id: true,
              projectCode: true,
              machineName: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 10,
      }),
    ]);

  return {
    metrics: {
      totalProjects,
      activeProjects,
      customers,
      plcBackups,
      hmiBackups,
      robotBackups,
      electricalFiles,
      documents,
      mechanicalFiles,
      visionFiles,
      cameraFiles,
      fatDocuments,
      satDocuments,
      serviceFiles,
      sparePartsFiles,
    },
    lastUploadedFiles,
    recentActivities,
  };
}

function countFilesByCategory(category: FileCategory) {
  return prisma.projectFile.count({
    where: {
      category,
      deletedAt: null,
      project: {
        deletedAt: null,
      },
    },
  });
}
