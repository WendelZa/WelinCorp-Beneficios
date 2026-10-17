import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const proposalSubmissionsTable = pgTable("proposal_submissions", {
  id: serial("id").primaryKey(),
  companyName: text("company_name").notNull(),
  cnpj: text("cnpj"),
  contactName: text("contact_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  employeeCount: text("employee_count").notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertProposalSubmissionSchema = createInsertSchema(proposalSubmissionsTable).omit({
  id: true,
  createdAt: true,
});

export type InsertProposalSubmission = z.infer<typeof insertProposalSubmissionSchema>;
export type ProposalSubmission = typeof proposalSubmissionsTable.$inferSelect;
