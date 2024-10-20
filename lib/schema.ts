import {
  pgTable,
  serial,
  text,
  varchar,
  timestamp,
  jsonb,
  integer,
} from "drizzle-orm/pg-core";

export const emails = pgTable("emails", {
  id: varchar("id").primaryKey(),
  snippet: text("snippet"),
  internalDate: timestamp("internal_date"),
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
});
