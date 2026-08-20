import { ActivityAction, ProjectStatus, type Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { requirePermission } from "../auth/permissions";
import type { AuthenticatedUser } from "../auth/auth.types";
import {
  createProjectFolders,
  deleteProjectStorageFolder,
  listProjectStorageFiles,
  openProjectFolderInExplorer,
  renameProjectFolder,
} from "../storage/storage.service";
import { logActivity } from "../activity/activity.service";
import {
  isProjectInfoSystemFile,
  logProjectInfoSyncFailure,
  logProjectInfoSyncSkipped,
  syncProjectInfoFile,
} from "./project-info-file.service";
import { listProjects } from "./project.search";
import {
  createProjectSchema,
  deleteProjectSchema,
  projectCodeParamSchema,
  projectIdSchema,
  updateProjectSchema,
} from "./project.validators";
import type { CreateProjectInput, CustomerInput, DeleteProjectInput, ProjectListQuery, UpdateProjectInput } from "./project.types";

const PROJECT_DETAIL_INCLUDE = {
  customer: true,
  createdBy: {
    select: {
      id: true,
      username: true,
      email: true,
    },
  },
  updatedBy: {
    select: {
      id: true,
      username: true,
      email: true,
    },
  },
  revisions: {
    orderBy: {
      revisionDate: "desc",
    },
  },
  tags: {
    include: {
      tag: true,
    },
  },
} satisfies Prisma.ProjectInclude;

type ProjectWithCustomer = Prisma.ProjectGetPayload<{ include: { customer: true } }>;
type ProjectDetailPayload = Prisma.ProjectGetPayload<{ include: typeof PROJECT_DETAIL_INCLUDE }>;

export async function createProject(user: AuthenticatedUser, input: CreateProjectInput) {
  requirePermission(user, "projects:create");

  const data = createProjectSchema.parse(input);

  await assertProjectCodeAvailable(data.projectCode);
  await assertSerialNumberAvailable(data.serialNumber);

  const customer = await resolveCustomer(data.customer);
  const project = await prisma.project.create({
    data: {
      projectCode: data.projectCode,
      customerProjectCode: data.customerProjectCode,
      serialNumber: data.serialNumber,
      machineName: data.machineName,
      machineType: data.machineType,
      customerId: customer.id,
      status: data.status,
      description: data.description,
      customerFactory: data.customerFactory,
      lineName: data.lineName,
      plcBrand: data.plcBrand,
      plcModel: data.plcModel,
      plcSoftwareVersion: data.plcSoftwareVersion,
      hmiBrand: data.hmiBrand,
      hmiModel: data.hmiModel,
      hmiSoftwareVersion: data.hmiSoftwareVersion,
      robotBrand: data.robotBrand,
      robotModel: data.robotModel,
      robotController: data.robotController,
      robotSoftwareVersion: data.robotSoftwareVersion,
      electricalDrawingNo: data.electricalDrawingNo,
      createdById: user.id,
      updatedById: user.id,
    },
    include: PROJECT_DETAIL_INCLUDE,
  });

  try {
    await createProjectFolders(project.projectCode);
  } catch (error) {
    await prisma.project.update({
      where: {
        id: project.id,
      },
      data: {
        deletedAt: new Date(),
        updatedById: user.id,
      },
    });

    throw error;
  }

  try {
    const result = await syncProjectInfoFile(project);

    if (result.skipped) {
      logProjectInfoSyncSkipped(project.projectCode, "project creation", result.reason);
    }
  } catch {
    logProjectInfoSyncFailure(project.projectCode, "project creation");
  }

  await logActivity({
    userId: user.id,
    projectId: project.id,
    action: ActivityAction.PROJECT_CREATED,
    entityType: "Project",
    entityId: project.id,
    details: `Project ${project.projectCode} created.`,
  });

  return project;
}

export async function updateProject(user: AuthenticatedUser, projectId: number, input: UpdateProjectInput) {
  requirePermission(user, "projects:update");

  const id = projectIdSchema.parse(projectId);
  const data = updateProjectSchema.parse(input);
  const rawInput = input as Record<string, unknown>;

  const existingProject = await prisma.project.findFirst({
    where: {
      id,
      deletedAt: null,
    },
    include: {
      customer: true,
    },
  });

  if (!existingProject) {
    throw new Error("Project not found.");
  }

  if (
    data.status &&
    data.status !== existingProject.status &&
    (data.status === ProjectStatus.ARCHIVED || existingProject.status === ProjectStatus.ARCHIVED)
  ) {
    requirePermission(user, "projects:delete");
  }

  if (data.serialNumber && data.serialNumber !== existingProject.serialNumber) {
    await assertSerialNumberAvailable(data.serialNumber, id);
  }

  const projectCodeChanged = Boolean(data.projectCode && data.projectCode !== existingProject.projectCode);
  let storageFolderRenamed = false;

  if (projectCodeChanged && data.projectCode) {
    await assertProjectCodeAvailable(data.projectCode, id);
    await renameProjectFolder(existingProject.projectCode, data.projectCode);
    storageFolderRenamed = true;
  }

  const customerId = data.customer ? (await resolveCustomer(data.customer)).id : existingProject.customerId;
  let project: ProjectDetailPayload;

  try {
    project = await prisma.$transaction(async (tx) => {
      const updatedProject = await tx.project.update({
        where: {
          id,
        },
        data: {
          projectCode: data.projectCode,
          customerProjectCode: nullableUpdateValue(data.customerProjectCode, rawInput, "customerProjectCode"),
          serialNumber: data.serialNumber,
          machineName: data.machineName,
          machineType: nullableUpdateValue(data.machineType, rawInput, "machineType"),
          customerId,
          status: data.status,
          description: data.description,
          customerFactory: data.customerFactory,
          lineName: data.lineName,
          plcBrand: nullableUpdateValue(data.plcBrand, rawInput, "plcBrand"),
          plcModel: data.plcModel,
          plcSoftwareVersion: data.plcSoftwareVersion,
          hmiBrand: nullableUpdateValue(data.hmiBrand, rawInput, "hmiBrand"),
          hmiModel: data.hmiModel,
          hmiSoftwareVersion: data.hmiSoftwareVersion,
          robotBrand: nullableUpdateValue(data.robotBrand, rawInput, "robotBrand"),
          robotModel: data.robotModel,
          robotController: data.robotController,
          robotSoftwareVersion: data.robotSoftwareVersion,
          electricalDrawingNo: data.electricalDrawingNo,
          updatedById: user.id,
        },
        include: PROJECT_DETAIL_INCLUDE,
      });

      if (projectCodeChanged && data.projectCode) {
        await updateProjectStoragePaths(tx, id, existingProject.projectCode, data.projectCode);
      }

      return updatedProject;
    });
  } catch (error) {
    if (storageFolderRenamed && data.projectCode) {
      await renameProjectFolder(data.projectCode, existingProject.projectCode);
    }

    throw error;
  }

  const changeLogs = buildProjectChangeLogs(existingProject, project, user);

  for (const details of changeLogs) {
    await logActivity({
      userId: user.id,
      projectId: project.id,
      action: ActivityAction.PROJECT_UPDATED,
      entityType: "Project",
      entityId: project.id,
      details,
    });
  }

  try {
    const result = await syncProjectInfoFile(project);

    if (result.skipped) {
      logProjectInfoSyncSkipped(project.projectCode, "project update", result.reason);
    }
  } catch {
    logProjectInfoSyncFailure(project.projectCode, "project update");
  }

  if (projectCodeChanged && data.projectCode) {
    await logActivity({
      userId: user.id,
      projectId: project.id,
      action: ActivityAction.PROJECT_UPDATED,
      entityType: "Project",
      entityId: project.id,
      details: `Project storage folder renamed successfully. ${existingProject.projectCode} -> ${data.projectCode}.`,
    });
  }

  return project;
}

export async function getProjectById(user: AuthenticatedUser, projectId: number) {
  requirePermission(user, "projects:read");

  const id = projectIdSchema.parse(projectId);

  return prisma.project.findFirst({
    where: {
      id,
      deletedAt: null,
    },
    include: PROJECT_DETAIL_INCLUDE,
  });
}

export async function openProjectStorageFolder(user: AuthenticatedUser, projectId: number) {
  requirePermission(user, "projects:read");

  const id = projectIdSchema.parse(projectId);
  const project = await prisma.project.findFirst({
    where: {
      id,
      deletedAt: null,
    },
    select: {
      projectCode: true,
    },
  });

  if (!project) {
    throw new Error("Project not found.");
  }

  await openProjectFolderInExplorer(project.projectCode);

  return {
    opened: true,
    message: "Project folder opened in Windows Explorer.",
  };
}

export async function archiveProject(user: AuthenticatedUser, projectId: number) {
  requirePermission(user, "projects:delete");

  const id = projectIdSchema.parse(projectId);
  const existingProject = await getProjectForManagement(id);

  if (existingProject.status === ProjectStatus.ARCHIVED) {
    return {
      project: existingProject,
      message: "Project is already archived.",
    };
  }

  const project = await prisma.project.update({
    where: {
      id,
    },
    data: {
      status: ProjectStatus.ARCHIVED,
      archivedAt: new Date(),
      updatedById: user.id,
    },
    include: PROJECT_DETAIL_INCLUDE,
  });

  await logActivity({
    userId: user.id,
    projectId: project.id,
    action: ActivityAction.PROJECT_ARCHIVED,
    entityType: "Project",
    entityId: project.id,
    details: `Project ${project.projectCode} archived by ${user.fullName || user.username}.`,
  });
  await syncProjectInfoFileWithoutBlocking(project, "project archive");

  return {
    project,
    message: "Project archived.",
  };
}

export async function unarchiveProject(user: AuthenticatedUser, projectId: number) {
  requirePermission(user, "projects:delete");

  const id = projectIdSchema.parse(projectId);
  const existingProject = await getProjectForManagement(id);

  if (existingProject.status !== ProjectStatus.ARCHIVED) {
    return {
      project: existingProject,
      message: "Project is already active.",
    };
  }

  const project = await prisma.project.update({
    where: {
      id,
    },
    data: {
      status: ProjectStatus.DESIGN,
      archivedAt: null,
      updatedById: user.id,
    },
    include: PROJECT_DETAIL_INCLUDE,
  });

  await logActivity({
    userId: user.id,
    projectId: project.id,
    action: ActivityAction.PROJECT_UPDATED,
    entityType: "Project",
    entityId: project.id,
    details: `Project ${project.projectCode} unarchived by ${user.fullName || user.username}. Status set to DESIGN.`,
  });
  await syncProjectInfoFileWithoutBlocking(project, "project unarchive");

  return {
    project,
    message: "Project restored from archive.",
  };
}

export async function permanentlyDeleteEmptyProject(
  user: AuthenticatedUser,
  projectId: number,
  input: DeleteProjectInput,
) {
  requirePermission(user, "projects:delete");

  const id = projectIdSchema.parse(projectId);
  const data = deleteProjectSchema.parse(input);
  const project = await getProjectForManagement(id);

  if (data.projectCodeConfirmation !== project.projectCode) {
    throw new Error("Project Code confirmation does not match.");
  }

  const assessment = await assessProjectPermanentDelete(project.id, project.projectCode);

  if (!assessment.canDelete) {
    throw new Error(buildArchiveInsteadMessage(assessment));
  }

  try {
    await deleteProjectStorageFolder(project.projectCode);
  } catch {
    throw new Error("Project folder could not be deleted safely. The project was not deleted.");
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.projectTag.deleteMany({
        where: {
          projectId: project.id,
        },
      });
      await tx.project.delete({
        where: {
          id: project.id,
        },
      });
      await tx.activityLog.create({
        data: {
          userId: user.id,
          projectId: null,
          action: ActivityAction.PROJECT_DELETED,
          entityType: "Project",
          entityId: project.id,
          details: `Empty project ${project.projectCode} permanently deleted by ${user.fullName || user.username}.`,
        },
      });
    });
  } catch (error) {
    await recreateProjectFolderAfterFailedDelete(project);
    throw new Error("Project could not be deleted safely. Project metadata was preserved.");
  }

  return {
    deleted: true,
    message: "Empty project permanently deleted.",
    summary: assessment,
  };
}

