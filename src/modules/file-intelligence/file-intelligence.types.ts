export type FileIntelligenceKind = "pdf" | "image" | "video" | "archive" | "text" | "unsupported";

export interface FileIntelligenceField {
  label: string;
  value: string;
}

export interface FileIntelligenceSection {
  title: string;
  fields: FileIntelligenceField[];
}

export interface FileIntelligenceResult {
  kind: FileIntelligenceKind;
  status: "EXTRACTED" | "PARTIAL" | "UNSUPPORTED" | "FAILED";
  sections: FileIntelligenceSection[];
  warnings: string[];
}
