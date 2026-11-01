DROP INDEX `idx_links_created_by_created_at`;--> statement-breakpoint
ALTER TABLE `links` ADD `owner_id` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_links_owner_id_created_at` ON `links` (`owner_id`,`created_at`);--> statement-breakpoint
DROP INDEX `uniq_tags_name_created_by`;--> statement-breakpoint
DROP INDEX `idx_tags_created_by`;--> statement-breakpoint
ALTER TABLE `tags` ADD `owner_id` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_tags_owner_id` ON `tags` (`owner_id`);--> statement-breakpoint
UPDATE links SET owner_id = (SELECT id FROM user WHERE lower(user.email) = lower(links.created_by)) WHERE links.created_by <> '';--> statement-breakpoint
UPDATE tags SET owner_id = (SELECT id FROM user WHERE lower(user.email) = lower(tags.created_by)) WHERE tags.created_by <> '';--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_tags_name_owner_id` ON `tags` (`name`,`owner_id`);
