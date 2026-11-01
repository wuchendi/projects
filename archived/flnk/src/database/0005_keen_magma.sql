DROP INDEX `uniq_tags_name`;--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_tags_name_created_by` ON `tags` (`name`,`created_by`);