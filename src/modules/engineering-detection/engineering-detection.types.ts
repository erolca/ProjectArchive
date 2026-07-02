import type { ArchiveTreeItem } from "../files/file-preview.types";

export type EngineeringDetectionCategory = "PLC" | "ROBOT" | "HMI" | "VISION" | "ELECTRICAL" | "UNKNOWN";

export interface EngineeringDetectionInput {
  fileName: string;
  category?: string | null;
  manufacturer?: string | null;
  platform?: string | null;
  softwareName?: string | null;
  archiveTree?: ArchiveTreeItem[];
}

export interface EngineeringDetectionResult {
  detectedType: string | null;
  category: EngineeringDetectionCategory;
  manufacturer: string | null;
  platform: string | null;
  confidence: number;
  evidence: string[];
  warnings: string[];
}