export async function resolveProjectShortLink(user: AuthenticatedUser, projectCode: string) {
  requirePermission(user, "projects:read");

  const safeProjectCode = projectCodeParamSchema.parse(projectCode);

  return prisma.project.findFirst({
    where: {
      projectCode: safeProjectCode,
      deletedAt: null,
    },
    include: PROJECT_DETAIL_INCLUDE,
  });
}

export async function searchProjects(user: AuthenticatedUser, query: ProjectListQuery) {
  requirePermission(user, "projects:read");

  return listProjects(query);
}

async function getProjectForManagement(projectId: number): Promise<ProjectDetailPayload> {
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      deletedAt: null,
    },
    include: PROJECT_DETAIL_INCLUDE,
  });

  if (!project) {
    throw new Error("Project not found.");
  }

  return project;
}

async function syncProjectInfoFileWithoutBlocking(project: ProjectDetailPayload, context: string): Promise<void> {
  try {
    const result = await syncProjectInfoFile(project);

    if (result.skipped) {
      logProjectInfoSyncSkipped(project.projectCode, context, result.reason);
    }
  } catch {
    logProjectInfoSyncFailure(project.projectCode, context);
  }
}

async function assessProjectPermanentDelete(projectId: number, projectCode: string) {
  const [fileCount, versionCount, revisionCount, commissioningCount, serviceCount, tagLinkCount, physicalStorage] =
    await Promise.all([
      prisma.projectFile.count({
        where: {
          projectId,
        },
      }),
      prisma.fileVersion.count({
        where: {
          file: {
            projectId,
          },
        },
      }),
      prisma.projectRevision.count({
        where: {
          projectId,
        },
      }),
      prisma.commissioningRecord.count({
        where: {
          projectId,
        },
      }),
      prisma.serviceRecord.count({
        where: {
          projectId,
        },
      }),
      prisma.projectTag.count({
        where: {
          projectId,
        },
      }),
      listProjectStorageFiles(projectCode),
    ]);
  const unexpectedPhysicalFiles = physicalStorage.files.filter((filePath) => !isProjectInfoSystemFile(filePath));
  const blockers = [
    fileCount > 0 ? `${fileCount} file record${fileCount === 1 ? "" : "s"}` : null,
    versionCount > 0 ? `${versionCount} version record${versionCount === 1 ? "" : "s"}` : null,
    revisionCount > 0 ? `${revisionCount} revision record${revisionCount === 1 ? "" : "s"}` : null,
    commissioningCount > 0 ? `${commissioningCount} commissioning record${commissioningCount === 1 ? "" : "s"}` : null,
    serviceCount > 0 ? `${serviceCount} service record${serviceCount === 1 ? "" : "s"}` : null,
    unexpectedPhysicalFiles.length > 0
      ? `${unexpectedPhysicalFiles.length} physical file${unexpectedPhysicalFiles.length === 1 ? "" : "s"}`
      : null,
  ].filter((blocker): blocker is string => Boolean(blocker));

  return {
    projectCode,
    databaseFileCount: fileCount,
    versionCount,
    revisionCount,
    commissioningCount,
    serviceCount,
    tagLinkCount,
    folderExists: physicalStorage.folderExists,
    unexpectedPhysicalFileCount: unexpectedPhysicalFiles.length,
    canDelete: blockers.length === 0,
    blockers,
  };
}

