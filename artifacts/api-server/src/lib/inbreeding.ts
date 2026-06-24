/**
 * Henderson's Tabular Method for computing the Additive Relationship Matrix (A-Matrix).
 *
 * The A-matrix diagonal A[i][i] = 1 + F_i, where F_i is the inbreeding coefficient.
 * The off-diagonal A[i][j] is twice the kinship coefficient between i and j.
 *
 * Algorithm (in topological order — ancestors before descendants):
 *   A[i][i] = 1 + 0.5 * A[sire_i][dam_i]
 *   A[i][j] = 0.5 * (A[sire_i][j] + A[dam_i][j])   for j < i (in topological order)
 *   A[j][i] = A[i][j]
 *
 * Inbreeding coefficient: F_i = A[i][i] - 1
 * Relationship coefficient: R[i][j] = A[i][j] / sqrt(A[i][i] * A[j][j])
 * Offspring F prediction: F_offspring = 0.5 * A[sire][dam]
 */

export interface AnimalRecord {
  id: number;
  name: string;
  code: string;
  sex: string;
  farm: string | null;
  sireId: number | null;
  damId: number | null;
}

export interface AMatrixResult {
  /** Ordered list of animal codes (topological order) */
  orderedCodes: string[];
  /** A-matrix as nested map: code -> code -> value */
  A: Map<string, Map<string, number>>;
  /** F_i = A[i][i] - 1 */
  F: Map<string, number>;
  /** R[i][j] = A[i][j] / sqrt(A[i][i] * A[j][j]) */
  R: Map<string, Map<string, number>>;
}

/** Topological sort using Kahn's algorithm — ancestors before descendants */
function topologicalSort(animals: AnimalRecord[]): AnimalRecord[] {
  const idMap = new Map<number, AnimalRecord>(animals.map((a) => [a.id, a]));
  const inDegree = new Map<number, number>(animals.map((a) => [a.id, 0]));
  const children = new Map<number, number[]>(animals.map((a) => [a.id, []]));

  for (const a of animals) {
    for (const parentId of [a.sireId, a.damId]) {
      if (parentId && idMap.has(parentId)) {
        inDegree.set(a.id, (inDegree.get(a.id) ?? 0) + 1);
        children.get(parentId)!.push(a.id);
      }
    }
  }

  const queue: number[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }

  const sorted: AnimalRecord[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    const animal = idMap.get(id);
    if (animal) sorted.push(animal);
    for (const childId of children.get(id) ?? []) {
      const newDeg = (inDegree.get(childId) ?? 0) - 1;
      inDegree.set(childId, newDeg);
      if (newDeg === 0) queue.push(childId);
    }
  }

  return sorted;
}

/** Build A-matrix using Henderson's Tabular Method */
export function buildAMatrix(animals: AnimalRecord[]): AMatrixResult {
  const ordered = topologicalSort(animals);
  const idMap = new Map<number, AnimalRecord>(animals.map((a) => [a.id, a]));

  // A matrix indexed by animal code
  const A = new Map<string, Map<string, number>>();
  const UNKNOWN = "__unknown__";

  // Initialize: unknown/base population animals have A[u][u] = 1
  A.set(UNKNOWN, new Map([[UNKNOWN, 1.0]]));

  const getA = (c1: string, c2: string): number => {
    return A.get(c1)?.get(c2) ?? A.get(c2)?.get(c1) ?? 0.0;
  };

  const setA = (c1: string, c2: string, val: number) => {
    if (!A.has(c1)) A.set(c1, new Map());
    A.get(c1)!.set(c2, val);
    if (!A.has(c2)) A.set(c2, new Map());
    A.get(c2)!.set(c1, val);
  };

  // Henderson tabular method
  // Base population assumption: unknown parents are treated as DISTINCT unrelated
  // individuals with F=0, so A[unknown_sire][unknown_dam] = 0 (unrelated).
  // This means: if either parent is unknown, A[i][i] = 1 + 0.5*0 = 1.0 (F=0).
  for (let i = 0; i < ordered.length; i++) {
    const animal = ordered[i];
    const ic = animal.code;

    const sire = animal.sireId ? idMap.get(animal.sireId) : null;
    const dam = animal.damId ? idMap.get(animal.damId) : null;

    // Diagonal: A[i][i] = 1 + 0.5 * A[sire][dam]
    // If either parent is unknown, kinship between unknown individuals = 0
    const aSireDam = sire && dam ? getA(sire.code, dam.code) : 0;
    setA(ic, ic, 1.0 + 0.5 * aSireDam);

    // Off-diagonal: A[i][j] = 0.5 * (A[sire][j] + A[dam][j]) for all j before i
    // Unknown parent contributes 0 kinship with any other animal
    for (let j = 0; j < i; j++) {
      const jc = ordered[j].code;
      const fromSire = sire ? getA(sire.code, jc) : 0;
      const fromDam = dam ? getA(dam.code, jc) : 0;
      setA(ic, jc, 0.5 * (fromSire + fromDam));
    }
  }

  // Extract F and R coefficients
  const F = new Map<string, number>();
  const R = new Map<string, Map<string, number>>();

  for (const a of ordered) {
    F.set(a.code, (getA(a.code, a.code) ?? 1.0) - 1.0);
    R.set(a.code, new Map());
  }

  for (const ai of ordered) {
    for (const aj of ordered) {
      const aij = getA(ai.code, aj.code);
      const aii = getA(ai.code, ai.code);
      const ajj = getA(aj.code, aj.code);
      const denom = Math.sqrt(aii * ajj);
      const r = denom > 0 ? aij / denom : 0.0;
      R.get(ai.code)!.set(aj.code, r);
    }
  }

  return { orderedCodes: ordered.map((a) => a.code), A, F, R };
}

