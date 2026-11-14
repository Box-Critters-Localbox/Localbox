CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`nickname` text NOT NULL,
	`password_hash` text NOT NULL,
	`critter_id` text DEFAULT 'hamster' NOT NULL,
	`coins` integer DEFAULT 150 NOT NULL,
	`is_member` integer DEFAULT false NOT NULL,
	`is_guest` integer DEFAULT false NOT NULL,
	`is_team` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT "accounts_coins_non_negative" CHECK("accounts"."coins" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `accounts_nickname_unique` ON `accounts` (lower("nickname"));--> statement-breakpoint
CREATE TABLE `eggs` (
	`account_id` text NOT NULL,
	`egg_id` text NOT NULL,
	`found_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`account_id`, `egg_id`),
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `friends` (
	`account_id` text NOT NULL,
	`friend_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`account_id`, `friend_id`),
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`friend_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "friends_not_self" CHECK("friends"."account_id" <> "friends"."friend_id")
);
--> statement-breakpoint
CREATE INDEX `friends_friend_id_idx` ON `friends` (`friend_id`);--> statement-breakpoint
CREATE TABLE `ignores` (
	`account_id` text NOT NULL,
	`ignored_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`account_id`, `ignored_id`),
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`ignored_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "ignores_not_self" CHECK("ignores"."account_id" <> "ignores"."ignored_id")
);
--> statement-breakpoint
CREATE TABLE `inventory` (
	`account_id` text NOT NULL,
	`item_id` text NOT NULL,
	`equipped` integer DEFAULT false NOT NULL,
	`acquired_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`account_id`, `item_id`),
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
