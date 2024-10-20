CREATE TABLE IF NOT EXISTS "email_actions" (
	"id" serial PRIMARY KEY NOT NULL,
	"email_id" varchar,
	"action" text[]
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "email_actions" ADD CONSTRAINT "email_actions_email_id_emails_id_fk" FOREIGN KEY ("email_id") REFERENCES "public"."emails"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
