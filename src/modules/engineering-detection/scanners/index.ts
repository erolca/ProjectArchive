import type { EngineeringDetectionInput, EngineeringScannerResult } from "../engineering-detection.types";
import { scanAbb } from "./abb.scanner";
import { scanBeckhoff } from "./beckhoff.scanner";
import { scanDocument } from "./document.scanner";
import { scanKuka } from "./kuka.scanner";
import { scanSiemens } from "./siemens.scanner";
import { scanYaskawa } from "./yaskawa.scanner";

const SCANNERS = [scanBeckhoff, scanSiemens, scanYaskawa, scanKuka, scanAbb, scanDocument];

export function runEngineeringScanners(input: EngineeringDetectionInput): EngineeringScannerResult[] {
  return SCANNERS.flatMap((scanner) => {
    try {
      const result = scanner(input);

      return result ? [result] : [];
    } catch {
      return [];
    }
  }).sort((left, right) => right.confidence - left.confidence);
}
