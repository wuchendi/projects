PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_launchpads` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`owner_id` text DEFAULT '' NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`config` text DEFAULT '{"profile":{},"theme":{"preset":"default","primaryColor":"#4f46e5","buttonShape":"rounded","buttonFill":"solid","buttonShadow":"soft","background":{"type":"gradient","from":"#e0e7ff","to":"#a5b4fc","dir":"b"}},"blocks":[]}' NOT NULL,
	`og` text DEFAULT '{}' NOT NULL,
	`expires_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`is_deleted` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_launchpads`("id", "slug", "owner_id", "title", "status", "config", "og", "expires_at", "created_at", "updated_at", "is_deleted") SELECT "id", "slug", "owner_id", "title", "status", "config", "og", "expires_at", "created_at", "updated_at", "is_deleted" FROM `launchpads`;--> statement-breakpoint
DROP TABLE `launchpads`;--> statement-breakpoint
ALTER TABLE `__new_launchpads` RENAME TO `launchpads`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_launchpads_slug` ON `launchpads` (`slug`);