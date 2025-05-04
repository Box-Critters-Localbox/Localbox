// deno-lint-ignore-file no-explicit-any
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
  socket.once("login", async (ticket: string) => {
    if (
      z.object({
        ticket: z.string(),
      }).safeParse({ ticket: ticket }).success == false
    ) return;

    let playerData;
    try {
      playerData = await utils.verifyJWT(ticket);
    } catch (_e) {
      socket.disconnect(true);
      return;
    }

    // TODO: make this just an inline function instead of having an onPropertyChange function, I'm just really lazy right now lol -index
    function onPropertyChange(property: string, value: any) {
      utils.updateAccount(ctx.localPlayer!.nickname, property, value);
    }

    const createArrayHandler = (propertyName: string) => ({
      get(target: any, property: string) {
        if (typeof target[property] === "function") {
          return function (...args: any[]) {
            const result = target[property].apply(target, args);
            onPropertyChange(propertyName, target);
            return result;
          };
        }
        return target[property];
      },
    });

    const handler = {
      set(target: any, property: string, value: any) {
        if (Array.isArray(value)) {
          target[property] = new Proxy(value, createArrayHandler(property));
          onPropertyChange(property, target[property]);
        } else {
          target[property] = value;
          onPropertyChange(property, value);
        }
        return true;
      },
      get(target: any, property: string) {
        if (Array.isArray(target[property])) {
          return new Proxy(target[property], createArrayHandler(property));
        }
        return target[property];
      },
    };

    //@ts-ignore: I will fix the type errors with using a different JWT library eventually
    const sub = playerData as {
      playerId: string;
      nickname: string;
      critterId: types.CritterId;
      partyId: string;
      persistent: boolean;
      mods: Array<string>;
    };

    if (
      [
        "today2019",
        "today2020",
        "today2021",
      ].includes(sub.partyId)
    ) {
      console.log("target year:", parseInt(sub.partyId.replace("today", "")));
      sub.partyId = utils.getCurrentEvent(
        parseInt(sub.partyId.replace("today", "")),
      );
    }

    const persistentAccount = await utils.getAccount(sub.nickname);
    if (!sub.persistent || persistentAccount.individual == null) {
      ctx.localPlayer = {
        playerId: sub.playerId,
        nickname: sub.nickname,
        critterId: sub.critterId,
        ignore: [],
        friends: [],
        inventory: [],
        gear: [],
        eggs: [],
        coins: 150,
        isMember: false,
        isGuest: false,
        isTeam: false,
        x: 0,
        y: 0,
        rotation: 0,
        mutes: [],

        _partyId: sub.partyId, // This key is replaced down the line anyway
        _mods: sub.mods,
      };

      if (sub.persistent) {
        utils.createAccount(ctx.localPlayer);
        ctx.localPlayer = new Proxy<types.LocalPlayer>(
          utils.expandAccount(ctx.localPlayer),
          handler,
        );
      }
    } else {
      persistentAccount.individual.critterId = sub.critterId || "hamster";
      persistentAccount.individual._partyId = sub.partyId || "default";
      persistentAccount.individual._mods = sub.mods || [];

      ctx.localPlayer = new Proxy<types.LocalPlayer>(
        utils.expandAccount(persistentAccount.individual),
        handler,
      );
    }

    ctx.localPlayer._partyId = socket.handshake.query.get("partyId") ||
      "default";
    world.queue.splice(world.queue.indexOf(ctx.localPlayer.nickname), 1);

    ctx.localCrumb = utils.makeCrumb(ctx.localPlayer, world.spawnRoom);
    socket.join(world.spawnRoom);

    world.players[ctx.localPlayer.playerId] = ctx.localCrumb;
    socket.emit("login", {
      player: ctx.localPlayer,
      spawnRoom: world.spawnRoom,
    });
  });

  socket.on("beep", () => socket.emit("beep"));

  socket.on("disconnect", (reason) => {
    if (reason == "server namespace disconnect") return;

    if (ctx.localPlayer && ctx.localCrumb) {
      io.in(ctx.localCrumb._roomId).emit("R", ctx.localCrumb);
      delete world.players[ctx.localPlayer.playerId];
    }
  });
}
