import { Router } from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import { db, animalsTable } from "@workspace/db";
import { eq, isNull, sql } from "drizzle-orm";
import {
  CreateAnimalBody,
  UpdateAnimalBody,
  GetAnimalParams,
  UpdateAnimalParams,
  DeleteAnimalParams,
  GetAnimalPedigreeParams,
} from "@workspace/api-zod";
import { buildAMatrix, type AnimalRecord } from "../lib/inbreeding";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

/** Helper: load all animals and enrich with sire/dam names + F coefficient */
async function loadAnimals(farm?: string | null) {
  const rows = await db.select().from(animalsTable).orderBy(animalsTable.createdAt);
  const filtered = farm ? rows.filter((r) => r.farm === farm) : rows;

  // Build A-matrix to compute each animal's own F
  const records: AnimalRecord[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    code: r.code,
    sex: r.sex,
    farm: r.farm ?? null,
    sireId: r.sireId ?? null,
    damId: r.damId ?? null,
  }));
  const { F } = buildAMatrix(records);

  const idMap = new Map(rows.map((r) => [r.id, r]));

  return filtered.map((a) => ({
    id: a.id,
    name: a.name,
    code: a.code,
    species: a.species,
    sex: a.sex,
    farm: a.farm ?? null,
    birthDate: a.birthDate ?? null,
    notes: a.notes ?? null,
    sireId: a.sireId ?? null,
    damId: a.damId ?? null,
    sireName: a.sireId ? (idMap.get(a.sireId)?.name ?? null) : null,
    damName: a.damId ? (idMap.get(a.damId)?.name ?? null) : null,
    fCoefficient: F.get(a.code) ?? null,
    createdAt: a.createdAt.toISOString(),
  }));
}

