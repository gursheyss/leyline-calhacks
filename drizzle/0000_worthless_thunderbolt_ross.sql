CREATE TABLE IF NOT EXISTS "email_attachments" (
	"id" serial PRIMARY KEY NOT NULL,
	"email_id" varchar,
	"attachment_id" varchar,
	"filename" varchar,
	"mime_type" varchar,
	"size" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "email_payloads" (
	"id" serial PRIMARY KEY NOT NULL,
	"email_id" varchar,
	"part_id" varchar,
	"mime_type" varchar,
	"filename" varchar,
	"headers" jsonb,
	"body" jsonb
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "emails" (
	"id" varchar PRIMARY KEY NOT NULL,
	"snippet" text,
	"internal_date" timestamp
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "email_attachments" ADD CONSTRAINT "email_attachments_email_id_emails_id_fk" FOREIGN KEY ("email_id") REFERENCES "public"."emails"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "email_payloads" ADD CONSTRAINT "email_payloads_email_id_emails_id_fk" FOREIGN KEY ("email_id") REFERENCES "public"."emails"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