function buildArchiveInsteadMessage(assessment: Awaited<ReturnType<typeof assessProjectPermanentDelete>>): string {
  return `This project contains ${assessment.blockers.join(", ")}. Archive the project instead of permanently deleting it.`;
}

async function recreateProjectFolderAfterFailedDelete(project: ProjectDetailPayload): Promise<void> {
  try {
    await createProjectFolders(project.projectCode);
    await syncProjectInfoFile(project);
  } catch {
    logProjectInfoSyncFailure(project.projectCode, "failed delete rollback");
  }
}

async function resolveCustomer(input: CustomerInput) {
  if (input.customerId) {
    const customer = await prisma.customer.findFirst({
      where: {
        id: input.customerId,
        deletedAt: null,
      },
    });

    if (!customer) {
      throw new Error("Customer not found.");
    }

    return customer;
  }

  const customerCode = input.customerCode || buildCustomerCode(input.customerName || "");

  return prisma.customer.upsert({
    where: {
      customerCode,
    },
    update: {
      customerName: input.customerName,
      city: input.city,
      country: input.country,
      notes: input.notes,
      deletedAt: null,
    },
    create: {
      customerCode,
      customerName: input.customerName || customerCode,
      city: input.city,
      country: input.country,
      notes: input.notes,
    },
  });
}

