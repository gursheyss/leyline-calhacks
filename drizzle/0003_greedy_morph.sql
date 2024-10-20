CREATE TYPE "public"."email_status" AS ENUM('stale', 'processing', 'done');--> statement-breakpoint
ALTER TABLE "emails" ADD COLUMN "status" "email_status" DEFAULT 'stale';