CREATE TABLE `player_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`user_id_uuid` text NOT NULL,
	`stream_id` text NOT NULL,
	`topic_id` integer,
	`time` integer NOT NULL,
	`version` text NOT NULL,
	`ua` text,
	`vendor` text,
	`platform` text,
	`feature` text,
	`player_config` text,
	`vplayer_runtime` text,
	`player_runtime` text,
	`execute_progress_infos` text,
	`bury_content` text NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`country` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`is_deleted` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `player_logs_user_id_idx` ON `player_logs` (`user_id`);--> statement-breakpoint
CREATE INDEX `player_logs_stream_id_idx` ON `player_logs` (`stream_id`);--> statement-breakpoint
CREATE INDEX `player_logs_time_idx` ON `player_logs` (`time`);--> statement-breakpoint
CREATE INDEX `player_logs_bury_content_idx` ON `player_logs` (`bury_content`);--> statement-breakpoint
CREATE INDEX `player_logs_created_at_idx` ON `player_logs` (`created_at`);--> statement-breakpoint
CREATE INDEX `player_logs_user_stream_idx` ON `player_logs` (`user_id`,`stream_id`);