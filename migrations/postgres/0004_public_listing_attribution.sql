ALTER TABLE "public_listings" ALTER COLUMN "submitted_by_user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "public_listings" ADD COLUMN "submitter_name" text;--> statement-breakpoint
ALTER TABLE "public_listings" ADD COLUMN "submitter_github_url" text;