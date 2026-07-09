ALTER TABLE "tool_listings" ADD COLUMN "submitted_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "tool_listings" ADD COLUMN "rejection_code" text;--> statement-breakpoint
ALTER TABLE "tool_listings" ADD COLUMN "rejection_reason" text;--> statement-breakpoint
ALTER TABLE "tool_listings" ADD COLUMN "reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tool_listings" ADD COLUMN "reviewed_by" uuid;--> statement-breakpoint
ALTER TABLE "tool_listings" ADD CONSTRAINT "tool_listings_submitted_by_user_id_users_id_fk" FOREIGN KEY ("submitted_by_user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "tool_listings" ADD CONSTRAINT "tool_listings_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;
