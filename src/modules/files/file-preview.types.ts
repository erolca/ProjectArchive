import type { FileIntelligenceResult } from "../file-intelligence/file-intelligence.types";

export type PreviewKind = "pdf" | "image" | "video" | "text" | "archive" | "unsupported";

export interface ArchiveTreeItem {
  name: string;
  path: string;
  type: "folder" | "file";
  size?: number | null;
  children?: ArchiveTreeItem[];
}

export interface FilePreviewMetadata {
  id: number;
  fileName: string;
  category: string;
  manufacturer?: string | null;
  softwareName?: string | null;
  softwareVersion?: string | null;
  platform?: string | null;
  archiveVersion: string;
  uploadedBy?: string | null;
  uploadedAt: Date;
  fileSize: bigint;
  checksum: string;
  version: string;
}

export interface FilePreviewResult {
  kind: PreviewKind;
  contentType: string;
  contentUrl?: string;
  metadata: FilePreviewMetadata;
  textContent?: string;
  archiveTree?: ArchiveTreeItem[];
  intelligence?: FileIntelligenceResult;
  message?: string;
}
