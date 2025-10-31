CREATE TABLE `errors` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`environment` text DEFAULT 'production' NOT NULL,
	`message` text NOT NULL,
	`stack_trace` text,
	`error_type` text,
	`url` text,
	`user_agent` text,
	`user_context` text,
	`first_seen` integer NOT NULL,
	`last_seen` integer NOT NULL,
	`occurrence_count` integer DEFAULT 1 NOT NULL,
	`resolved` integer DEFAULT false NOT NULL,
	`metadata` text,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `feedback` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`environment` text DEFAULT 'production' NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'open' NOT NULL,
	`priority` text DEFAULT 'medium' NOT NULL,
	`user_email` text,
	`user_name` text,
	`metadata` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `health_checks` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`environment` text DEFAULT 'production' NOT NULL,
	`status` text NOT NULL,
	`response_time` integer,
	`metadata` text,
	`timestamp` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `logs` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`environment` text DEFAULT 'production' NOT NULL,
	`level` text NOT NULL,
	`message` text NOT NULL,
	`context` text,
	`timestamp` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `notes` (
	`id` text PRIMARY KEY NOT NULL,
	`resource_type` text NOT NULL,
	`resource_id` text NOT NULL,
	`note` text NOT NULL,
	`created_by` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`api_key` text NOT NULL,
	`created_at` integer NOT NULL,
	`settings` text,
	`last_health_check` integer
);
--> statement-breakpoint
CREATE INDEX `idx_errors_project` ON `errors` (`project_id`);--> statement-breakpoint
CREATE INDEX `idx_errors_environment` ON `errors` (`environment`);--> statement-breakpoint
CREATE INDEX `idx_errors_resolved` ON `errors` (`resolved`);--> statement-breakpoint
CREATE INDEX `idx_errors_last_seen` ON `errors` (`last_seen`);--> statement-breakpoint
CREATE INDEX `idx_errors_project_env` ON `errors` (`project_id`,`environment`);--> statement-breakpoint
CREATE INDEX `idx_feedback_project` ON `feedback` (`project_id`);--> statement-breakpoint
CREATE INDEX `idx_feedback_environment` ON `feedback` (`environment`);--> statement-breakpoint
CREATE INDEX `idx_feedback_status` ON `feedback` (`status`);--> statement-breakpoint
CREATE INDEX `idx_feedback_created` ON `feedback` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_feedback_project_env` ON `feedback` (`project_id`,`environment`);--> statement-breakpoint
CREATE INDEX `idx_health_project` ON `health_checks` (`project_id`);--> statement-breakpoint
CREATE INDEX `idx_health_environment` ON `health_checks` (`environment`);--> statement-breakpoint
CREATE INDEX `idx_health_timestamp` ON `health_checks` (`timestamp`);--> statement-breakpoint
CREATE INDEX `idx_health_project_env_timestamp` ON `health_checks` (`project_id`,`environment`,`timestamp`);--> statement-breakpoint
CREATE INDEX `idx_logs_project` ON `logs` (`project_id`);--> statement-breakpoint
CREATE INDEX `idx_logs_environment` ON `logs` (`environment`);--> statement-breakpoint
CREATE INDEX `idx_logs_level` ON `logs` (`level`);--> statement-breakpoint
CREATE INDEX `idx_logs_timestamp` ON `logs` (`timestamp`);--> statement-breakpoint
CREATE INDEX `idx_logs_project_timestamp` ON `logs` (`project_id`,`timestamp`);--> statement-breakpoint
CREATE INDEX `idx_logs_project_env_timestamp` ON `logs` (`project_id`,`environment`,`timestamp`);--> statement-breakpoint
CREATE UNIQUE INDEX `projects_slug_unique` ON `projects` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `projects_api_key_unique` ON `projects` (`api_key`);