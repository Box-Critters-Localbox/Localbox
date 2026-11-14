/*
 * Localbox - A Typescript server emulator for Box Critters
 * Copyright (C) 2024 Index (https://indexx.dev/)
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import { sql } from "drizzle-orm";
import {
	check,
	index,
	integer,
	primaryKey,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";

const timestamps = {
	createdAt: integer("created_at", { mode: "timestamp" })
		.notNull()
		.default(sql`(unixepoch())`),
	updatedAt: integer("updated_at", { mode: "timestamp" })
		.notNull()
		.default(sql`(unixepoch())`)
		.$onUpdate(() => new Date()),
};

export const accounts = sqliteTable(
	"accounts",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		nickname: text("nickname").notNull(),
		passwordHash: text("password_hash").notNull(),
		critterId: text("critter_id").notNull().default("hamster"),
		coins: integer("coins").notNull().default(150),
		isMember: integer("is_member", { mode: "boolean" }).notNull().default(false),
		isGuest: integer("is_guest", { mode: "boolean" }).notNull().default(false),
		isTeam: integer("is_team", { mode: "boolean" }).notNull().default(false),
		...timestamps,
	},
	(t) => [
		uniqueIndex("accounts_nickname_unique").on(sql`lower(${t.nickname})`),
		check("accounts_coins_non_negative", sql`${t.coins} >= 0`),
	],
);

export const inventory = sqliteTable(
	"inventory",
	{
		accountId: text("account_id")
			.notNull()
			.references(() => accounts.id, { onDelete: "cascade" }),
		itemId: text("item_id").notNull(),
		equipped: integer("equipped", { mode: "boolean" }).notNull().default(false),
		acquiredAt: integer("acquired_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(t) => [primaryKey({ columns: [t.accountId, t.itemId] })],
);

export const eggs = sqliteTable(
	"eggs",
	{
		accountId: text("account_id")
			.notNull()
			.references(() => accounts.id, { onDelete: "cascade" }),
		eggId: text("egg_id").notNull(),
		foundAt: integer("found_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(t) => [primaryKey({ columns: [t.accountId, t.eggId] })],
);

export const friends = sqliteTable(
	"friends",
	{
		accountId: text("account_id")
			.notNull()
			.references(() => accounts.id, { onDelete: "cascade" }),
		friendId: text("friend_id")
			.notNull()
			.references(() => accounts.id, { onDelete: "cascade" }),
		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(t) => [
		primaryKey({ columns: [t.accountId, t.friendId] }),
		index("friends_friend_id_idx").on(t.friendId),
		check("friends_not_self", sql`${t.accountId} <> ${t.friendId}`),
	],
);

export const ignores = sqliteTable(
	"ignores",
	{
		accountId: text("account_id")
			.notNull()
			.references(() => accounts.id, { onDelete: "cascade" }),
		ignoredId: text("ignored_id")
			.notNull()
			.references(() => accounts.id, { onDelete: "cascade" }),
		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(t) => [
		primaryKey({ columns: [t.accountId, t.ignoredId] }),
		check("ignores_not_self", sql`${t.accountId} <> ${t.ignoredId}`),
	],
);

export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;

export const pluginData = sqliteTable(
	"plugin_data",
	{
		plugin: text("plugin").notNull(),
		accountId: text("account_id")
			.notNull()
			.references(() => accounts.id, { onDelete: "cascade" }),
		key: text("key").notNull(),
		value: text("value", { mode: "json" }).notNull(),
	},
	(t) => [primaryKey({ columns: [t.plugin, t.accountId, t.key] })],
);
