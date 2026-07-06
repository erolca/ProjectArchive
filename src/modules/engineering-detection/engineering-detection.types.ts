import type { ArchiveTreeItem } from "../files/file-preview.types";
import type { FileIntelligenceResult } from "../file-intelligence/file-intelligence.types";

export type EngineeringDetectionCategory = "PLC" | "ROBOT" | "HMI" | "VISION" | "ELECTRICAL" | "UNKNOWN";

export interface EngineeringScannerMetric {
  label: string;
  value: string | number | boolean;
}

export interface EngineeringScannerResult {
  scannerName: string;
  detectedSystem: string;
  manufacturer: string;
  platform: string;
  confidence: number;
  summary: string;
  metrics: EngineeringScannerMetric[];
  evidence: string[];
  warnings: string[];
}

export interface EngineeringDetectionInput {
  fileName: string;
  category?: string | null;
  manufacturer?: string | null;
  platform?: string | null;
  softwareName?: string | null;
  archiveTree?: ArchiveTreeItem[];
  intelligence?: FileIntelligenceResult;
}

export interface EngineeringDetectionResult {
  detectedType: string | null;
  category: EngineeringDetectionCategory;
  manufacturer: string | null;
  platform: string | null;
  confidence: number;
  evidence: string[];
  warnings: string[];
  scannerResults: EngineeringScannerResult[];
}
