/**
 * Wright's Path Coefficient Method for calculating inbreeding coefficient F.
 *
 * F(I) = sum over all common ancestors A of:
 *   (0.5)^(L1 + L2 + 1) * (1 + F(A))
 *
 * where L1 = number of steps from sire to A, L2 = number of steps from dam to A
 */

export interface AnimalRecord {
  id: number;
  name: string;
  code: string;
  sex: string;
  sireId: number | null;
  damId: number | null;
}

export interface PathwayInfo {
  ancestorId: number;
  ancestorName: string;
  ancestorCode: string;
  contribution: number;
  paths: string[];
}

export interface InbreedingCalcResult {
  fCoefficient: number;
  fPercent: number;
  riskLevel: "safe" | "low" | "moderate" | "high" | "very_high";
  riskLabel: string;
  commonAncestors: { id: number; name: string; code: string; contribution: number }[];
  pathways: string[];
}

function getRiskLevel(f: number): { level: "safe" | "low" | "moderate" | "high" | "very_high"; label: string } {
  if (f === 0) return { level: "safe", label: "ปลอดภัย (ไม่มีเลือดชิด)" };
  if (f < 0.0625) return { level: "low", label: "เสี่ยงต่ำ (< 6.25%)" };
  if (f < 0.125) return { level: "moderate", label: "เสี่ยงปานกลาง (6.25% - 12.5%)" };
  if (f < 0.25) return { level: "high", label: "เสี่ยงสูง (12.5% - 25%)" };
  return { level: "very_high", label: "เสี่ยงสูงมาก (> 25%)" };
}

/**
 * Get all ancestors of an animal up to a given depth, returning
 * a map of ancestor ID -> list of path lengths from this animal.
 */
function getAncestorPaths(
  animalId: number | null,
  animalMap: Map<number, AnimalRecord>,
  maxDepth: number,
  currentDepth: number = 0
): Map<number, number[]> {
  if (!animalId || currentDepth >= maxDepth) return new Map();

  const result = new Map<number, number[]>();
  const animal = animalMap.get(animalId);
  if (!animal) return result;

  // Add this animal itself
  result.set(animalId, [currentDepth]);

  // Recurse into sire and dam
  for (const parentId of [animal.sireId, animal.damId]) {
    if (!parentId) continue;
    const parentPaths = getAncestorPaths(parentId, animalMap, maxDepth, currentDepth + 1);
    for (const [id, depths] of parentPaths) {
      const existing = result.get(id) ?? [];
      result.set(id, [...existing, ...depths]);
    }
  }

  return result;
}

export function calculateInbreedingCoefficient(
  sireId: number,
  damId: number,
  animalMap: Map<number, AnimalRecord>,
  maxGenerations: number = 10
): InbreedingCalcResult {
  // Get all ancestor paths from sire and dam
  const sirePaths = getAncestorPaths(sireId, animalMap, maxGenerations);
  const damPaths = getAncestorPaths(damId, animalMap, maxGenerations);

  // Find common ancestors (excluding the sire and dam themselves)
  const commonAncestorIds = new Set<number>();
  for (const id of sirePaths.keys()) {
    if (id !== sireId && id !== damId && damPaths.has(id)) {
      commonAncestorIds.add(id);
    }
  }

  let totalF = 0;
  const pathwayInfos: PathwayInfo[] = [];

  for (const ancestorId of commonAncestorIds) {
    const ancestor = animalMap.get(ancestorId);
    if (!ancestor) continue;

    const sireDepths = sirePaths.get(ancestorId) ?? [];
    const damDepths = damPaths.get(ancestorId) ?? [];

    // F(A) for the ancestor (simplified: assume 0 for now unless already computed)
    const fA = 0;

    let ancestorContribution = 0;
    const paths: string[] = [];

    for (const l1 of sireDepths) {
      for (const l2 of damDepths) {
        const contribution = Math.pow(0.5, l1 + l2 + 1) * (1 + fA);
        ancestorContribution += contribution;
        paths.push(`พ่อ(${l1 + 1} ขั้น) → ${ancestor.name}[${ancestor.code}] ← แม่(${l2 + 1} ขั้น)`);
      }
    }

    totalF += ancestorContribution;
    pathwayInfos.push({
      ancestorId,
      ancestorName: ancestor.name,
      ancestorCode: ancestor.code,
      contribution: ancestorContribution,
      paths,
    });
  }

  // Sort by contribution descending
  pathwayInfos.sort((a, b) => b.contribution - a.contribution);

  const { level, label } = getRiskLevel(totalF);

  return {
    fCoefficient: Math.min(totalF, 1),
    fPercent: Math.min(totalF * 100, 100),
    riskLevel: level,
    riskLabel: label,
    commonAncestors: pathwayInfos.map((p) => ({
      id: p.ancestorId,
      name: p.ancestorName,
      code: p.ancestorCode,
      contribution: p.contribution,
    })),
    pathways: pathwayInfos.flatMap((p) => p.paths),
  };
}
