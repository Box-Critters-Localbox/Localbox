// deno-lint-ignore-file no-explicit-any
import { Server, Socket } from "https://deno.land/x/socket_io@0.2.0/mod.ts";
import z from "zod";

import * as world from "@/constants/world.ts";
import * as items from "@/constants/items.ts";
import * as utils from "@/utils.ts";
import * as types from "@/types.ts";

import itemsJSON from "@/constants/items.json" with { type: "json" };

export function listen(
  io: Server,
  socket: Socket,
  ctx: types.SocketHandlerContext,
) {
  socket.on("message", (text: string) => {
    if (!ctx.localPlayer || !ctx.localCrumb) return;

    if (
      z.object({
        text: z.string().nonempty(),
      }).safeParse({ text: text }).success == false
    ) return;

    console.log(`> ${ctx.localPlayer.nickname} sent message:`, text);
    ctx.localCrumb.m = text;

    socket.broadcast.in(ctx.localCrumb._roomId).emit("M", {
      i: ctx.localPlayer.playerId,
      m: text,
    });

    setTimeout(() => {
      if (ctx.localCrumb!.m != text) return;
      ctx.localCrumb!.m = "";
    }, 5e3);
  });

  socket.on("emote", (emote: string) => {
    if (!ctx.localPlayer || !ctx.localCrumb) return;

    if (
      z.object({
        emote: z.string().nonempty(), // TODO: make this an enum
      }).safeParse({ emote: emote }).success == false
    ) return;

    console.log(`> ${ctx.localPlayer.nickname} sent emote:`, emote);
    ctx.localCrumb.e = emote;

    socket.broadcast.in(ctx.localCrumb._roomId).emit("E", {
      i: ctx.localPlayer.playerId,
      e: emote,
    });

    setTimeout(() => {
      if (ctx.localCrumb!.e != emote) return;
      ctx.localCrumb!.e = "";
    }, 5e3);
  });

  // ? Options is specified just because sometimes it is sent, but its always an empty string
  socket.on("code", (code: string, _options?: string) => {
    if (!ctx.localPlayer || !ctx.localCrumb) return;

    if (
      z.object({
        command: z.enum([
          "pop",
          "freeitem",
          "tbt",
          "darkmode",
          "spydar",
          "allitems",
        ]),
      }).safeParse({
        command: code,
      }).success == false
    ) return;

    console.log(`> ${ctx.localPlayer.nickname} sent code:`, code);

    const addItem = function (id: string, showGUI: boolean = false) {
      if (!ctx.localPlayer!.inventory.includes(id)) {
        socket.emit("addItem", { itemId: id, showGUI: showGUI });
        ctx.localPlayer!.inventory.push(id);
      }
    };

    // Misc. Codes
    switch (code) {
      case "pop": {
        socket.emit(
          "pop",
          Object.values(world.players).filter((critter) =>
            critter.c != "huggable"
          ).length,
        );
        break;
      }
      case "freeitem": {
        addItem(items.shop.freeItem.itemId, true);
        break;
      }
      case "tbt": {
        const _throwbackItem = utils.getNewCodeItem(
          ctx.localPlayer,
          items.throwback,
        );
        if (_throwbackItem) addItem(_throwbackItem, true);
        break;
      }
      case "darkmode": {
        addItem("3d_black", true);
        break;
      }
      case "spydar": {
        ctx.localPlayer.gear = [
          "sun_orange",
          "super_mask_black",
          "toque_blue",
          "dracula_cloak",
          "headphones_black",
          "hoodie_black",
        ];

        if (ctx.localCrumb._roomId == "tavern") {
          ctx.localPlayer.x = 216;
          ctx.localPlayer.y = 118;

          ctx.localCrumb.x = 216;
          ctx.localCrumb.y = 118;

          io.in(ctx.localCrumb._roomId).volatile.emit("X", {
            i: ctx.localPlayer.playerId,
            x: 216,
            y: 118,
          });
        }

        io.in(ctx.localCrumb._roomId).emit("G", {
          i: ctx.localPlayer.playerId,
          g: ctx.localPlayer.gear,
        });

        socket.emit("updateGear", ctx.localPlayer.gear);
        break;
      }
      case "allitems": {
        for (const item of itemsJSON) {
          addItem(item.itemId, false);
        }
        break;
      }
    }

    // Item Codes
    const _itemCodes = items.codes as Record<string, string | Array<string>>;
    const item = _itemCodes[code];

    if (typeof item == "string") {
      addItem(item, true);
    } else if (typeof item == "object") {
      for (const _ of item) {
        addItem(_, true);
      }
    }

    // Event Codes (eg. Christmas 2019)
    const _eventItemCodes = items.eventCodes as Record<
      string,
      Record<string, string>
    >;
    const eventItem = (_eventItemCodes[ctx.localPlayer._partyId] || {})[code];
    if (eventItem) addItem(eventItem);
  });

  socket.on("addIgnore", (playerId: string) => {
    if (!ctx.localPlayer || !ctx.localCrumb) return;

    if (
      z.object({
        playerId: z.enum(Object.keys(world.players) as any),
      }).strict().safeParse({ playerId: playerId }).success == false
    ) return;

    if (
      Object.keys(world.players).includes(playerId) &&
      !ctx.localPlayer.ignore.includes(playerId)
    ) {
      ctx.localPlayer.ignore.push(playerId);
    }
  });

  socket.on("attack", (playerId: string) => {
    if (!ctx.localPlayer || !ctx.localCrumb) return;

    if (
      z.object({
        playerId: z.enum(Object.keys(world.players) as any),
      }).strict().safeParse({ playerId: playerId }).success == false
    ) return;

    if (!ctx.localPlayer.gear.includes("bb_beebee")) return;
    const monster = Object.values(world.players).find((player) =>
      player.i == playerId && player.c == "huggable"
    );

    if (monster) {
      io.in(ctx.localCrumb._roomId).emit("R", monster);

      ctx.localPlayer.coins += 10;
      socket.emit("updateCoins", { balance: ctx.localPlayer.coins });

      delete world.players[playerId];
    }
  });
}
