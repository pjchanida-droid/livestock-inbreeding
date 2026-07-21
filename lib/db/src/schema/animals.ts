import { sqliteTable, text, integer, type AnySQLiteColumn } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const animalsTable = sqliteTable("animals", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  species: text("species").notNull(),
  sex: text("sex").notNull(),
  farm: text("farm"),
  birthDate: text("birth_date"),
  notes: text("notes"),
  sireId: integer("sire_id").references((): AnySQLiteColumn => animalsTable.id, { onDelete: "set null" }),
  damId: integer("dam_id").references((): AnySQLiteColumn => animalsTable.id, { onDelete: "set null" }),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const insertAnimalSchema = createInsertSchema(animalsTable).omit({ id: true, createdAt: true });
export type InsertAnimal = z.infer<typeof insertAnimalSchema>;
export type Animal = typeof animalsTable.$inferSelect;
