CREATE TABLE `plugin_data` (
	`plugin` text NOT NULL,
	`account_id` text NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL,
	PRIMARY KEY(`plugin`, `account_id`, `key`),
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
