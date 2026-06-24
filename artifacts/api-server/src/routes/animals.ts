import { Router } from "express";
import { db, animalsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { z } from "zod/v4";
import {
  CreateAnimalBody,
  UpdateAnimalBody,
  GetAnimalParams,
  UpdateAnimalParams,
  DeleteAnimalParams,
  GetAnimalPedigreeParams,
} from "@workspace/api-zod";

const router = Router();

// GET /animals
router.get("/animals", async (req, res) => {
  try {
    const animals = await db
      .select({
        id: animalsTable.id,
        name: animalsTable.name,
        code: animalsTable.code,
        species: animalsTable.species,
        sex: animalsTable.sex,
        birthDate: animalsTable.birthDate,
        notes: animalsTable.notes,
        sireId: animalsTable.sireId,
        damId: animalsTable.damId,
        createdAt: animalsTable.createdAt,
      })
      .from(animalsTable)
      .orderBy(animalsTable.createdAt);

    // Enrich with sire/dam names
    const allAnimals = animals;
    const enriched = animals.map((a) => {
      const sire = a.sireId ? allAnimals.find((x) => x.id === a.sireId) : null;
      const dam = a.damId ? allAnimals.find((x) => x.id === a.damId) : null;
      return {
        ...a,
        birthDate: a.birthDate ?? null,
        notes: a.notes ?? null,
        sireId: a.sireId ?? null,
        damId: a.damId ?? null,
        sireName: sire ? sire.name : null,
        damName: dam ? dam.name : null,
        createdAt: a.createdAt.toISOString(),
      };
    });

    return res.json(enriched);
  } catch (err) {
    req.log.error({ err }, "listAnimals failed");
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
        birthDate: data.birthDate ?? null,
        notes: data.notes ?? null,
        sireId: data.sireId ?? null,
        damId: data.damId ?? null,
      })
      .returning();

    const sire = created.sireId
      ? await db.select().from(animalsTable).where(eq(animalsTable.id, created.sireId)).limit(1)
      : [];
    const dam = created.damId
      ? await db.select().from(animalsTable).where(eq(animalsTable.id, created.damId)).limit(1)
      : [];

    return res.status(201).json({
      ...created,
      birthDate: created.birthDate ?? null,
      notes: created.notes ?? null,
      sireId: created.sireId ?? null,
      damId: created.damId ?? null,
      sireName: sire[0]?.name ?? null,
      damName: dam[0]?.name ?? null,
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
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid ID" });
  }

  try {
    const [animal] = await db
      .select()
      .from(animalsTable)
      .where(eq(animalsTable.id, parsed.data.id))
      .limit(1);

    if (!animal) {
      return res.status(404).json({ error: "ไม่พบสัตว์นี้ในระบบ" });
    }

    const sire = animal.sireId
      ? await db.select().from(animalsTable).where(eq(animalsTable.id, animal.sireId)).limit(1)
      : [];
    const dam = animal.damId
      ? await db.select().from(animalsTable).where(eq(animalsTable.id, animal.damId)).limit(1)
      : [];

    return res.json({
      ...animal,
      birthDate: animal.birthDate ?? null,
      notes: animal.notes ?? null,
      sireId: animal.sireId ?? null,
      damId: animal.damId ?? null,
      sireName: sire[0]?.name ?? null,
      damName: dam[0]?.name ?? null,
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
  if (!paramsParsed.success) {
    return res.status(400).json({ error: "Invalid ID" });
  }
  const bodyParsed = UpdateAnimalBody.safeParse(req.body);
  if (!bodyParsed.success) {
    return res.status(400).json({ error: String(bodyParsed.error) });
  }

  try {
    const updateData: Record<string, unknown> = {};
    const b = bodyParsed.data;
    if (b.name !== undefined) updateData.name = b.name;
    if (b.code !== undefined) updateData.code = b.code;
    if (b.species !== undefined) updateData.species = b.species;
    if (b.sex !== undefined) updateData.sex = b.sex;
    if (b.birthDate !== undefined) updateData.birthDate = b.birthDate;
    if (b.notes !== undefined) updateData.notes = b.notes;
    if ("sireId" in b) updateData.sireId = b.sireId ?? null;
    if ("damId" in b) updateData.damId = b.damId ?? null;

    const [updated] = await db
      .update(animalsTable)
      .set(updateData)
      .where(eq(animalsTable.id, paramsParsed.data.id))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "ไม่พบสัตว์นี้ในระบบ" });
    }

    const sire = updated.sireId
      ? await db.select().from(animalsTable).where(eq(animalsTable.id, updated.sireId)).limit(1)
      : [];
    const dam = updated.damId
      ? await db.select().from(animalsTable).where(eq(animalsTable.id, updated.damId)).limit(1)
      : [];

    return res.json({
      ...updated,
      birthDate: updated.birthDate ?? null,
      notes: updated.notes ?? null,
      sireId: updated.sireId ?? null,
      damId: updated.damId ?? null,
      sireName: sire[0]?.name ?? null,
      damName: dam[0]?.name ?? null,
      createdAt: updated.createdAt.toISOString(),
    });
  } catch (err: any) {
    if (err?.code === "23505") {
      return res.status(400).json({ error: "รหัสสัตว์นี้มีอยู่แล้วในระบบ" });
    }
    req.log.error({ err }, "updateAnimal failed");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /animals/:id
router.delete("/animals/:id", async (req, res) => {
  const parsed = DeleteAnimalParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid ID" });
  }

  try {
    const [deleted] = await db
      .delete(animalsTable)
      .where(eq(animalsTable.id, parsed.data.id))
      .returning();

    if (!deleted) {
      return res.status(404).json({ error: "ไม่พบสัตว์นี้ในระบบ" });
    }

    return res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "deleteAnimal failed");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /animals/:id/pedigree
router.get("/animals/:id/pedigree", async (req, res) => {
  const parsed = GetAnimalPedigreeParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid ID" });
  }

  // Load all animals once for efficiency
  const allAnimals = await db.select().from(animalsTable);
  const animalMap = new Map(allAnimals.map((a) => [a.id, a]));

  function buildNode(id: number, depth: number): any {
    if (depth <= 0) return null;
    const a = animalMap.get(id);
    if (!a) return null;
    return {
      id: a.id,
      name: a.name,
      code: a.code,
      sex: a.sex,
      sire: a.sireId && depth > 1 ? buildNode(a.sireId, depth - 1) : undefined,
      dam: a.damId && depth > 1 ? buildNode(a.damId, depth - 1) : undefined,
    };
  }

  const node = buildNode(parsed.data.id, 4);
  if (!node) {
    return res.status(404).json({ error: "ไม่พบสัตว์นี้ในระบบ" });
  }

  return res.json(node);
});

export default router;
