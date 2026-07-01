import { ActivityAction, type FileCategory, type Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { buildStoredFileName, resolveCategoryPlatform } from "../../lib/file-utils";
import { resolveEngineeringMetadataCode } from "../../lib/engineering-metadata";
import { requirePermission } from "../auth/permissions";
import type { AuthenticatedUser } from "../auth/auth.types";
import { logActivity } from "../activity/activity.service";
import {
  buildProjectFileStoragePath,
  buildPathFromRelativeStoragePath,
  calculateStoredFileSha256,
  getActiveStorageConfig,
  moveStoredFile,
} from "../storage/storage.service";
import type { ResolvedStoragePath } from "../storage/storage.types";
import type {
  DownloadResolution,
  DuplicateFileMatch,
  FinalizeUploadInput,
  PrepareUploadInput,
} from "./file.types";
import { fileIdSchema, finalizeUploadSchema, prepareUploadSchema } from "./file.validators";

const PROJECT_FILE_INCLUDE = {
  project: true,
} satisfies Prisma.ProjectFileInclude;

export async function prepareFileUpload(user: AuthenticatedUser, input: PrepareUploadInput) {
  requirePermission(user, "files:upload");

  const data = prepareUploadSchema.parse(input);
  const project = await requireActiveProject(data.projectId);
  const versionNo = data.versionNo || "V1.0";
  const platformCode = resolveUploadPlatformCode(data.category, data.manufacturer, data.softwareName, data.platform);
  const classification = resolveCategoryPlatform({
    category: data.category,
    originalFileName: data.originalFileName,
    platform: platformCode,
  });

  if (classification.warnings.length > 0 && !data.confirmWarnings) {
    return {
      ready: false,
      warnings: classification.warnings,
    };
  }

  const destination = buildStoredFileDestination({
    projectCode: project.projectCode,
    category: data.category,
    platform: classification.platform,
    originalFileName: data.originalFileName,
    versionNo,
  });

  return {
    ready: true,
    projectId: project.id,
    projectCode: project.projectCode,
    category: data.category,
    platform: classification.platform,
    originalFileName: data.originalFileName,
    storedFileName: destination.storedFileName,
    storagePath: destination.storagePath,
    versionNo,
    manufacturer: data.manufacturer,
    softwareName: data.softwareName,
    softwareVersion: data.softwareVersion,
    warnings: classification.warnings,
  };
}

export async function finalizeFileUpload(user: AuthenticatedUser, input: FinalizeUploadInput) {
  requirePermission(user, "files:upload");

  const data = finalizeUploadSchema.parse(input);
  const project = await requireActiveProject(data.projectId);
  const platformCode = resolveUploadPlatformCode(data.category, data.manufacturer, data.softwareName, data.platform);
  const classification = resolveCategoryPlatform({
    category: data.category,
    originalFileName: data.originalFileName,
    platform: platformCode,
  });

  if (classification.warnings.length > 0 && !data.confirmWarnings) {
    throw new Error("Upload has category/platform warnings that must be confirmed.");
  }

  const versionNo = data.versionNo || "V1.0";
  const destination = buildStoredFileDestination({
    projectCode: project.projectCode,
    category: data.category,
    platform: classification.platform,
    originalFileName: data.originalFileName,
    versionNo,
  });

  await moveTempFileIntoStorage(data.tempRelativePath, destination.storagePath);

  const checksum = data.checksum || (await calculateStoredFileSha256(destination.storagePath.relativePath));
  const duplicates = await detectDuplicateChecksums(checksum);

  const result = await prisma.$transaction(async (tx) => {
    const projectFile = await tx.projectFile.create({
      data: {
        projectId: project.id,
        category: data.category,
        platform: classification.platform === "GENERAL" ? null : classification.platform,
        manufacturer: data.manufacturer,
        softwareName: data.softwareName,
        softwareVersion: data.softwareVersion,
        originalFileName: data.originalFileName,
        storedFileName: destination.storedFileName,
        storagePath: destination.storagePath.relativePath,
        fileSize: data.fileSize,
        checksum,
        currentVersionNo: versionNo,
        uploadedById: user.id,
      },
    });

    const fileVersion = await tx.fileVersion.create({
      data: {
        fileId: projectFile.id,
        versionNo,
        changeNote: data.changeNote,
        manufacturer: data.manufacturer,
        softwareName: data.softwareName,
        softwareVersion: data.softwareVersion,
        originalFileName: data.originalFileName,
        storedFileName: destination.storedFileName,
        storagePath: destination.storagePath.relativePath,
        fileSize: data.fileSize,
        checksum,
        uploadedById: user.id,
      },
    });

    return {
      projectFile,
      fileVersion,
    };
  });

  await logActivity({
    userId: user.id,
    projectId: project.id,
    action: ActivityAction.FILE_UPLOADED,
    entityType: "ProjectFile",
    entityId: result.projectFile.id,
    details: `File uploaded as ${versionNo}. Duplicate matches: ${duplicates.length}.`,
  });

  const categoryUploadAction = getCategoryUploadActivityAction(data.category);

  if (categoryUploadAction) {
    await logActivity({
      userId: user.id,
      projectId: project.id,
      action: categoryUploadAction,
      entityType: "ProjectFile",
      entityId: result.projectFile.id,
      details: `${data.category} file uploaded as ${versionNo}.`,
    });
  }

  await logActivity({
    userId: user.id,
    projectId: project.id,
    action: ActivityAction.VERSION_CREATED,
    entityType: "FileVersion",
    entityId: result.fileVersion.id,
    details: `Initial version ${versionNo} created for file ${result.projectFile.id}.`,
  });

  return {
    ...result,
    duplicates,
    warnings: classification.warnings,
  };
}

function getCategoryUploadActivityAction(category: FileCategory): ActivityAction | null {
  if (category === "ELECTRICAL") {
    return ActivityAction.ELECTRICAL_UPLOADED;
  }

  if (category === "MECHANICAL") {
    return ActivityAction.MECHANICAL_UPLOADED;
  }

  if (category === "DOCUMENT") {
    return ActivityAction.DOCUMENT_UPLOADED;
  }

  return null;
}

export async function resolveFileDownload(
  user: AuthenticatedUser,
  fileId: number,
): Promise<DownloadResolution> {
  requirePermission(user, "files:download");

  const id = fileIdSchema.parse(fileId);
  const file = await prisma.projectFile.findFirst({
    where: {
      id,
      deletedAt: null,
      project: {
        deletedAt: null,
      },
    },
    include: PROJECT_FILE_INCLUDE,
  });

  if (!file) {
    throw new Error("File not found.");
  }

  const { root } = getActiveStorageConfig();
  const resolvedPath = buildPathFromRelativeStoragePath(root, file.storagePath);

  await logActivity({
    userId: user.id,
    projectId: file.projectId,
    action: ActivityAction.FILE_DOWNLOADED,
    entityType: "ProjectFile",
    entityId: file.id,
    details: `File ${file.id} download resolved.`,
  });

  return {
    fileId: file.id,
    projectId: file.projectId,
    projectCode: file.project.projectCode,
    originalFileName: file.originalFileName,
    storedFileName: file.storedFileName,
    absolutePath: resolvedPath.absolutePath,
    relativePath: resolvedPath.relativePath,
    fileSize: file.fileSize,
    checksum: file.checksum,
  };
}

export async function findDuplicateFilesByChecksum(checksum: string): Promise<DuplicateFileMatch[]> {
  return detectDuplicateChecksums(checksum);
}

export async function listProjectFiles(user: AuthenticatedUser, projectId: number) {
  requirePermission(user, "files:read");

  const project = await requireActiveProject(projectId);

  return prisma.projectFile.findMany({
    where: {
      projectId: project.id,
      deletedAt: null,
    },
    include: {
      versions: {
        orderBy: {
          uploadedAt: "desc",
        },
        include: {
          uploadedBy: {
            select: {
              id: true,
              username: true,
              email: true,
            },
          },
        },
      },
      uploadedBy: {
        select: {
          id: true,
          username: true,
          email: true,
        },
      },
    },
    orderBy: {
      uploadedAt: "desc",
    },
  });
}

export async function requireActiveProjectFile(fileId: number) {
  const id = fileIdSchema.parse(fileId);
  const file = await prisma.projectFile.findFirst({
    where: {
      id,
      deletedAt: null,
      project: {
        deletedAt: null,
      },
    },
    include: PROJECT_FILE_INCLUDE,
  });

  if (!file) {
    throw new Error("File not found.");
  }

  return file;
}

export async function getNextVersionNo(fileId: number): Promise<string> {
  const latest = await prisma.fileVersion.findFirst({
    where: {
      fileId,
    },
    orderBy: {
      uploadedAt: "desc",
    },
  });

  if (!latest) {
    return "V1.0";
  }

  const match = latest.versionNo.match(/^V(\d+)\.(\d+)$/);

  if (!match) {
    return "V1.0";
  }

  return `V${match[1]}.${Number(match[2]) + 1}`;
}

export function buildStoredFileDestination(input: {
  projectCode: string;
  category: FileCategory;
  platform?: string | null;
  originalFileName: string;
  versionNo: string;
}): { storedFileName: string; storagePath: ResolvedStoragePath } {
  const storedFileName = buildStoredFileName({
    projectCode: input.projectCode,
    category: input.category,
    platform: input.platform,
    version: input.versionNo,
    originalFileName: input.originalFileName,
  });
  const storagePath = buildProjectFileStoragePath({
    projectCode: input.projectCode,
    category: input.category,
    platform: input.platform,
    version: input.versionNo,
    originalFileName: input.originalFileName,
  });

  return {
    storedFileName,
    storagePath,
  };
}

function resolveUploadPlatformCode(
  category: FileCategory,
  manufacturer?: string | null,
  softwareName?: string | null,
  legacyPlatform?: string | null,
): string | null | undefined {
  return resolveEngineeringMetadataCode(category, manufacturer, softwareName) || legacyPlatform;
}

export async function moveTempFileIntoStorage(
  tempRelativePath: string,
  destination: ResolvedStoragePath,
): Promise<void> {
  await moveStoredFile(tempRelativePath, destination);
}

export async function detectDuplicateChecksums(checksum: string): Promise<DuplicateFileMatch[]> {
  const matches = await prisma.fileVersion.findMany({
    where: {
      checksum,
      file: {
        deletedAt: null,
        project: {
          deletedAt: null,
        },
      },
    },
    include: {
      file: {
        include: {
          project: true,
        },
      },
    },
    take: 20,
  });

  return matches.map((match) => ({
    fileId: match.fileId,
    projectId: match.file.projectId,
    projectCode: match.file.project.projectCode,
    originalFileName: match.originalFileName,
    versionNo: match.versionNo,
    checksum: match.checksum,
  }));
}

async function requireActiveProject(projectId: number) {
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      deletedAt: null,
    },
  });

  if (!project) {
    throw new Error("Project not found.");
  }

  return project;
}