/** Risk classification */
export interface RiskInfo {
  level: "safe" | "low" | "moderate" | "high" | "very_high";
  label: string;
}

export function getRiskLevel(f: number): RiskInfo {
  if (f === 0) return { level: "safe", label: "ปลอดภัย (ไม่มีเลือดชิด)" };
  if (f < 0.0625) return { level: "low", label: "เสี่ยงต่ำ (< 6.25%)" };
  if (f < 0.125) return { level: "moderate", label: "เสี่ยงปานกลาง (6.25% - 12.5%)" };
  if (f < 0.25) return { level: "high", label: "เสี่ยงสูง (12.5% - 25%)" };
  return { level: "very_high", label: "เสี่ยงสูงมาก (> 25%)" };
}

/** Identify common ancestors by path-tracing for annotation purposes */
export interface CommonAncestorInfo {
  id: number;
  name: string;
  code: string;
  contribution: number;
  pathways: string[];
}

function getAncestorPaths(
  animalId: number | null,
  idMap: Map<number, AnimalRecord>,
  depth: number,
  maxDepth: number
): Map<number, number[]> {
  if (!animalId || depth >= maxDepth) return new Map();
  const result = new Map<number, number[]>();
  const a = idMap.get(animalId);
  if (!a) return result;
  result.set(animalId, [depth]);
  for (const pid of [a.sireId, a.damId]) {
    if (!pid) continue;
    for (const [id, depths] of getAncestorPaths(pid, idMap, depth + 1, maxDepth)) {
      const existing = result.get(id) ?? [];
      result.set(id, [...existing, ...depths]);
    }
  }
  return result;
}

export function findCommonAncestors(
  sireId: number,
  damId: number,
  idMap: Map<number, AnimalRecord>,
  F: Map<string, number>
): CommonAncestorInfo[] {
  const sirePaths = getAncestorPaths(sireId, idMap, 0, 10);
  const damPaths = getAncestorPaths(damId, idMap, 0, 10);

  const result: CommonAncestorInfo[] = [];

  for (const [ancestorId, sireDepths] of sirePaths) {
    if (ancestorId === sireId || ancestorId === damId) continue;
    if (!damPaths.has(ancestorId)) continue;

    const ancestor = idMap.get(ancestorId);
    if (!ancestor) continue;

    const damDepths = damPaths.get(ancestorId)!;
    const fA = F.get(ancestor.code) ?? 0;
    let contribution = 0;
    const pathways: string[] = [];

    for (const l1 of sireDepths) {
      for (const l2 of damDepths) {
        const c = Math.pow(0.5, l1 + l2 + 1) * (1 + fA);
        contribution += c;
        pathways.push(`พ่อ(${l1 + 1}ขั้น) → ${ancestor.name}[${ancestor.code}] ← แม่(${l2 + 1}ขั้น)`);
      }
    }

    result.push({
      id: ancestor.id,
      name: ancestor.name,
      code: ancestor.code,
      contribution,
      pathways,
    });
  }

  return result.sort((a, b) => b.contribution - a.contribution);
}
