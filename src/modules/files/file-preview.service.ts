import { createReadStream } from "node:fs";
import { open, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { prisma } from "../../lib/prisma";
import { buildPathFromRelativeStoragePath, getActiveStorageConfig } from "../storage/storage.service";
import { requirePermission } from "../auth/permissions";
import type { AuthenticatedUser } from "../auth/auth.types";
import { fileIdSchema } from "./file.validators";
import type { ArchiveTreeItem, FilePreviewMetadata, FilePreviewResult, PreviewKind } from "./file-preview.types";

const execFileAsync = promisify(execFile);
const TEXT_PREVIEW_LIMIT_BYTES = 1024 * 1024;
const TEXT_EXTENSIONS = new Set([".txt", ".log", ".csv", ".json", ".xml"]);
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".bmp", ".gif", ".webp"]);
const VIDEO_EXTENSIONS = new Set([".mp4", ".webm"]);
const ARCHIVE_EXTENSIONS = new Set([".zip", ".rar", ".7z"]);

export async function getFilePreview(user: AuthenticatedUser, fileId: number): Promise<FilePreviewResult> {
  const file = await resolvePreviewFile(user, fileId);
  const kind = getPreviewKind(file.originalFileName);
  const metadata = toPreviewMetadata(file);
  const contentType = getContentType(file.originalFileName);

  if (kind === "text") {
    return {
      kind,
      contentType,
      metadata,
      textContent: await readTextPreview(file.absolutePath),
    };
  }

  if (kind === "archive") {
    const archiveTree = await readArchiveTree(file.absolutePath, file.originalFileName);

    return {
      kind,
      contentType,
      metadata,
      archiveTree,
      message: archiveTree.length === 1 && archiveTree[0]?.type === "file" ? "Archive tree preview is limited for this format on this server." : undefined,
    };
  }

  return {
    kind,
    contentType,
    metadata,
    contentUrl: kind === "unsupported" ? undefined : `/api/files/${file.id}/preview/content`,
    message: kind === "unsupported" ? "Preview is not supported for this file type. Use Download to open it locally." : undefined,
  };
}

export async function resolveFilePreviewContent(user: AuthenticatedUser, fileId: number) {
  const file = await resolvePreviewFile(user, fileId);
  const kind = getPreviewKind(file.originalFileName);

  if (!["pdf", "image", "video", "text"].includes(kind)) {
    throw new Error("Preview content is not available for this file type.");
  }

  const fileStat = await stat(file.absolutePath);

  return {
    absolutePath: file.absolutePath,
    fileName: file.originalFileName,
    contentType: getContentType(file.originalFileName),
    size: fileStat.size,
    stream: createReadStream(file.absolutePath),
  };
}

async function resolvePreviewFile(user: AuthenticatedUser, fileId: number) {
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
    include: {
      project: true,
      uploadedBy: {
        select: {
          username: true,
          email: true,
        },
      },
    },
  });

  if (!file) {
    throw new Error("File not found.");
  }

  const { root } = getActiveStorageConfig();
  const resolvedPath = buildPathFromRelativeStoragePath(root, file.storagePath);

  return {
    ...file,
    absolutePath: resolvedPath.absolutePath,
  };
}

function toPreviewMetadata(file: Awaited<ReturnType<typeof resolvePreviewFile>>): FilePreviewMetadata {
  return {
    id: file.id,
    fileName: file.originalFileName,
    category: file.category,
    manufacturer: file.manufacturer,
    softwareName: file.softwareName,
    softwareVersion: file.softwareVersion,
    platform: file.platform,
    archiveVersion: file.currentVersionNo,
    uploadedBy: file.uploadedBy?.username || file.uploadedBy?.email || null,
    uploadedAt: file.uploadedAt,
    fileSize: file.fileSize,
    checksum: file.checksum,
    version: file.currentVersionNo,
  };
}

function getPreviewKind(fileName: string): PreviewKind {
  const extension = path.extname(fileName).toLowerCase();

  if (extension === ".pdf") return "pdf";
  if (IMAGE_EXTENSIONS.has(extension)) return "image";
  if (VIDEO_EXTENSIONS.has(extension)) return "video";
  if (TEXT_EXTENSIONS.has(extension)) return "text";
  if (ARCHIVE_EXTENSIONS.has(extension)) return "archive";

  return "unsupported";
}

