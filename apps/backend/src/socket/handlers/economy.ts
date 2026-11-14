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

import { Server, Socket } from "socket.io";
import z from "zod";

import * as items from "@/constants/items.ts";
import * as types from "@/src/types.ts";
import * as queries from "@/src/db/queries.ts";

export function listen(
  _io: Server,
  socket: Socket,
  ctx: types.SocketHandlerContext,
) {
  socket.on("getShop", () => {
    const _shopItems = items.getShop() as types.ShopData;
    socket.emit("getShop", {
      lastItem: _shopItems.lastItem.itemId,
      freeItem: _shopItems.freeItem.itemId,
      nextItem: _shopItems.nextItem.itemId,
      collection: _shopItems.collection.map((item) => item.itemId),
    });
  });

  socket.on("buyItem", (itemId: string) => {
    if (!ctx.localPlayer || !ctx.localCrumb) return;

    if (
      z.object({
        itemId: z.string().nonempty(),
      }).strict().safeParse({ itemId: itemId }).success == false
    ) return;

    // ? Free item is excluded from this list because the game just sends the "/freeitem" code
    // ? Next week's item is excluded because it is only a preview in the shop
    const currentShop = items.getShop();
    const _shopItems = [
      currentShop.lastItem,
      ...currentShop.collection,
    ];

    const target = _shopItems.find((item) => item.itemId == itemId)!;
    if (!target) {
      console.log(
        "> There is no item in this week's shop with itemId:",
        itemId,
      );
      return;
    }

    if (
      ctx.localPlayer.coins >= target.cost &&
      !ctx.localPlayer.inventory.includes(itemId)
    ) {
      const balance = queries.buyItem(
        ctx.localPlayer.playerId,
        itemId,
        target.cost,
      );
      if (balance === null) return;

      console.log(
        "[+] Bought item: " + itemId + " for " + target.cost + " coins",
      );
      ctx.localPlayer.coins = balance;
      ctx.localPlayer.inventory.push(itemId);

      socket.emit("buyItem", { itemId: itemId });
      socket.emit("updateCoins", { balance: ctx.localPlayer.coins });
    }
  });
}
