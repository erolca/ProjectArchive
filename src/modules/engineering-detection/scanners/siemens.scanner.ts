import type { EngineeringDetectionInput, EngineeringScannerResult } from "../engineering-detection.types";
import { compactMetrics, evidenceFromEntries, extensionVersion, findByExtension, getScannerEntries } from "./scanner-utils";

export function scanSiemens(input: EngineeringDetectionInput): EngineeringScannerResult | null {
  const entries = getScannerEntries(input);
  const tiaProject = findByExtension(entries, [".ap10", ".ap11", ".ap12", ".ap13", ".ap14", ".ap15", ".ap16", ".ap17", ".ap18", ".ap19", ".ap20"]);
  const tiaArchive = findByExtension(entries, [".zap10", ".zap11", ".zap12", ".zap13", ".zap14", ".zap15", ".zap16", ".zap17", ".zap18", ".zap19", ".zap20"]);
  const step7Project = findByExtension(entries, [".s7p"]);
  const metadataHint = /siemens|tia|step7|step 7/i.test(`${input.manufacturer || ""} ${input.softwareName || ""} ${input.platform || ""} ${input.fileName}`);

  if (!tiaProject && !tiaArchive && !step7Project && !metadataHint) {
    return null;
  }

  const isStep7 = Boolean(step7Project && !tiaProject && !tiaArchive);
  const version = extensionVersion(tiaProject, "ap") || extensionVersion(tiaArchive, "zap");
  const mainProject = tiaProject || tiaArchive || step7Project;

  return {
    scannerName: "Siemens TIA / STEP7 Scanner",
    detectedSystem: isStep7 ? "Siemens STEP7" : "Siemens TIA Portal",
    manufacturer: "Siemens",
    platform: isStep7 ? "STEP7" : "TIA Portal",
    confidence: mainProject ? 94 : 76,
    summary: mainProject ? `Detected Siemens project/archive indicator ${mainProject.name}.` : "Detected Siemens engineering metadata hints.",
    metrics: compactMetrics([
      ["Project Type", isStep7 ? "STEP7 project" : "TIA Portal project/archive"],
      ["Possible TIA Version", version ? `V${version}` : null],
      ["Main project/archive file", mainProject?.path],
    ]),
    evidence: [
      ...evidenceFromEntries(entries, /\.(ap|zap|zal)\d+$/i, "TIA indicator"),
      ...evidenceFromEntries(entries, /\.s7p$/i, "STEP7 indicator"),
    ],
    warnings: [],
  };
}
