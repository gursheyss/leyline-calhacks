import {
  pgTable,
  serial,
  text,
  varchar,
  timestamp,
  jsonb,
  integer,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const emailStatusEnum = pgEnum("email_status", [
  "stale",
  "processing",
  "done",
]);

export const emails = pgTable("emails", {
  id: varchar("id").primaryKey(),
  snippet: text("snippet"),
  internalDate: timestamp("internal_date"),
  sender: text("sender"),
  subject: text("subject"),
  status: emailStatusEnum("status").default("stale"),
});

export const emailPayloads = pgTable("email_payloads", {
  id: serial("id").primaryKey(),
  emailId: varchar("email_id").references(() => emails.id),
  partId: varchar("part_id"),
  mimeType: varchar("mime_type"),
  filename: varchar("filename"),
  headers: jsonb("headers"),
  body: jsonb("body"),
});

export const emailAttachments = pgTable("email_attachments", {
  id: serial("id").primaryKey(),
  emailId: varchar("email_id").references(() => emails.id),
  attachmentId: varchar("attachment_id"),
  filename: varchar("filename"),
  mimeType: varchar("mime_type"),
  size: integer("size"),
  data: text("data"),
});

export const emailsRelations = relations(emails, ({ many }) => ({
  payloads: many(emailPayloads),
  attachments: many(emailAttachments),
}));

export const emailPayloadsRelations = relations(emailPayloads, ({ one }) => ({
  email: one(emails, {
    fields: [emailPayloads.emailId],
    references: [emails.id],
  }),
}));

export const emailAttachmentsRelations = relations(
  emailAttachments,
  ({ one }) => ({
    email: one(emails, {
      fields: [emailAttachments.emailId],
      references: [emails.id],
    }),
  })
);
