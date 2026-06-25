import { sqliteTable, integer, real, text } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { animalsTable } from "./animals";

export const inbreedingHistoryTable = sqliteTable("inbreeding_history", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sireId: integer("sire_id").notNull().references(() => animalsTable.id, { onDelete: "cascade" }),
  damId: integer("dam_id").notNull().references(() => animalsTable.id, { onDelete: "cascade" }),
  fCoefficient: real("f_coefficient").notNull(),
  riskLevel: text("risk_level").notNull(),
  calculatedAt: text("calculated_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const insertInbreedingHistorySchema = createInsertSchema(inbreedingHistoryTable).omit({ id: true, calculatedAt: true });
export type InsertInbreedingHistory = z.infer<typeof insertInbreedingHistorySchema>;
export type InbreedingHistory = typeof inbreedingHistoryTable.$inferSelect;
