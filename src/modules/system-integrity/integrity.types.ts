export type IntegritySeverity = "PASSED" | "WARNING" | "ERROR";

export interface IntegrityIssue {
  severity: Exclude<IntegritySeverity, "PASSED">;
  code: string;
  message: string;
  path?: string;
  entityType?: string;
  entityId?: number;
}

export interface IntegrityCheckSummary {
  key: string;
  label: string;
  passed: boolean;
  warnings: number;
  errors: number;
}

export interface StorageIntegrityScanResult {
  healthScore: number;
  status: IntegritySeverity;
  passedChecks: number;
  warningCount: number;
  errorCount: number;
  totalChecks: number;
  scanDurationMs: number;
  scannedAt: Date;
  storageRoot: string;
  projectsRoot: string;
  checks: IntegrityCheckSummary[];
  warnings: IntegrityIssue[];
  errors: IntegrityIssue[];
}
