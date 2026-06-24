import { Router } from "express";
import { db, animalsTable, inbreedingHistoryTable } from "@workspace/db";
import { eq, desc, count, avg, sql } from "drizzle-orm";
import { CalculateInbreedingBody } from "@workspace/api-zod";
import { calculateInbreedingCoefficient, type AnimalRecord } from "../lib/inbreeding";

const router = Router();

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
    // Load all animals for pedigree traversal
    const allAnimals = await db.select().from(animalsTable);
    const animalMap = new Map<number, AnimalRecord>(
      allAnimals.map((a) => [
        a.id,
        {
          id: a.id,
          name: a.name,
          code: a.code,
          sex: a.sex,
          sireId: a.sireId ?? null,
          damId: a.damId ?? null,
        },
      ])
    );

    const sire = animalMap.get(sireId);
    const dam = animalMap.get(damId);

    if (!sire) {
      return res.status(400).json({ error: "ไม่พบพ่อพันธุ์ในระบบ" });
    }
    if (!dam) {
      return res.status(400).json({ error: "ไม่พบแม่พันธุ์ในระบบ" });
    }

    const result = calculateInbreedingCoefficient(sireId, damId, animalMap);

    // Save to history
    await db.insert(inbreedingHistoryTable).values({
      sireId,
      damId,
      fCoefficient: result.fCoefficient,
      riskLevel: result.riskLevel,
    });

    return res.json({
      sireId,
      damId,
      sireName: sire.name,
      damName: dam.name,
      ...result,
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
      .leftJoin(
        sql`animals sire`,
        sql`sire.id = ${inbreedingHistoryTable.sireId}`
      )
      .leftJoin(
        sql`animals dam`,
        sql`dam.id = ${inbreedingHistoryTable.damId}`
      )
      .orderBy(desc(inbreedingHistoryTable.calculatedAt))
      .limit(50);

    const riskLabels: Record<string, string> = {
      safe: "ปลอดภัย (ไม่มีเลือดชิด)",
      low: "เสี่ยงต่ำ (< 6.25%)",
      moderate: "เสี่ยงปานกลาง (6.25% - 12.5%)",
      high: "เสี่ยงสูง (12.5% - 25%)",
      very_high: "เสี่ยงสูงมาก (> 25%)",
    };

    return res.json(
      history.map((h) => ({
        ...h,
        fPercent: h.fCoefficient * 100,
        riskLabel: riskLabels[h.riskLevel] ?? h.riskLevel,
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
    const [{ total: totalAnimals }] = await db
      .select({ total: count() })
      .from(animalsTable);

    const [{ total: totalCalculations }] = await db
      .select({ total: count() })
      .from(inbreedingHistoryTable);

    const [{ avg: avgF }] = await db
      .select({ avg: avg(inbreedingHistoryTable.fCoefficient) })
      .from(inbreedingHistoryTable);

    const riskCounts = await db
      .select({
        riskLevel: inbreedingHistoryTable.riskLevel,
        cnt: count(),
      })
      .from(inbreedingHistoryTable)
      .groupBy(inbreedingHistoryTable.riskLevel);

    const riskLabels: Record<string, string> = {
      safe: "ปลอดภัย",
      low: "เสี่ยงต่ำ",
      moderate: "เสี่ยงปานกลาง",
      high: "เสี่ยงสูง",
      very_high: "เสี่ยงสูงมาก",
    };

    const riskBreakdown = riskCounts.map((r) => ({
      level: r.riskLevel,
      label: riskLabels[r.riskLevel] ?? r.riskLevel,
      count: r.cnt,
    }));

    const safeCount = riskBreakdown.find((r) => r.level === "safe")?.count ?? 0;
    const riskyCount = Number(totalCalculations) - safeCount;

    return res.json({
      totalAnimals: Number(totalAnimals),
      totalCalculations: Number(totalCalculations),
      averageF: avgF != null ? Number(avgF) : 0,
      safePairings: safeCount,
      riskyPairings: riskyCount,
      riskBreakdown,
    });
  } catch (err) {
    req.log.error({ err }, "getInbreedingStats failed");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
