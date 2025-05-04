import { Server, Socket } from "https://deno.land/x/socket_io@0.2.0/mod.ts";
import z from "zod";

import * as items from "@/constants/items.ts";
import * as types from "@/types.ts";

export function listen(
  _io: Server,
  socket: Socket,
  ctx: types.SocketHandlerContext,
) {
  socket.on("getShop", () => {
    const _shopItems = items.shop as unknown as types.ShopData;
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
    const currentShop = items.shop;
    const _shopItems = [
      currentShop.lastItem,
      currentShop.nextItem,
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
      console.log(
        "[+] Bought item: " + itemId + " for " + target.cost + " coins",
      );
      ctx.localPlayer.coins -= target.cost;
      ctx.localPlayer.inventory.push(itemId);

      socket.emit("buyItem", { itemId: itemId });
      socket.emit("updateCoins", { balance: ctx.localPlayer.coins });
    }
  });
}
