import path from "node:path";
import type { ResolvedStoragePath, StorageConfig, StorageProvider } from "../modules/storage/storage.types";

const DEFAULT_STORAGE_ROOT = "storage";

export function getStorageConfig(): StorageConfig {
  const root = process.env.STORAGE_ROOT || path.join(process.cwd(), DEFAULT_STORAGE_ROOT);
  const provider = normalizeStorageProvider(process.env.STORAGE_PROVIDER);

  return {
    root: normalizeStorageRoot(root),
    provider,
  };
}

export function normalizeStorageRoot(storageRoot: string): string {
  if (!storageRoot.trim()) {
    throw new Error("STORAGE_ROOT is required.");
  }

  return path.resolve(storageRoot);
}

export function buildStoragePath(...segments: string[]): ResolvedStoragePath {
  const { root } = getStorageConfig();

  return buildStoragePathFromRoot(root, ...segments);
}

export function buildStoragePathFromRoot(storageRoot: string, ...segments: string[]): ResolvedStoragePath {
  const normalizedRoot = normalizeStorageRoot(storageRoot);
  const safeSegments = segments.map(validatePathSegment);
  const absolutePath = path.resolve(normalizedRoot, ...safeSegments);

  assertInsideStorageRoot(normalizedRoot, absolutePath);

  return {
    absolutePath,
    relativePath: toStorageRelativePath(normalizedRoot, absolutePath),
  };
}

export function assertInsideStorageRoot(storageRoot: string, targetPath: string): void {
  const normalizedRoot = normalizeStorageRoot(storageRoot);
  const normalizedTarget = path.resolve(targetPath);
  const relative = path.relative(normalizedRoot, normalizedTarget);

  if (relative === "") {
    return;
  }

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Unsafe storage path: target is outside STORAGE_ROOT.");
  }
}

export function toStorageRelativePath(storageRoot: string, targetPath: string): string {
  assertInsideStorageRoot(storageRoot, targetPath);

  return path.relative(normalizeStorageRoot(storageRoot), path.resolve(targetPath)).replace(/\\/g, "/");
}

export function validatePathSegment(segment: string): string {
  const trimmed = segment.trim();

  if (!trimmed) {
    throw new Error("Storage path segment cannot be empty.");
  }

  if (trimmed === "." || trimmed === "..") {
    throw new Error("Unsafe storage path segment.");
  }

  if (trimmed.includes("/") || trimmed.includes("\\")) {
    throw new Error("Storage path segment must not contain path separators.");
  }

  if (path.isAbsolute(trimmed)) {
    throw new Error("Storage path segment must not be absolute.");
  }

  return trimmed;
}

function normalizeStorageProvider(provider?: string): StorageProvider {
  if (provider === "NAS") {
    return "NAS";
  }

  return "LOCAL";
}
