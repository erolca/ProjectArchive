"use client";

export function formatDateTime(value?: string | null): string {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString();
}

export function formatDate(value?: string | null): string {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleDateString();
}

export function formatBytes(value?: string | number | null): string {
  if (value === undefined || value === null) {
    return "-";
  }

  const bytes = typeof value === "string" ? Number(value) : value;

  if (!Number.isFinite(bytes)) {
    return String(value);
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const units = ["KB", "MB", "GB", "TB"];
  let size = bytes / 1024;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(size >= 10 ? 1 : 2)} ${units[unitIndex]}`;
}

export function shortHash(value?: string | null): string {
  if (!value) {
    return "-";
  }

  return value.length > 16 ? `${value.slice(0, 12)}...${value.slice(-4)}` : value;
}
