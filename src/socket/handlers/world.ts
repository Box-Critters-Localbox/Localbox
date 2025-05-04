import { Server, Socket } from "https://deno.land/x/socket_io@0.2.0/mod.ts";
import z from "zod";

import * as world from "@/constants/world.ts";
import * as utils from "@/utils.ts";
import * as types from "@/types.ts";

import parties from "@/constants/parties.json" with { type: "json" };

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

      for (const item of items) {
        if (!ctx.localPlayer.inventory.includes(item)) {
          socket.emit("addItem", { itemId: item, showGUI: true });
          ctx.localPlayer.inventory.push(item);
        }
      }
    }

    if (activatedTrigger.addEgg) {
      const egg = activatedTrigger.addEgg;
      socket.emit("addEgg", egg);
      ctx.localPlayer.eggs.push(egg);
    }
  });
}
