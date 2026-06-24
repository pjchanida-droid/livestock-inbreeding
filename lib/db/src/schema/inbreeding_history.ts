import { pgTable, serial, integer, real, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { animalsTable } from "./animals";

export const inbreedingHistoryTable = pgTable("inbreeding_history", {
  id: serial("id").primaryKey(),
  sireId: integer("sire_id").notNull().references(() => animalsTable.id, { onDelete: "cascade" }),
  damId: integer("dam_id").notNull().references(() => animalsTable.id, { onDelete: "cascade" }),
  fCoefficient: real("f_coefficient").notNull(),
  riskLevel: text("risk_level").notNull(),
  calculatedAt: timestamp("calculated_at").defaultNow().notNull(),
});

export const insertInbreedingHistorySchema = createInsertSchema(inbreedingHistoryTable).omit({ id: true, calculatedAt: true });
export type InsertInbreedingHistory = z.infer<typeof insertInbreedingHistorySchema>;
export type InbreedingHistory = typeof inbreedingHistoryTable.$inferSelect;
