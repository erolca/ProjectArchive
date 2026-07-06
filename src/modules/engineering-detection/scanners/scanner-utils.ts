import path from "node:path";
import type { ArchiveTreeItem } from "../../files/file-preview.types";
import type { EngineeringDetectionInput, EngineeringScannerMetric } from "../engineering-detection.types";

export interface ScannerEntry {
  path: string;
  name: string;
  extension: string;
  type: "folder" | "file";
}

export function getScannerEntries(input: EngineeringDetectionInput): ScannerEntry[] {
  const archiveEntries = flattenArchiveTree(input.archiveTree || []);
  const baseEntry: ScannerEntry = {
    path: input.fileName,
    name: path.basename(input.fileName),
    extension: path.extname(input.fileName).toLowerCase(),
    type: "file",
  };

  return [baseEntry, ...archiveEntries];
}

export function countByExtension(entries: ScannerEntry[], extensions: string[]): number {
  const normalized = extensions.map((extension) => extension.toLowerCase());

  return entries.filter((entry) => entry.type === "file" && normalized.includes(entry.extension)).length;
}

export function findByExtension(entries: ScannerEntry[], extensions: string[]): ScannerEntry | null {
  const normalized = extensions.map((extension) => extension.toLowerCase());

  return entries.find((entry) => entry.type === "file" && normalized.includes(entry.extension)) || null;
}

export function hasEntry(entries: ScannerEntry[], pattern: RegExp): boolean {
  return entries.some((entry) => pattern.test(normalize(entry.path)));
}

export function findEntry(entries: ScannerEntry[], pattern: RegExp): ScannerEntry | null {
  return entries.find((entry) => pattern.test(normalize(entry.path))) || null;
}

export function evidenceFromEntries(entries: ScannerEntry[], pattern: RegExp, label: string, limit = 5): string[] {
  return entries
    .filter((entry) => pattern.test(normalize(entry.path)))
    .slice(0, limit)
    .map((entry) => `${label}: ${entry.path}`);
}

export function compactMetrics(items: Array<[string, string | number | boolean | null | undefined]>): EngineeringScannerMetric[] {
  return items
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .map(([label, value]) => ({
      label,
      value: value as string | number | boolean,
    }));
}

export function normalize(value: string): string {
  return value.replaceAll("\\", "/").toLowerCase();
}

export function extensionVersion(entry: ScannerEntry | null, prefix: string): string | null {
  if (!entry) return null;

  const match = entry.extension.match(new RegExp(`^\\.${prefix}(\\d+)$`, "i"));

  return match ? match[1] : null;
}

function flattenArchiveTree(tree: ArchiveTreeItem[]): ScannerEntry[] {
  return tree.flatMap((item) => [
    {
      path: item.path,
      name: item.name,
      extension: item.type === "file" ? path.extname(item.name).toLowerCase() : "",
      type: item.type,
    },
    ...flattenArchiveTree(item.children || []),
  ]);
}
