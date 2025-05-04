import { Server, Socket } from "https://deno.land/x/socket_io@0.2.0/mod.ts";
import z from "zod";

import * as world from "@/constants/world.ts";
import * as utils from "@/utils.ts";
import * as types from "@/types.ts";

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

    io.in(ctx.localCrumb._roomId).emit("G", {
      i: ctx.localPlayer.playerId,
      g: ctx.localPlayer.gear,
    });

    socket.emit("updateGear", ctx.localPlayer.gear);
  });
}
