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

export function listen(
  io: Server,
  socket: Socket,
  ctx: types.SocketHandlerContext,
) {
  socket.on("moveTo", (x: number, y: number) => {
    if (!ctx.localPlayer || !ctx.localCrumb) return;

    const roomData =
      world.rooms[ctx.localCrumb._roomId][ctx.localPlayer._partyId] ||
      world.rooms[ctx.localCrumb._roomId].default;
    if (
      z.object({
        x: z.number().min(0).max(roomData.width),
        y: z.number().min(0).max(roomData.height),
      }).safeParse({ x: x, y: y }).success == false
    ) return;

    const newDirection = utils.getDirection(
      ctx.localPlayer.x,
      ctx.localPlayer.y,
      x,
      y,
    );

    ctx.localPlayer.x = x;
    ctx.localPlayer.y = y;
    ctx.localPlayer.rotation = newDirection;

    ctx.localCrumb.x = x;
    ctx.localCrumb.y = y;
    ctx.localCrumb.r = newDirection;

    io.in(ctx.localCrumb._roomId).volatile.emit("X", {
      i: ctx.localPlayer.playerId,
      x: x,
      y: y,
      r: newDirection,
    });
  });

  socket.on("updateGear", (gear: Array<string>) => {
    if (!ctx.localPlayer || !ctx.localCrumb) return;

    if (
      z.object({
        gear: z.array(z.string().nonempty()).default([]),
      }).strict().safeParse({ gear: gear }).success == false
    ) return;

    const _gear = [];
    for (const itemId of gear) {
      if (ctx.localPlayer.inventory.includes(itemId)) {
        _gear.push(itemId);
      }
    }
    ctx.localPlayer.gear = _gear;
    queries.setGear(ctx.localPlayer.playerId, _gear);

    io.in(ctx.localCrumb._roomId).emit("G", {
      i: ctx.localPlayer.playerId,
      g: ctx.localPlayer.gear,
    });

    socket.emit("updateGear", ctx.localPlayer.gear);
  });
}