async function assertProjectCodeAvailable(projectCode: string, excludeProjectId?: number): Promise<void> {
  const existing = await prisma.project.findUnique({
    where: {
      projectCode,
    },
  });

  if (existing && existing.id !== excludeProjectId) {
    throw new Error("Project code already exists.");
  }
}

async function assertSerialNumberAvailable(serialNumber: string, excludeProjectId?: number): Promise<void> {
  const existing = await prisma.project.findUnique({
    where: {
      serialNumber,
    },
  });

  if (existing && existing.id !== excludeProjectId) {
    throw new Error("Serial number already exists.");
  }
}

function buildCustomerCode(customerName: string): string {
  const normalized = customerName
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toUpperCase();

  if (!normalized) {
    throw new Error("Customer code or customer name is required.");
  }

  return normalized.slice(0, 50);
}

function buildProjectChangeLogs(
  before: ProjectWithCustomer,
  after: ProjectDetailPayload,
  user: AuthenticatedUser,
): string[] {
  const actor = user.fullName || user.username;
  const changes: Array<[string, string | null | undefined, string | null | undefined]> = [
    ["Project Code", before.projectCode, after.projectCode],
    ["Customer Project Code", before.customerProjectCode, after.customerProjectCode],
    ["Serial Number", before.serialNumber, after.serialNumber],
    ["Customer Name", before.customer.customerName, after.customer.customerName],
    ["Machine Name", before.machineName, after.machineName],
    ["Machine Type", before.machineType, after.machineType],
    ["PLC Brand", before.plcBrand, after.plcBrand],
    ["HMI Brand", before.hmiBrand, after.hmiBrand],
    ["Robot Brand", before.robotBrand, after.robotBrand],
    ["Project Status", before.status, after.status],
  ];

  return changes
    .filter(([, oldValue, newValue]) => normalizeLogValue(oldValue) !== normalizeLogValue(newValue))
    .map(([label, oldValue, newValue]) => `${label} changed: ${formatLogValue(oldValue)} -> ${formatLogValue(newValue)} by ${actor}.`);
}

