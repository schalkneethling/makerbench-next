CREATE TABLE `bookmark_tags` (
	`id` text PRIMARY KEY NOT NULL,
	`bookmark_id` text NOT NULL,
	`tag_id` text NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`bookmark_id`) REFERENCES `bookmarks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `bookmark_id_idx` ON `bookmark_tags` (`bookmark_id`);--> statement-breakpoint
CREATE INDEX `tag_id_idx` ON `bookmark_tags` (`tag_id`);--> statement-breakpoint
CREATE INDEX `unique_bookmark_tag` ON `bookmark_tags` (`bookmark_id`,`tag_id`);--> statement-breakpoint
CREATE TABLE `bookmarks` (
	`id` text PRIMARY KEY NOT NULL,
	`url` text NOT NULL,
	`title` text,
	`description` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`metadata` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`approved_at` text,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `url_idx` ON `bookmarks` (`url`);--> statement-breakpoint
CREATE INDEX `status_idx` ON `bookmarks` (`status`);--> statement-breakpoint
CREATE INDEX `created_at_idx` ON `bookmarks` (`created_at`);--> statement-breakpoint
CREATE TABLE `tags` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tags_name_unique` ON `tags` (`name`);--> statement-breakpoint
CREATE INDEX `name_idx` ON `tags` (`name`);