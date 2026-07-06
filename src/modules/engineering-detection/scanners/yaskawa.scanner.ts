import type { EngineeringDetectionInput, EngineeringScannerResult } from "../engineering-detection.types";
import { compactMetrics, countByExtension, evidenceFromEntries, findEntry, getScannerEntries } from "./scanner-utils";

export function scanYaskawa(input: EngineeringDetectionInput): EngineeringScannerResult | null {
  const entries = getScannerEntries(input);
  const jobCount = countByExtension(entries, [".jbi"]);
  const parameterFiles = countByExtension(entries, [".dat", ".cnd", ".prm", ".lst"]);
  const controllerHint = findEntry(entries, /yrc1000|dx200|fs100/i);
  const frameHints = entries.filter((entry) => /tool|user[\s_-]*frame|uframe|tframe/i.test(entry.path)).length;

  if (!jobCount && !parameterFiles && !controllerHint && !/yaskawa|motoman/i.test(`${input.manufacturer || ""} ${input.softwareName || ""} ${input.platform || ""}`)) {
    return null;
  }

  return {
    scannerName: "Yaskawa Robot Scanner",
    detectedSystem: "Yaskawa Robot",
    manufacturer: "Yaskawa",
    platform: controllerHint?.name || "Yaskawa",
    confidence: jobCount ? 92 : 72,
    summary: jobCount ? `Detected ${jobCount} Yaskawa job files.` : "Detected Yaskawa robot archive hints.",
    metrics: compactMetrics([
      ["JBI job files", jobCount],
      ["DAT / parameter files", parameterFiles],
      ["Tool/user frame hints", frameHints],
      ["Controller hint", controllerHint?.name],
    ]),
    evidence: [
      ...evidenceFromEntries(entries, /\.jbi$/i, "Job file"),
      ...evidenceFromEntries(entries, /\.(dat|cnd|prm|lst)$/i, "Parameter file"),
      ...evidenceFromEntries(entries, /yrc1000|dx200|fs100/i, "Controller hint", 3),
    ],
    warnings: [],
  };
}
