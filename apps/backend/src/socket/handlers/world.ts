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

import * as world from "@/constants/world.ts";
import * as utils from "@/src/utils.ts";
import * as types from "@/src/types.ts";
import * as queries from "@/src/db/queries.ts";

import parties from "@/constants/parties.json";

export function listen(
  _io: Server,
  socket: Socket,
  ctx: types.SocketHandlerContext,
) {
  socket.on("joinRoom", (roomId: string) => {
    if (!ctx.localPlayer || !ctx.localCrumb) return;

    if (
      z.object({
        roomId: z.enum(Object.keys(world.rooms) as [string, ...string[]]),
      }).safeParse({ roomId: roomId }).success == false
    ) return;

    const _room = (world.rooms[roomId] || { default: null }).default;
    if (!_room) return;

    socket.leave(ctx.localCrumb._roomId);
    socket.broadcast.in(ctx.localCrumb._roomId).emit("R", ctx.localCrumb);

    const modEnabled = (ctx.localPlayer._mods || []).includes("roomExits");
    //@ts-ignore: Index type is correct
    const correctExit = world.roomExits[ctx.localCrumb._roomId + "->" + roomId];
    if (modEnabled && correctExit) {
      ctx.localPlayer.x = correctExit.x;
      ctx.localPlayer.y = correctExit.y;
      ctx.localPlayer.rotation = correctExit.r;
    }

    if (!modEnabled || !correctExit) {
      ctx.localPlayer.x = _room.startX;
      ctx.localPlayer.y = _room.startY;
      ctx.localPlayer.rotation = _room.startR | 180;
    }

    ctx.localCrumb = utils.makeCrumb(ctx.localPlayer, roomId);
    world.players[ctx.localPlayer.playerId] = ctx.localCrumb;

    console.log("> " + ctx.localPlayer.nickname + ' joined "' + roomId + '"!');
    socket.join(roomId);

    let playerCrumbs = Object.values(world.players).filter((crumb) =>
      crumb._roomId == roomId
    );
    if (world.npcs[roomId]) {
      playerCrumbs = [
        ...playerCrumbs,
        ...world.npcs[roomId],
      ];
    }
    socket.emit("joinRoom", {
      name: _room.name,
      roomId: roomId,
      playerCrumbs: playerCrumbs,
    });

    socket.broadcast.in(ctx.localCrumb._roomId).emit("A", ctx.localCrumb);
  });

  socket.on("switchParty", (partyId: string) => {
    if (!ctx.localPlayer || !ctx.localCrumb) return;

    if (
      z.object({
        partyId: z.enum(Object.keys(parties) as [string, ...string[]]),
      }).strict().safeParse({ partyId: partyId }).success == false
    ) return;

    ctx.localPlayer._partyId = partyId;
    socket.emit("switchParty");
  });

  socket.on("trigger", async () => {
    if (!ctx.localPlayer || !ctx.localCrumb) return;

    const activatedTrigger = await utils.getTrigger(
      ctx.localPlayer,
      ctx.localCrumb._roomId,
      ctx.localPlayer._partyId,
    );
    if (!activatedTrigger) return;

    if (activatedTrigger.hasItems) {
      for (const item of activatedTrigger.hasItems) {
        if (!ctx.localPlayer.inventory.includes(item)) return;
      }
    }

    if (activatedTrigger.grantItem) {
      let items = activatedTrigger.grantItem;
      if (typeof items == "string") items = [items];

      const newItems = [];
      for (const item of items) {
        if (!ctx.localPlayer.inventory.includes(item)) {
          socket.emit("addItem", { itemId: item, showGUI: true });
          ctx.localPlayer.inventory.push(item);
          newItems.push(item);
        }
      }
      queries.addItems(ctx.localPlayer.playerId, newItems);
    }

    if (activatedTrigger.addEgg) {
      const egg = activatedTrigger.addEgg;
      socket.emit("addEgg", egg);
      if (!ctx.localPlayer.eggs.includes(egg)) {
        ctx.localPlayer.eggs.push(egg);
        queries.addEgg(ctx.localPlayer.playerId, egg);
      }
    }
  });
}
