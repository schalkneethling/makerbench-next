CREATE VIRTUAL TABLE `bookmark_search` USING fts5(
	`bookmark_id` UNINDEXED,
	`title`,
	`tags`,
	tokenize = 'unicode61 porter'
);
--> statement-breakpoint
INSERT INTO `bookmark_search` (`bookmark_id`, `title`, `tags`)
SELECT
	`bookmarks`.`id`,
	coalesce(`bookmarks`.`title`, ''),
	coalesce((
		SELECT group_concat(`tags`.`name`, ' ')
		FROM `bookmark_tags`
		INNER JOIN `tags` ON `bookmark_tags`.`tag_id` = `tags`.`id`
		WHERE `bookmark_tags`.`bookmark_id` = `bookmarks`.`id`
	), '')
FROM `bookmarks`
WHERE `bookmarks`.`status` = 'approved';
--> statement-breakpoint
CREATE TRIGGER `bookmark_search_after_insert`
AFTER INSERT ON `bookmarks`
WHEN NEW.`status` = 'approved'
BEGIN
	INSERT INTO `bookmark_search` (`bookmark_id`, `title`, `tags`)
	VALUES (
		NEW.`id`,
		coalesce(NEW.`title`, ''),
		coalesce((
			SELECT group_concat(`tags`.`name`, ' ')
			FROM `bookmark_tags`
			INNER JOIN `tags` ON `bookmark_tags`.`tag_id` = `tags`.`id`
			WHERE `bookmark_tags`.`bookmark_id` = NEW.`id`
		), '')
	);
END;
--> statement-breakpoint
CREATE TRIGGER `bookmark_search_after_update`
AFTER UPDATE ON `bookmarks`
BEGIN
	DELETE FROM `bookmark_search` WHERE `bookmark_id` = OLD.`id`;
	INSERT INTO `bookmark_search` (`bookmark_id`, `title`, `tags`)
	SELECT
		NEW.`id`,
		coalesce(NEW.`title`, ''),
		coalesce((
			SELECT group_concat(`tags`.`name`, ' ')
			FROM `bookmark_tags`
			INNER JOIN `tags` ON `bookmark_tags`.`tag_id` = `tags`.`id`
			WHERE `bookmark_tags`.`bookmark_id` = NEW.`id`
		), '')
	WHERE NEW.`status` = 'approved';
END;
--> statement-breakpoint
CREATE TRIGGER `bookmark_search_after_delete`
AFTER DELETE ON `bookmarks`
BEGIN
	DELETE FROM `bookmark_search` WHERE `bookmark_id` = OLD.`id`;
END;
--> statement-breakpoint
CREATE TRIGGER `bookmark_search_tag_insert`
AFTER INSERT ON `bookmark_tags`
BEGIN
	UPDATE `bookmark_search`
	SET `tags` = coalesce((
		SELECT group_concat(`tags`.`name`, ' ')
		FROM `bookmark_tags`
		INNER JOIN `tags` ON `bookmark_tags`.`tag_id` = `tags`.`id`
		WHERE `bookmark_tags`.`bookmark_id` = NEW.`bookmark_id`
	), '')
	WHERE `bookmark_id` = NEW.`bookmark_id`;
END;
--> statement-breakpoint
CREATE TRIGGER `bookmark_search_tag_delete`
AFTER DELETE ON `bookmark_tags`
BEGIN
	UPDATE `bookmark_search`
	SET `tags` = coalesce((
		SELECT group_concat(`tags`.`name`, ' ')
		FROM `bookmark_tags`
		INNER JOIN `tags` ON `bookmark_tags`.`tag_id` = `tags`.`id`
		WHERE `bookmark_tags`.`bookmark_id` = OLD.`bookmark_id`
	), '')
	WHERE `bookmark_id` = OLD.`bookmark_id`;
END;
--> statement-breakpoint
CREATE TRIGGER `bookmark_search_tag_name_update`
AFTER UPDATE ON `tags`
BEGIN
	UPDATE `bookmark_search`
	SET `tags` = coalesce((
		SELECT group_concat(`tags`.`name`, ' ')
		FROM `bookmark_tags`
		INNER JOIN `tags` ON `bookmark_tags`.`tag_id` = `tags`.`id`
		WHERE `bookmark_tags`.`bookmark_id` = `bookmark_search`.`bookmark_id`
	), '')
	WHERE `bookmark_id` IN (
		SELECT `bookmark_id`
		FROM `bookmark_tags`
		WHERE `tag_id` = NEW.`id`
	);
END;