async function updateProjectStoragePaths(
  tx: Prisma.TransactionClient,
  projectId: number,
  oldProjectCode: string,
  newProjectCode: string,
): Promise<void> {
  const files = await tx.projectFile.findMany({
    where: {
      projectId,
    },
    select: {
      id: true,
      storagePath: true,
      versions: {
        select: {
          id: true,
          storagePath: true,
        },
      },
    },
  });

  for (const file of files) {
    const nextFileStoragePath = renameProjectCodeInStoragePath(file.storagePath, oldProjectCode, newProjectCode);

    if (nextFileStoragePath !== file.storagePath) {
      await tx.projectFile.update({
        where: {
          id: file.id,
        },
        data: {
          storagePath: nextFileStoragePath,
        },
      });
    }

    for (const version of file.versions) {
      const nextVersionStoragePath = renameProjectCodeInStoragePath(version.storagePath, oldProjectCode, newProjectCode);

      if (nextVersionStoragePath !== version.storagePath) {
        await tx.fileVersion.update({
          where: {
            id: version.id,
          },
          data: {
            storagePath: nextVersionStoragePath,
          },
        });
      }
    }
  }
}

function renameProjectCodeInStoragePath(
  storagePath: string,
  oldProjectCode: string,
  newProjectCode: string,
): string {
  const oldPrefix = `projects/${oldProjectCode}/`;

  if (!storagePath.startsWith(oldPrefix)) {
    return storagePath;
  }

  return `projects/${newProjectCode}/${storagePath.slice(oldPrefix.length)}`;
}

function normalizeLogValue(value: string | null | undefined): string {
  return value?.trim() || "";
}

function formatLogValue(value: string | null | undefined): string {
  return normalizeLogValue(value) || "-";
}

function nullableUpdateValue(
  parsedValue: string | undefined,
  rawInput: Record<string, unknown>,
  key: string,
): string | null | undefined {
  if (!Object.prototype.hasOwnProperty.call(rawInput, key)) {
    return undefined;
  }

  if (typeof rawInput[key] === "string" && rawInput[key].trim() === "") {
    return null;
  }

  return parsedValue;
}
