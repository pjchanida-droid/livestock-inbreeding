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
    sireCode: a.sireId ? (idMap.get(a.sireId)?.code ?? null) : null,
    damName: a.damId ? (idMap.get(a.damId)?.name ?? null) : null,
    damCode: a.damId ? (idMap.get(a.damId)?.code ?? null) : null,
    fCoefficient: F.get(a.code) ?? null,
    createdAt: a.createdAt,
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

// DELETE /animals/farm/:farmName — delete all animals in a farm
router.delete("/animals/farm/:farmName", async (req, res) => {
  const farmName = req.params.farmName?.trim();
  if (!farmName) return res.status(400).json({ error: "กรุณาระบุชื่อฟาร์ม" });
  try {
    const deleted = await db
      .delete(animalsTable)
      .where(eq(animalsTable.farm, farmName))
      .returning();
    return res.json({ deleted: deleted.length });
  } catch (err) {
    req.log.error({ err }, "deleteAnimalsByFarm failed");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /animals/template — Excel template download (no codegen, raw binary)
router.get("/animals/template", (_req, res) => {
  const wb = XLSX.utils.book_new();
  const data = [
    ["Farm", "Animal_ID", "Sire_ID", "Dam_ID", "Sex", "Species", "Status", "Active"],
    ["ฟาร์มวิจัย A", "M01", "Unknown", "Unknown", "M", "กระบือ", "พ่อพันธุ์", "อยู่ในระบบ"],
    ["ฟาร์มวิจัย A", "F01", "Unknown", "Unknown", "F", "กระบือ", "แม่พันธุ์", "อยู่ในระบบ"],
    ["ฟาร์มวิจัย A", "C01", "M01", "F01", "M", "กระบือ", "ลูกผสม", "ไม่อยู่ในระบบ"],
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
    const wb = XLSX.read(req.file.buffer, { type: "buffer", cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });

    // Load existing animals for code-based sire/dam resolution
    const existing = await db.select().from(animalsTable);
    const codeToId = new Map<string, number>(existing.map((a) => [a.code, a.id]));

    let inserted = 0;
    let skipped = 0;
    const errors: string[] = [];

    // --- Step 1: Validate and collect valid rows ---
    interface ParsedRow {
      code: string;
      sireCode: string;
      damCode: string;
      sex: "male" | "female";
      species: string;
      name: string;
      farm: string | null;
      isActive: boolean;
    }
    const validRows = new Map<string, ParsedRow>();

    for (const row of rows) {
      const code = String(row["Animal_ID"] || "").trim();
      const sireCode = String(row["Sire_ID"] || "Unknown").trim() || "Unknown";
      const damCode = String(row["Dam_ID"] || "Unknown").trim() || "Unknown";
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
      if (validRows.has(code)) {
        skipped++; // duplicate in file
        continue;
      }
      const activeRaw = String(row["Active"] || "").trim();
      const isActive = activeRaw === "ไม่อยู่ในระบบ" ? false : true;
      validRows.set(code, {
        code,
        sireCode,
        damCode,
        sex,
        species: String(row["Species"] || "").trim() || "ไม่ระบุ",
        name: String(row["Status"] || row["Name"] || code).trim(),
        farm: String(row["Farm"] || "").trim() || null,
        isActive,
      });
    }

    // --- Step 2: Topological sort (Kahn's algorithm) ---
    // Parents that exist in file or already in DB are "resolved"
    const inDegree = new Map<string, number>();
    const dependents = new Map<string, string[]>(); // parent → [children]

    for (const [code, r] of validRows) {
      let deg = 0;
      for (const parentCode of [r.sireCode, r.damCode]) {
        if (parentCode === "Unknown") continue;
        if (codeToId.has(parentCode)) continue; // already in DB → resolved
        if (!validRows.has(parentCode)) continue; // not in file → treat as unresolvable (insert without)
        // parent is in this file and not yet in DB
        deg++;
        if (!dependents.has(parentCode)) dependents.set(parentCode, []);
        dependents.get(parentCode)!.push(code);
      }
      inDegree.set(code, deg);
    }

    // Queue: animals whose parents are all resolved
    const queue: string[] = [];
    for (const [code, deg] of inDegree) {
      if (deg === 0) queue.push(code);
    }

    const insertOrder: string[] = [];
    while (queue.length > 0) {
      const code = queue.shift()!;
      insertOrder.push(code);
      for (const child of dependents.get(code) ?? []) {
        const newDeg = (inDegree.get(child) ?? 1) - 1;
        inDegree.set(child, newDeg);
        if (newDeg === 0) queue.push(child);
      }
    }

    // Animals not reached = circular dependency → insert without parents
    for (const code of validRows.keys()) {
      if (!insertOrder.includes(code)) {
        errors.push(`${code}: พ่อ/แม่อ้างอิงวนซ้ำ (circular) — บันทึกโดยไม่มีข้อมูลพ่อ/แม่`);
        insertOrder.push(code);
      }
    }

    // --- Step 3: Insert in topological order ---
    for (const code of insertOrder) {
      const r = validRows.get(code)!;
      const sireId = r.sireCode !== "Unknown" ? (codeToId.get(r.sireCode) ?? null) : null;
      const damId  = r.damCode  !== "Unknown" ? (codeToId.get(r.damCode)  ?? null) : null;

      // Warn if parent was in file but still not resolved (unresolvable reference)
      if (r.sireCode !== "Unknown" && !codeToId.has(r.sireCode) && validRows.has(r.sireCode)) {
        errors.push(`${code}: ไม่สามารถเชื่อมพ่อพันธุ์ ${r.sireCode}`);
      }
      if (r.damCode !== "Unknown" && !codeToId.has(r.damCode) && validRows.has(r.damCode)) {
        errors.push(`${code}: ไม่สามารถเชื่อมแม่พันธุ์ ${r.damCode}`);
      }

      try {
        const [created] = await db
          .insert(animalsTable)
          .values({ name: r.name, code, species: r.species, sex: r.sex, farm: r.farm, sireId, damId, isActive: r.isActive })
          .returning({ id: animalsTable.id });
        codeToId.set(code, created.id);
        inserted++;
      } catch (e: any) {
        if (e?.code === "23505" || String(e?.message).includes("UNIQUE")) {
          skipped++;
        } else {
          errors.push(`${code}: ${e?.message ?? "ข้อผิดพลาดไม่ทราบสาเหตุ"}`);
          skipped++;
        }
      }
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
      sireCode: created.sireId ? (idMap.get(created.sireId)?.code ?? null) : null,
      damName: created.damId ? (idMap.get(created.damId)?.name ?? null) : null,
      damCode: created.damId ? (idMap.get(created.damId)?.code ?? null) : null,
      fCoefficient: F.get(created.code) ?? null,
      createdAt: created.createdAt,
    });
  } catch (err: any) {
    if (err?.code === "23505" || String(err?.message).includes("UNIQUE")) {
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
      sireCode: animal.sireId ? (idMap.get(animal.sireId)?.code ?? null) : null,
      damName: animal.damId ? (idMap.get(animal.damId)?.name ?? null) : null,
      damCode: animal.damId ? (idMap.get(animal.damId)?.code ?? null) : null,
      fCoefficient: F.get(animal.code) ?? null,
      createdAt: animal.createdAt,
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
      sireCode: updated.sireId ? (idMap.get(updated.sireId)?.code ?? null) : null,
      damName: updated.damId ? (idMap.get(updated.damId)?.name ?? null) : null,
      damCode: updated.damId ? (idMap.get(updated.damId)?.code ?? null) : null,
      fCoefficient: F.get(updated.code) ?? null,
      createdAt: updated.createdAt,
    });
  } catch (err: any) {
    if (err?.code === "23505" || String(err?.message).includes("UNIQUE")) return res.status(400).json({ error: "รหัสสัตว์นี้มีอยู่แล้วในระบบ" });
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
