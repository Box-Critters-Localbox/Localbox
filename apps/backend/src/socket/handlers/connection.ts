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

import * as world from "@/constants/world.ts";
import * as utils from "@/src/utils.ts";
import * as types from "@/src/types.ts";
import * as queries from "@/src/db/queries.ts";
import { runHook } from "@/src/plugins";

export function listen(
  io: Server,
  socket: Socket,
  ctx: types.SocketHandlerContext,
) {
  socket.once("login", async (ticket: unknown) => {
    if (typeof ticket !== "string") {
      socket.disconnect(true);
      return;
    }

    const session = await utils.verifyJWT(ticket);
    const account = session ? queries.findAccountById(session.sub) : undefined;
    if (!session || !account) {
      socket.disconnect(true);
      return;
    }

    // Only one session per account, the newest login wins
    const existingCrumb = world.players[account.id];
    if (existingCrumb) {
      io.in(existingCrumb._roomId).emit("R", existingCrumb);
      delete world.players[account.id];
    }
    io.in(`account:${account.id}`).disconnectSockets(true);
    socket.join(`account:${account.id}`);

    const data = queries.loadPlayerData(account.id);
    ctx.localPlayer = utils.expandAccount({
      playerId: account.id,
      nickname: account.nickname,
      critterId: account.critterId as types.CritterId,
      ignore: data.ignore,
      friends: data.friends,
      inventory: data.inventory,
      gear: data.gear,
      eggs: data.eggs,
      coins: account.coins,
      isMember: account.isMember,
      isGuest: account.isGuest,
      isTeam: account.isTeam,
      x: 0,
      y: 0,
      rotation: 0,
      mutes: [],

      _partyId: utils.resolvePartyId(session.partyId),
      _mods: session.mods,
    });

    const partyQuery = socket.handshake?.query;
    let partyIdFromQuery: string | undefined;
    if (partyQuery) {
      // support both Map-like query (with .get) and object-style query (property access)
      const maybe = (partyQuery as any).get
        ? (partyQuery as any).get("partyId")
        : (partyQuery as any).partyId;
      if (typeof maybe === "string") partyIdFromQuery = maybe;
      else if (Array.isArray(maybe) && maybe.length > 0) {
        partyIdFromQuery = maybe[0];
      }
    }
    if (partyIdFromQuery) {
      ctx.localPlayer._partyId = utils.resolvePartyId(partyIdFromQuery);
    }

    ctx.localCrumb = utils.makeCrumb(ctx.localPlayer, world.spawnRoom);
    socket.join(world.spawnRoom);

    world.players[ctx.localPlayer.playerId] = ctx.localCrumb;
    socket.emit("login", {
      player: ctx.localPlayer,
      spawnRoom: world.spawnRoom,
    });

    await runHook("login", {
      socket,
      player: ctx.localPlayer,
      crumb: ctx.localCrumb,
    });
  });

  socket.on("beep", () => socket.emit("beep"));

  socket.on("disconnect", () => {
    if (!ctx.localPlayer || !ctx.localCrumb) return;

    // A newer session for this account may have already replaced this crumb
    if (world.players[ctx.localPlayer.playerId] !== ctx.localCrumb) return;

    io.in(ctx.localCrumb._roomId).emit("R", ctx.localCrumb);
    delete world.players[ctx.localPlayer.playerId];

    runHook("disconnect", {
      socket,
      player: ctx.localPlayer,
      crumb: ctx.localCrumb,
    });
  });
}
