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

import { and, eq, inArray, sql } from "drizzle-orm";
import db from "./index";
import {
	accounts,
	eggs,
	friends,
	ignores,
	inventory,
	type NewAccount,
} from "./schema";

export function findAccountByNickname(nickname: string) {
	return db
		.select()
		.from(accounts)
		.where(sql`lower(${accounts.nickname}) = lower(${nickname})`)
		.get();
}

export function findAccountById(id: string) {
	return db.select().from(accounts).where(eq(accounts.id, id)).get();
}

export function createAccount(values: NewAccount) {
	return db.insert(accounts).values(values).returning().get();
}

export function loadPlayerData(accountId: string) {
	const items = db
		.select({ itemId: inventory.itemId, equipped: inventory.equipped })
		.from(inventory)
		.where(eq(inventory.accountId, accountId))
		.orderBy(inventory.acquiredAt)
		.all();

	return {
		inventory: items.map((item) => item.itemId),
		gear: items.filter((item) => item.equipped).map((item) => item.itemId),
		eggs: db
			.select({ eggId: eggs.eggId })
			.from(eggs)
			.where(eq(eggs.accountId, accountId))
			.all()
			.map((egg) => egg.eggId),
		friends: db
			.select({ friendId: friends.friendId })
			.from(friends)
			.where(eq(friends.accountId, accountId))
			.all()
			.map((friend) => friend.friendId),
		ignore: db
			.select({ ignoredId: ignores.ignoredId })
			.from(ignores)
			.where(eq(ignores.accountId, accountId))
			.all()
			.map((ignored) => ignored.ignoredId),
	};
}

export function addItems(accountId: string, itemIds: Array<string>) {
	if (itemIds.length === 0) return;

	db.insert(inventory)
		.values(itemIds.map((itemId) => ({ accountId, itemId })))
		.onConflictDoNothing()
		.run();
}

export function setGear(accountId: string, itemIds: Array<string>) {
	db.transaction((tx) => {
		tx.update(inventory)
			.set({ equipped: false })
			.where(eq(inventory.accountId, accountId))
			.run();

		if (itemIds.length === 0) return;

		tx.update(inventory)
			.set({ equipped: true })
			.where(
				and(
					eq(inventory.accountId, accountId),
					inArray(inventory.itemId, itemIds),
				),
			)
			.run();
	});
}

export function addEgg(accountId: string, eggId: string) {
	db.insert(eggs).values({ accountId, eggId }).onConflictDoNothing().run();
}

export function addIgnore(accountId: string, ignoredId: string) {
	if (accountId === ignoredId || !findAccountById(ignoredId)) return;

	db.insert(ignores)
		.values({ accountId, ignoredId })
		.onConflictDoNothing()
		.run();
}

export function addCoins(accountId: string, amount: number) {
	const updated = db
		.update(accounts)
		.set({ coins: sql`${accounts.coins} + ${amount}` })
		.where(eq(accounts.id, accountId))
		.returning({ coins: accounts.coins })
		.get();

	return updated?.coins ?? null;
}

export function buyItem(accountId: string, itemId: string, cost: number) {
	return db.transaction((tx) => {
		const owned = tx
			.select({ itemId: inventory.itemId })
			.from(inventory)
			.where(
				and(eq(inventory.accountId, accountId), eq(inventory.itemId, itemId)),
			)
			.get();
		if (owned) return null;

		const updated = tx
			.update(accounts)
			.set({ coins: sql`${accounts.coins} - ${cost}` })
			.where(and(eq(accounts.id, accountId), sql`${accounts.coins} >= ${cost}`))
			.returning({ coins: accounts.coins })
			.get();
		if (!updated) return null;

		tx.insert(inventory).values({ accountId, itemId }).run();
		return updated.coins;
	});
}
