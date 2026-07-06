import type { EngineeringDetectionInput, EngineeringScannerResult } from "../engineering-detection.types";
import { compactMetrics, countByExtension, evidenceFromEntries, findEntry, getScannerEntries } from "./scanner-utils";

export function scanAbb(input: EngineeringDetectionInput): EngineeringScannerResult | null {
  const entries = getScannerEntries(input);
  const modCount = countByExtension(entries, [".mod"]);
  const sysCount = countByExtension(entries, [".sys"]);
  const robotWareHint = findEntry(entries, /robotware|rw[\s_-]?\d/i);
  const toolWorkobjectHints = entries.filter((entry) => /tool|wobj|workobject/i.test(entry.path)).length;

  if (!modCount && !sysCount && !robotWareHint && !/abb|rapid|robotware/i.test(`${input.manufacturer || ""} ${input.softwareName || ""} ${input.platform || ""}`)) {
    return null;
  }

  return {
    scannerName: "ABB Robot Scanner",
    detectedSystem: "ABB Robot",
    manufacturer: "ABB",
    platform: robotWareHint?.name || "RAPID / RobotWare",
    confidence: modCount || sysCount ? 88 : 72,
    summary: `Detected ${modCount + sysCount} ABB RAPID module files.`,
    metrics: compactMetrics([
      ["MOD modules", modCount],
      ["SYS modules", sysCount],
      ["RAPID module count", modCount + sysCount],
      ["RobotWare hint", robotWareHint?.name],
      ["Tool/workobject hints", toolWorkobjectHints],
    ]),
    evidence: [
      ...evidenceFromEntries(entries, /\.(mod|sys)$/i, "RAPID module"),
      ...evidenceFromEntries(entries, /robotware|rw[\s_-]?\d/i, "RobotWare hint", 3),
    ],
    warnings: [],
  };
}