function getContentType(fileName: string): string {
  const extension = path.extname(fileName).toLowerCase();
  const contentTypes: Record<string, string> = {
    ".pdf": "application/pdf",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".bmp": "image/bmp",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".txt": "text/plain; charset=utf-8",
    ".log": "text/plain; charset=utf-8",
    ".csv": "text/csv; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".xml": "application/xml; charset=utf-8",
  };

  return contentTypes[extension] || "application/octet-stream";
}

async function readTextPreview(filePath: string): Promise<string> {
  const handle = await open(filePath, "r");

  try {
    const buffer = Buffer.alloc(TEXT_PREVIEW_LIMIT_BYTES);
    const result = await handle.read(buffer, 0, TEXT_PREVIEW_LIMIT_BYTES, 0);

    return buffer.subarray(0, result.bytesRead).toString("utf8");
  } finally {
    await handle.close();
  }
}

async function readArchiveTree(filePath: string, fileName: string): Promise<ArchiveTreeItem[]> {
  const extension = path.extname(fileName).toLowerCase();

  if (extension === ".zip") {
    return readZipTree(filePath);
  }

  return readArchiveTreeWith7Zip(filePath).catch(() => [
    {
      name: fileName,
      path: fileName,
      type: "file",
      size: null,
    },
  ]);
}

async function readZipTree(filePath: string): Promise<ArchiveTreeItem[]> {
  const buffer = await readFile(filePath);
  const entries: Array<{ path: string; size: number; isDirectory: boolean }> = [];
  const signature = 0x02014b50;

  for (let offset = 0; offset < buffer.length - 46; offset += 1) {
    if (buffer.readUInt32LE(offset) !== signature) {
      continue;
    }

    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const nameStart = offset + 46;
    const nameEnd = nameStart + fileNameLength;
    const entryPath = buffer.subarray(nameStart, nameEnd).toString("utf8");

    if (entryPath && !entryPath.includes("..")) {
      entries.push({
        path: entryPath.replaceAll("\\", "/"),
        size: uncompressedSize || compressedSize,
        isDirectory: entryPath.endsWith("/"),
      });
    }

    offset = nameEnd + extraLength + commentLength - 1;
  }

  return buildArchiveTree(entries);
}

async function readArchiveTreeWith7Zip(filePath: string): Promise<ArchiveTreeItem[]> {
  const { stdout } = await execFileAsync("7z", ["l", "-slt", filePath], {
    windowsHide: true,
    timeout: 15000,
    maxBuffer: 1024 * 1024 * 4,
  });
  const entries: Array<{ path: string; size: number; isDirectory: boolean }> = [];

  for (const block of stdout.split(/\r?\n\r?\n/)) {
    const pathMatch = block.match(/^Path = (.+)$/m);
    const folderMatch = block.match(/^Folder = (\+|-)$/m);
    const sizeMatch = block.match(/^Size = (\d+)$/m);
    const entryPath = pathMatch?.[1];

    if (!entryPath || entryPath === filePath || entryPath.includes("..")) {
      continue;
    }

    entries.push({
      path: entryPath.replaceAll("\\", "/"),
      size: Number(sizeMatch?.[1] || 0),
      isDirectory: folderMatch?.[1] === "+",
    });
  }

  return buildArchiveTree(entries);
}

function buildArchiveTree(entries: Array<{ path: string; size: number; isDirectory: boolean }>): ArchiveTreeItem[] {
  const roots: ArchiveTreeItem[] = [];

  for (const entry of entries) {
    const parts = entry.path.split("/").filter(Boolean);
    let level = roots;
    let currentPath = "";

    parts.forEach((part, index) => {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const isLast = index === parts.length - 1;
      let node = level.find((item) => item.name === part);

      if (!node) {
        node = {
          name: part,
          path: currentPath,
          type: isLast && !entry.isDirectory ? "file" : "folder",
          size: isLast && !entry.isDirectory ? entry.size : null,
          children: isLast && !entry.isDirectory ? undefined : [],
        };
        level.push(node);
      }

      if (node.type === "folder") {
        node.children ||= [];
        level = node.children;
      }
    });
  }

  return roots;
}
