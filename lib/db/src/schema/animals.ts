import { pgTable, text, serial, integer, timestamp, date, type AnyPgColumn } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const animalsTable = pgTable("animals", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  species: text("species").notNull(),
  sex: text("sex").notNull(), // 'male' | 'female'
  farm: text("farm"),
  birthDate: date("birth_date"),
  notes: text("notes"),
  sireId: integer("sire_id").references((): AnyPgColumn => animalsTable.id, { onDelete: "set null" }),
  damId: integer("dam_id").references((): AnyPgColumn => animalsTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAnimalSchema = createInsertSchema(animalsTable).omit({ id: true, createdAt: true });
export type InsertAnimal = z.infer<typeof insertAnimalSchema>;
export type Animal = typeof animalsTable.$inferSelect;