// GET /animals
router.get("/animals", async (req, res) => {
  try {
    const farm = typeof req.query.farm === "string" ? req.query.farm : undefined;
    const animals = await loadAnimals(farm);
    return res.json(animals);
  } catch (err) {
    req.log.error({ err }, "listAnimals failed");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /animals/farms
router.get("/animals/farms", async (req, res) => {
  try {
    const rows = await db
      .selectDistinct({ farm: animalsTable.farm })
      .from(animalsTable)
      .where(sql`${animalsTable.farm} IS NOT NULL`)
      .orderBy(animalsTable.farm);
    return res.json(rows.map((r) => r.farm).filter(Boolean));
  } catch (err) {
    req.log.error({ err }, "listFarms failed");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /animals/template — Excel template download (no codegen, raw binary)
router.get("/animals/template", (_req, res) => {
  const wb = XLSX.utils.book_new();
  const data = [
    ["Farm", "Animal_ID", "Sire_ID", "Dam_ID", "Sex"],
    ["ฟาร์มวิจัย A", "M01", "Unknown", "Unknown", "M"],
    ["ฟาร์มวิจัย A", "F01", "Unknown", "Unknown", "F"],
    ["ฟาร์มวิจัย A", "C01", "M01", "F01", "M"],
  ];
  const ws = XLSX.utils.aoa_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, "Pedigree");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  res.setHeader("Content-Disposition", 'attachment; filename="pedigree_template.xlsx"');
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  return res.send(buf);
});

// POST /animals/import — Excel bulk import (multipart)
router.post("/animals/import", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "กรุณาแนบไฟล์ Excel (.xlsx)" });
  }
  try {
    const wb = XLSX.read(req.file.buffer, { type: "buffer" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: "" });

    // Load existing animals for code-based sire/dam resolution
    const existing = await db.select().from(animalsTable);
    const codeToId = new Map<string, number>(existing.map((a) => [a.code, a.id]));

    let inserted = 0;
    let skipped = 0;
    const errors: string[] = [];

    // Two-pass: first insert animals without parents, then link parents
    const pending: Array<{ row: Record<string, string>; attempt: number }> = rows.map((r) => ({ row: r, attempt: 0 }));
    const maxPasses = 5;

    for (let pass = 0; pass < maxPasses && pending.length > 0; pass++) {
      const remaining: typeof pending = [];
      for (const { row, attempt } of pending) {
        const code = String(row["Animal_ID"] || "").trim();
        const sireCode = String(row["Sire_ID"] || "Unknown").trim();
        const damCode = String(row["Dam_ID"] || "Unknown").trim();
        const sexRaw = String(row["Sex"] || "").trim().toUpperCase();
        const sex = sexRaw === "M" ? "male" : sexRaw === "F" ? "female" : null;

        if (!code || code === "Unknown") {
          errors.push(`แถว: รหัส Animal_ID ไม่ถูกต้อง`);
          skipped++;
          continue;
        }
        if (!sex) {
          errors.push(`${code}: เพศไม่ถูกต้อง (ต้องเป็น M หรือ F)`);
          skipped++;
          continue;
        }
        if (codeToId.has(code)) {
          skipped++;
          continue;
        }

        const sireId = sireCode !== "Unknown" ? (codeToId.get(sireCode) ?? null) : null;
        const damId = damCode !== "Unknown" ? (codeToId.get(damCode) ?? null) : null;

        // If parents not yet resolved and not final pass, defer
        const sireUnresolved = sireCode !== "Unknown" && !codeToId.has(sireCode);
        const damUnresolved = damCode !== "Unknown" && !codeToId.has(damCode);
        if ((sireUnresolved || damUnresolved) && attempt < maxPasses - 1) {
          remaining.push({ row, attempt: attempt + 1 });
          continue;
        }

        const species = String(row["Species"] || "").trim() || "ไม่ระบุ";
        const name = String(row["Name"] || code).trim();
        const farm = String(row["Farm"] || "").trim() || null;
        const birthDate = String(row["BirthDate"] || "").trim() || null;
        const notes = String(row["Notes"] || "").trim() || null;

        try {
          const [created] = await db
            .insert(animalsTable)
            .values({ name, code, species, sex, farm, birthDate, notes, sireId, damId })
            .returning({ id: animalsTable.id });
          codeToId.set(code, created.id);
          inserted++;
        } catch (e: any) {
          if (e?.code === "23505") {
            skipped++;
          } else {
            errors.push(`${code}: ${e?.message ?? "ข้อผิดพลาดไม่ทราบสาเหตุ"}`);
            skipped++;
          }
        }
      }
      pending.length = 0;
      pending.push(...remaining);
    }

    // Any still-pending = unresolvable parents
    for (const { row } of pending) {
      errors.push(`${row["Animal_ID"]}: ไม่พบรหัสพ่อ/แม่พันธุ์ในระบบ`);
      skipped++;
    }

    return res.json({ inserted, skipped, errors });
  } catch (err) {
    req.log.error({ err }, "importAnimals failed");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /animals
router.post("/animals", async (req, res) => {
  const parsed = CreateAnimalBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: String(parsed.error) });
  }
  const data = parsed.data;
  try {
    const [created] = await db
      .insert(animalsTable)
      .values({
        name: data.name,
        code: data.code,
        species: data.species,
        sex: data.sex,
        farm: data.farm ?? null,
        birthDate: data.birthDate ?? null,
        notes: data.notes ?? null,
        sireId: data.sireId ?? null,
        damId: data.damId ?? null,
      })
      .returning();

    const allRows = await db.select().from(animalsTable);
    const records: AnimalRecord[] = allRows.map((r) => ({
      id: r.id, name: r.name, code: r.code, sex: r.sex,
      farm: r.farm ?? null, sireId: r.sireId ?? null, damId: r.damId ?? null,
    }));
    const { F } = buildAMatrix(records);
    const idMap = new Map(allRows.map((r) => [r.id, r]));

    return res.status(201).json({
      id: created.id,
      name: created.name,
      code: created.code,
      species: created.species,
      sex: created.sex,
      farm: created.farm ?? null,
      birthDate: created.birthDate ?? null,
      notes: created.notes ?? null,
      sireId: created.sireId ?? null,
      damId: created.damId ?? null,
      sireName: created.sireId ? (idMap.get(created.sireId)?.name ?? null) : null,
      damName: created.damId ? (idMap.get(created.damId)?.name ?? null) : null,
      fCoefficient: F.get(created.code) ?? null,
      createdAt: created.createdAt.toISOString(),
    });
  } catch (err: any) {
    if (err?.code === "23505") {
      return res.status(400).json({ error: "รหัสสัตว์นี้มีอยู่แล้วในระบบ" });
    }
    req.log.error({ err }, "createAnimal failed");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /animals/:id
router.get("/animals/:id", async (req, res) => {
  const parsed = GetAnimalParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) return res.status(400).json({ error: "Invalid ID" });
  try {
    const allRows = await db.select().from(animalsTable);
    const animal = allRows.find((r) => r.id === parsed.data.id);
    if (!animal) return res.status(404).json({ error: "ไม่พบสัตว์นี้ในระบบ" });

    const records: AnimalRecord[] = allRows.map((r) => ({
      id: r.id, name: r.name, code: r.code, sex: r.sex,
      farm: r.farm ?? null, sireId: r.sireId ?? null, damId: r.damId ?? null,
    }));
    const { F } = buildAMatrix(records);
    const idMap = new Map(allRows.map((r) => [r.id, r]));

    return res.json({
      id: animal.id,
      name: animal.name,
      code: animal.code,
      species: animal.species,
      sex: animal.sex,
      farm: animal.farm ?? null,
      birthDate: animal.birthDate ?? null,
      notes: animal.notes ?? null,
      sireId: animal.sireId ?? null,
      damId: animal.damId ?? null,
      sireName: animal.sireId ? (idMap.get(animal.sireId)?.name ?? null) : null,
      damName: animal.damId ? (idMap.get(animal.damId)?.name ?? null) : null,
      fCoefficient: F.get(animal.code) ?? null,
      createdAt: animal.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "getAnimal failed");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /animals/:id
router.patch("/animals/:id", async (req, res) => {
  const paramsParsed = UpdateAnimalParams.safeParse({ id: Number(req.params.id) });
  if (!paramsParsed.success) return res.status(400).json({ error: "Invalid ID" });
  const bodyParsed = UpdateAnimalBody.safeParse(req.body);
  if (!bodyParsed.success) return res.status(400).json({ error: String(bodyParsed.error) });

  try {
    const updateData: Record<string, unknown> = {};
    const b = bodyParsed.data;
    if (b.name !== undefined) updateData.name = b.name;
    if (b.code !== undefined) updateData.code = b.code;
    if (b.species !== undefined) updateData.species = b.species;
    if (b.sex !== undefined) updateData.sex = b.sex;
    if (b.farm !== undefined) updateData.farm = b.farm;
    if (b.birthDate !== undefined) updateData.birthDate = b.birthDate;
    if (b.notes !== undefined) updateData.notes = b.notes;
    if ("sireId" in b) updateData.sireId = b.sireId ?? null;
    if ("damId" in b) updateData.damId = b.damId ?? null;

    const [updated] = await db
      .update(animalsTable)
      .set(updateData)
      .where(eq(animalsTable.id, paramsParsed.data.id))
      .returning();

    if (!updated) return res.status(404).json({ error: "ไม่พบสัตว์นี้ในระบบ" });

    const allRows = await db.select().from(animalsTable);
    const records: AnimalRecord[] = allRows.map((r) => ({
      id: r.id, name: r.name, code: r.code, sex: r.sex,
      farm: r.farm ?? null, sireId: r.sireId ?? null, damId: r.damId ?? null,
    }));
    const { F } = buildAMatrix(records);
    const idMap = new Map(allRows.map((r) => [r.id, r]));

    return res.json({
      id: updated.id,
      name: updated.name,
      code: updated.code,
      species: updated.species,
      sex: updated.sex,
      farm: updated.farm ?? null,
      birthDate: updated.birthDate ?? null,
      notes: updated.notes ?? null,
      sireId: updated.sireId ?? null,
      damId: updated.damId ?? null,
      sireName: updated.sireId ? (idMap.get(updated.sireId)?.name ?? null) : null,
      damName: updated.damId ? (idMap.get(updated.damId)?.name ?? null) : null,
      fCoefficient: F.get(updated.code) ?? null,
      createdAt: updated.createdAt.toISOString(),
    });
  } catch (err: any) {
    if (err?.code === "23505") return res.status(400).json({ error: "รหัสสัตว์นี้มีอยู่แล้วในระบบ" });
    req.log.error({ err }, "updateAnimal failed");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /animals/:id
router.delete("/animals/:id", async (req, res) => {
  const parsed = DeleteAnimalParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) return res.status(400).json({ error: "Invalid ID" });
  try {
    const [deleted] = await db
      .delete(animalsTable)
      .where(eq(animalsTable.id, parsed.data.id))
      .returning();
    if (!deleted) return res.status(404).json({ error: "ไม่พบสัตว์นี้ในระบบ" });
    return res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "deleteAnimal failed");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /animals/:id/pedigree
router.get("/animals/:id/pedigree", async (req, res) => {
  const parsed = GetAnimalPedigreeParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) return res.status(400).json({ error: "Invalid ID" });

  try {
    const allRows = await db.select().from(animalsTable);
    const animalMap = new Map(allRows.map((a) => [a.id, a]));

    const records: AnimalRecord[] = allRows.map((r) => ({
      id: r.id, name: r.name, code: r.code, sex: r.sex,
      farm: r.farm ?? null, sireId: r.sireId ?? null, damId: r.damId ?? null,
    }));
    const { F } = buildAMatrix(records);

    function buildNode(id: number, depth: number): unknown {
      if (depth <= 0) return null;
      const a = animalMap.get(id);
      if (!a) return null;
      return {
        id: a.id,
        name: a.name,
        code: a.code,
        sex: a.sex,
        fCoefficient: F.get(a.code) ?? null,
        sire: a.sireId && depth > 1 ? buildNode(a.sireId, depth - 1) : undefined,
        dam: a.damId && depth > 1 ? buildNode(a.damId, depth - 1) : undefined,
      };
    }

    const node = buildNode(parsed.data.id, 4);
    if (!node) return res.status(404).json({ error: "ไม่พบสัตว์นี้ในระบบ" });
    return res.json(node);
  } catch (err) {
    req.log.error({ err }, "getAnimalPedigree failed");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
