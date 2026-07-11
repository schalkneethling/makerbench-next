CREATE TABLE "public_submission_rate_limits" (
	"key_hash" text PRIMARY KEY NOT NULL,
	"window_started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"attempt_count" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "public_submission_rate_limits_attempt_count_check" CHECK ("public_submission_rate_limits"."attempt_count" > 0)
);
--> statement-breakpoint
ALTER TABLE "public_submission_rate_limits" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL PRIVILEGES ON TABLE public.public_submission_rate_limits
  FROM anon, authenticated;
