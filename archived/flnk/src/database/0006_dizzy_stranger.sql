DROP INDEX `idx_links_created_at`;--> statement-breakpoint
CREATE INDEX `idx_links_created_by_created_at` ON `links` (`created_by`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_launchpads_owner_id_created_at` ON `launchpads` (`owner_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_tags_created_by` ON `tags` (`created_by`);