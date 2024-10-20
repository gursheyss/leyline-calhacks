CREATE TABLE IF NOT EXISTS "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"first_name" text,
	"last_name" text,
	"user_data" jsonb
);
--> statement-breakpoint
ALTER TABLE "emails" ADD COLUMN "message_text" text;