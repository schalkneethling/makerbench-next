CREATE TABLE "public_submission_blocklist_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blocklist_entry_id" uuid,
	"normalized_url" text NOT NULL,
	"matched_type" text NOT NULL,
	"matched_value" text NOT NULL,
	"submitted_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "public_submission_blocklist_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "public_submission_blocklist" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_type" text NOT NULL,
	"value" text NOT NULL,
	"normalized_value" text NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "public_submission_blocklist_value_check" CHECK (length(btrim("public_submission_blocklist"."normalized_value")) > 0),
	CONSTRAINT "public_submission_blocklist_match_type_check" CHECK ("public_submission_blocklist"."match_type" in ('url', 'domain'))
);
--> statement-breakpoint
ALTER TABLE "public_submission_blocklist" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "public_submission_blocklist_events" ADD CONSTRAINT "public_submission_blocklist_events_blocklist_entry_id_public_submission_blocklist_id_fk" FOREIGN KEY ("blocklist_entry_id") REFERENCES "public"."public_submission_blocklist"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_submission_blocklist_events" ADD CONSTRAINT "public_submission_blocklist_events_submitted_by_user_id_users_id_fk" FOREIGN KEY ("submitted_by_user_id") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_submission_blocklist" ADD CONSTRAINT "public_submission_blocklist_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_public_submission_blocklist_events_created_at" ON "public_submission_blocklist_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_public_submission_blocklist_events_entry" ON "public_submission_blocklist_events" USING btree ("blocklist_entry_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_public_submission_blocklist_match" ON "public_submission_blocklist" USING btree ("match_type","normalized_value");--> statement-breakpoint
CREATE INDEX "idx_public_submission_blocklist_created_at" ON "public_submission_blocklist" USING btree ("created_at");--> statement-breakpoint
REVOKE ALL ON TABLE "public_submission_blocklist" FROM anon, authenticated;--> statement-breakpoint
REVOKE ALL ON TABLE "public_submission_blocklist_events" FROM anon, authenticated;
