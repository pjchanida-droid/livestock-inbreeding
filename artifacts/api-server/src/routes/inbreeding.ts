import { Router } from "express";
import { db, animalsTable, inbreedingHistoryTable } from "@workspace/db";
import { desc, count, avg, sql } from "drizzle-orm";
import { CalculateInbreedingBody, ComputeAMatrixBody } from "@workspace/api-zod";
import {
  buildAMatrix,
  findCommonAncestors,
  getRiskLevel,
  type AnimalRecord,
} from "../lib/inbreeding";

const router = Router();

const RISK_LABELS: Record<string, string> = {
  safe: "ปลอดภัย (ไม่มีเลือดชิด)",
  low: "เสี่ยงต่ำ (< 6.25%)",
  moderate: "เสี่ยงปานกลาง (6.25% - 12.5%)",
  high: "เสี่ยงสูง (12.5% - 25%)",
  very_high: "เสี่ยงสูงมาก (> 25%)",
};

// POST /inbreeding/calculate
router.post("/inbreeding/calculate", async (req, res) => {
  const parsed = CalculateInbreedingBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: String(parsed.error) });
  }

  const { sireId, damId } = parsed.data;
  if (sireId === damId) {
    return res.status(400).json({ error: "พ่อพันธุ์และแม่พันธุ์ต้องเป็นสัตว์คนละตัว" });
  }

  try {
    const allRows = await db.select().from(animalsTable);
    const records: AnimalRecord[] = allRows.map((r) => ({
      id: r.id,
      name: r.name,
      code: r.code,
      sex: r.sex,
      farm: r.farm ?? null,
      sireId: r.sireId ?? null,
      damId: r.damId ?? null,
    }));
    const idMap = new Map<number, AnimalRecord>(records.map((r) => [r.id, r]));

    const sire = idMap.get(sireId);
    const dam = idMap.get(damId);
    if (!sire) return res.status(400).json({ error: "ไม่พบพ่อพันธุ์ในระบบ" });
    if (!dam) return res.status(400).json({ error: "ไม่พบแม่พันธุ์ในระบบ" });

    // Build A-matrix for all animals
    const { A, F, R } = buildAMatrix(records);

    // Offspring F = 0.5 * A[sire][dam]
    const aSireDam = A.get(sire.code)?.get(dam.code) ?? 0;
    const fOffspring = 0.5 * aSireDam;

    const fSire = F.get(sire.code) ?? 0;
    const fDam = F.get(dam.code) ?? 0;
    const rSireDam = R.get(sire.code)?.get(dam.code) ?? 0;

    const { level, label } = getRiskLevel(fOffspring);

    // Find common ancestors for pathway info
    const commonAncestors = findCommonAncestors(sireId, damId, idMap, F);

    // Save to history
    await db.insert(inbreedingHistoryTable).values({
      sireId,
      damId,
      fCoefficient: fOffspring,
      riskLevel: level,
    });

    return res.json({
      sireId,
      damId,
      sireName: sire.name,
      damName: dam.name,
      fCoefficient: fOffspring,
      fPercent: fOffspring * 100,
      rCoefficient: rSireDam,
      rPercent: rSireDam * 100,
      fSire,
      fSirePercent: fSire * 100,
      fDam,
      fDamPercent: fDam * 100,
      riskLevel: level,
      riskLabel: label,
      commonAncestors: commonAncestors.map((ca) => ({
        id: ca.id,
        name: ca.name,
        code: ca.code,
        contribution: ca.contribution,
      })),
      pathways: commonAncestors.flatMap((ca) => ca.pathways),
    });
  } catch (err) {
    req.log.error({ err }, "calculateInbreeding failed");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /inbreeding/history
router.get("/inbreeding/history", async (req, res) => {
  try {
    const history = await db
      .select({
        id: inbreedingHistoryTable.id,
        sireId: inbreedingHistoryTable.sireId,
        damId: inbreedingHistoryTable.damId,
        fCoefficient: inbreedingHistoryTable.fCoefficient,
        riskLevel: inbreedingHistoryTable.riskLevel,
        calculatedAt: inbreedingHistoryTable.calculatedAt,
        sireName: sql<string>`sire.name`,
        damName: sql<string>`dam.name`,
      })
      .from(inbreedingHistoryTable)
      .leftJoin(sql`animals sire`, sql`sire.id = ${inbreedingHistoryTable.sireId}`)
      .leftJoin(sql`animals dam`, sql`dam.id = ${inbreedingHistoryTable.damId}`)
      .orderBy(desc(inbreedingHistoryTable.calculatedAt))
      .limit(100);

    return res.json(
      history.map((h) => ({
        id: h.id,
        sireId: h.sireId,
        damId: h.damId,
        sireName: h.sireName,
        damName: h.damName,
        fCoefficient: h.fCoefficient,
        fPercent: h.fCoefficient * 100,
        rCoefficient: null,
        rPercent: null,
        fSire: null,
        fDam: null,
        riskLevel: h.riskLevel,
        riskLabel: RISK_LABELS[h.riskLevel] ?? h.riskLevel,
        calculatedAt: h.calculatedAt.toISOString(),
      }))
    );
  } catch (err) {
    req.log.error({ err }, "listInbreedingHistory failed");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /inbreeding/stats
router.get("/inbreeding/stats", async (req, res) => {
  try {
    const [{ total: totalAnimals }] = await db.select({ total: count() }).from(animalsTable);
    const [{ total: totalCalculations }] = await db.select({ total: count() }).from(inbreedingHistoryTable);
    const [{ avg: avgF }] = await db.select({ avg: avg(inbreedingHistoryTable.fCoefficient) }).from(inbreedingHistoryTable);

    const riskCounts = await db
      .select({ riskLevel: inbreedingHistoryTable.riskLevel, cnt: count() })
      .from(inbreedingHistoryTable)
      .groupBy(inbreedingHistoryTable.riskLevel);

    const riskBreakdown = riskCounts.map((r) => ({
      level: r.riskLevel,
      label: RISK_LABELS[r.riskLevel] ?? r.riskLevel,
      count: r.cnt,
    }));

    const safeCount = riskBreakdown.find((r) => r.level === "safe")?.count ?? 0;

    return res.json({
      totalAnimals: Number(totalAnimals),
      totalCalculations: Number(totalCalculations),
      averageF: avgF != null ? Number(avgF) : 0,
      safePairings: safeCount,
      riskyPairings: Number(totalCalculations) - safeCount,
      riskBreakdown,
    });
  } catch (err) {
    req.log.error({ err }, "getInbreedingStats failed");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /inbreeding/a-matrix
router.post("/inbreeding/a-matrix", async (req, res) => {
  const parsed = ComputeAMatrixBody.safeParse(req.body);
  const farm = parsed.success && parsed.data?.farm ? parsed.data.farm : null;

  try {
    const allRows = await db.select().from(animalsTable);
    const filtered = farm ? allRows.filter((r) => r.farm === farm) : allRows;

    if (filtered.length === 0) {
      return res.json({ animals: [] });
    }

    // Build A-matrix using ALL animals for correct F values (cross-farm pedigrees)
    const allRecords: AnimalRecord[] = allRows.map((r) => ({
      id: r.id,
      name: r.name,
      code: r.code,
      sex: r.sex,
      farm: r.farm ?? null,
      sireId: r.sireId ?? null,
      damId: r.damId ?? null,
    }));
    const { F } = buildAMatrix(allRecords);

    const animals = filtered.map((a) => {
      const f = F.get(a.code) ?? 0;
      return {
        id: a.id,
        name: a.name,
        code: a.code,
        sex: a.sex,
        farm: a.farm ?? null,
        fCoefficient: f,
        fPercent: f * 100,
      };
    });

    return res.json({ animals });
  } catch (err) {
    req.log.error({ err }, "computeAMatrix failed");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
