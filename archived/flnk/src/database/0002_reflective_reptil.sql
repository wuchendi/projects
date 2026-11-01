CREATE TABLE `launchpads` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`owner_id` text DEFAULT '' NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`config` text DEFAULT '{"profile":{},"theme":{"preset":"default","primaryColor":"#000000","buttonShape":"rounded"},"blocks":[]}' NOT NULL,
	`og` text DEFAULT '{}' NOT NULL,
	`expires_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`is_deleted` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_launchpads_slug` ON `launchpads` (`slug`);