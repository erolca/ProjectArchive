import { ActivityAction } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { calculateStoredFileSha256 } from "../storage/storage.service";
import { logActivity } from "../activity/activity.service";
import type { AuthenticatedUser } from "../auth/auth.types";
import { requirePermission } from "../auth/permissions";
import type { CreateFileVersionInput } from "./file.types";
import { createFileVersionSchema } from "./file.validators";
import {
  buildStoredFileDestination,
  detectDuplicateChecksums,
  getNextVersionNo,
  moveTempFileIntoStorage,
  requireActiveProjectFile,
} from "./file.service";

export async function createFileVersion(user: AuthenticatedUser, input: CreateFileVersionInput) {
  requirePermission(user, "versions:create");

  const data = createFileVersionSchema.parse(input);
  const existingFile = await requireActiveProjectFile(data.fileId);
  const versionNo = data.versionNo || (await getNextVersionNo(existingFile.id));
  const destination = buildStoredFileDestination({
    projectCode: existingFile.project.projectCode,
    category: existingFile.category,
    platform: existingFile.platform,
    originalFileName: data.originalFileName,
    versionNo,
  });

  await moveTempFileIntoStorage(data.tempRelativePath, destination.storagePath);

  const checksum = data.checksum || (await calculateStoredFileSha256(destination.storagePath.relativePath));
  const duplicates = await detectDuplicateChecksums(checksum);

  const fileVersion = await prisma.$transaction(async (tx) => {
    await tx.projectFile.update({
      where: {
        id: existingFile.id,
      },
      data: {
        originalFileName: data.originalFileName,
        storedFileName: destination.storedFileName,
        storagePath: destination.storagePath.relativePath,
        fileSize: data.fileSize,
        checksum,
        currentVersionNo: versionNo,
        uploadedById: user.id,
        uploadedAt: new Date(),
      },
    });

    return tx.fileVersion.create({
      data: {
        fileId: existingFile.id,
        versionNo,
        changeNote: data.changeNote,
        originalFileName: data.originalFileName,
        storedFileName: destination.storedFileName,
        storageProvider: existingFile.storageProvider,
        storagePath: destination.storagePath.relativePath,
        fileSize: data.fileSize,
        checksum,
        uploadedById: user.id,
      },
    });
  });

  await logActivity({
    userId: user.id,
    projectId: existingFile.projectId,
    action: ActivityAction.VERSION_CREATED,
    entityType: "FileVersion",
    entityId: fileVersion.id,
    details: `Version ${versionNo} created for file ${existingFile.id}. Duplicate matches: ${duplicates.length}.`,
  });

  return {
    fileVersion,
    duplicates,
  };
}
