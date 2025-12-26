DROP INDEX `unique_bookmark_tag`;--> statement-breakpoint
CREATE UNIQUE INDEX `unique_bookmark_tag` ON `bookmark_tags` (`bookmark_id`,`tag_id`);--> statement-breakpoint
ALTER TABLE `bookmarks` ADD `image_url` text;--> statement-breakpoint
ALTER TABLE `bookmarks` ADD `image_source` text;--> statement-breakpoint
ALTER TABLE `bookmarks` ADD `submitter_name` text;--> statement-breakpoint
ALTER TABLE `bookmarks` ADD `submitter_github_url` text;