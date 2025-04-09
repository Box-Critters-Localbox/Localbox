// deno-lint-ignore-file no-explicit-any
import { Server } from "https://deno.land/x/socket_io@0.2.0/mod.ts";
import { z } from "zod";

import * as world from "../constants/world.ts";
import * as items from "../constants/items.ts";
import * as utils from "../src/utils.ts";
import { CritterId, LocalPlayer, PlayerCrumb, ShopData } from "../src/types.ts";

import parties from "../constants/parties.json" with { type: "json" };
import itemsJSON from "../public/base/items.json" with { type: "json" };

export const io = new Server();
io.on("connection", (socket) => {
  let localPlayer: LocalPlayer;

  /** Condensed player data that is sufficient enough for other clients */
  let localCrumb: PlayerCrumb;

  // TODO: implement checking PlayFab API with ticket
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
      utils.updateAccount(localPlayer.nickname, property, value);
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
      critterId: CritterId;
      partyId: string;
      persistent: boolean;
      mods: Array<string>;
    };

    if ([
      "today2019",
      "today2020",
      "today2021"
    ].includes(sub.partyId)) {
      console.log('target year:', parseInt(sub.partyId.replace('today', '')));
      sub.partyId = utils.getCurrentEvent(parseInt(sub.partyId.replace('today', '')))
    };

    const persistentAccount = await utils.getAccount(sub.nickname);
    if (!sub.persistent || persistentAccount.individual == null) {
      localPlayer = {
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
        _mods: [],
      };

      if (sub.persistent) {
        utils.createAccount(localPlayer);
        localPlayer = new Proxy<LocalPlayer>(
          utils.expandAccount(localPlayer),
          handler,
        );
      }
    } else {
      persistentAccount.individual.critterId = sub.critterId || "hamster";
      persistentAccount.individual._partyId = sub.partyId || "default";
      persistentAccount.individual._mods = sub.mods || [];

      localPlayer = new Proxy<LocalPlayer>(
        utils.expandAccount(persistentAccount.individual),
        handler,
      );
    }

    localPlayer._partyId = socket.handshake.query.get("partyId") || "default";
    world.queue.splice(world.queue.indexOf(localPlayer.nickname), 1);

    localCrumb = utils.makeCrumb(localPlayer, world.spawnRoom);
    socket.join(world.spawnRoom);

    world.players[localPlayer.playerId] = localCrumb;
    socket.emit("login", {
      player: localPlayer,
      spawnRoom: world.spawnRoom,
    });
  });

  socket.on("joinRoom", (roomId: string) => {
    if (
      z.object({
        roomId: z.enum(Object.keys(world.rooms) as any),
      }).safeParse({ roomId: roomId }).success == false
    ) return;

    const _room = (world.rooms[roomId] || { default: null }).default;
    if (!_room) return;

    socket.leave(localCrumb._roomId);
    socket.broadcast.in(localCrumb._roomId).emit("R", localCrumb);

    const modEnabled = (localPlayer._mods || []).includes("roomExits");
    //@ts-ignore: Index type is correct
    const correctExit = world.roomExits[localCrumb._roomId + "->" + roomId];
    if (modEnabled && correctExit) {
      localPlayer.x = correctExit.x;
      localPlayer.y = correctExit.y;
      localPlayer.rotation = correctExit.r;
    }

    if (!modEnabled || !correctExit) {
      localPlayer.x = _room.startX;
      localPlayer.y = _room.startY;
      localPlayer.rotation = _room.startR | 180;
    }

    localCrumb = utils.makeCrumb(localPlayer, roomId);
    world.players[localPlayer.playerId] = localCrumb;

    console.log("> " + localPlayer.nickname + ' joined "' + roomId + '"!');
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

    socket.broadcast.in(localCrumb._roomId).emit("A", localCrumb);
  });

  socket.on("moveTo", (x: number, y: number) => {
    const roomData = world.rooms[localCrumb._roomId][localPlayer._partyId] ||
      world.rooms[localCrumb._roomId].default;
    if (
      z.object({
        x: z.number().min(0).max(roomData.width),
        y: z.number().min(0).max(roomData.height),
      }).safeParse({ x: x, y: y }).success == false
    ) return;

    const newDirection = utils.getDirection(localPlayer.x, localPlayer.y, x, y);

    localPlayer.x = x;
    localPlayer.y = y;
    localPlayer.rotation = newDirection;

    localCrumb.x = x;
    localCrumb.y = y;
    localCrumb.r = newDirection;

    io.in(localCrumb._roomId).volatile.emit("X", {
      i: localPlayer.playerId,
      x: x,
      y: y,
      r: newDirection,
    });
  });

  socket.on("message", (text: string) => {
    if (
      z.object({
        text: z.string().nonempty(),
      }).safeParse({ text: text }).success == false
    ) return;

    console.log(`> ${localPlayer.nickname} sent message:`, text);
    localCrumb.m = text;

    socket.broadcast.in(localCrumb._roomId).emit("M", {
      i: localPlayer.playerId,
      m: text,
    });

    setTimeout(() => {
      if (localCrumb.m != text) return;
      localCrumb.m = "";
    }, 5e3);
  });

  socket.on("emote", (emote: string) => {
    if (
      z.object({
        emote: z.string().nonempty(), // TODO: make this an enum
      }).safeParse({ emote: emote }).success == false
    ) return;

    console.log(`> ${localPlayer.nickname} sent emote:`, emote);
    localCrumb.e = emote;

    socket.broadcast.in(localCrumb._roomId).emit("E", {
      i: localPlayer.playerId,
      e: emote,
    });

    setTimeout(() => {
      if (localCrumb.e != emote) return;
      localCrumb.e = "";
    }, 5e3);
  });

  // ? Options is specified just because sometimes it is sent, but its always an empty string
  socket.on("code", (code: string, _options?: string) => {
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

    console.log(`> ${localPlayer.nickname} sent code:`, code);

    const addItem = function (id: string, showGUI: boolean = false) {
      if (!localPlayer.inventory.includes(id)) {
        socket.emit("addItem", { itemId: id, showGUI: showGUI });
        localPlayer.inventory.push(id);
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
          localPlayer,
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
        localPlayer.gear = [
          "sun_orange",
          "super_mask_black",
          "toque_blue",
          "dracula_cloak",
          "headphones_black",
          "hoodie_black",
        ];

        if (localCrumb._roomId == "tavern") {
          localPlayer.x = 216;
          localPlayer.y = 118;

          localCrumb.x = 216;
          localCrumb.y = 118;

          io.in(localCrumb._roomId).volatile.emit("X", {
            i: localPlayer.playerId,
            x: 216,
            y: 118,
          });
        }

        io.in(localCrumb._roomId).emit("G", {
          i: localPlayer.playerId,
          g: localPlayer.gear,
        });

        socket.emit("updateGear", localPlayer.gear);
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
    const eventItem = (_eventItemCodes[localPlayer._partyId] || {})[code];
    if (eventItem) addItem(eventItem);
  });

  socket.on("updateGear", (gear: Array<string>) => {
    if (
      z.object({
        gear: z.array(z.string().nonempty()).default([]),
      }).strict().safeParse({ gear: gear }).success == false
    ) return;

    const _gear = [];
    for (const itemId of gear) {
      if (localPlayer.inventory.includes(itemId)) {
        _gear.push(itemId);
      }
    }
    localPlayer.gear = _gear;

    io.in(localCrumb._roomId).emit("G", {
      i: localPlayer.playerId,
      g: localPlayer.gear,
    });

    socket.emit("updateGear", localPlayer.gear);
  });

  socket.on("getShop", () => {
    const _shopItems = items.shop as unknown as ShopData;
    socket.emit("getShop", {
      lastItem: _shopItems.lastItem.itemId,
      freeItem: _shopItems.freeItem.itemId,
      nextItem: _shopItems.nextItem.itemId,
      collection: _shopItems.collection.map((item) => item.itemId),
    });
  });

  socket.on("buyItem", (itemId: string) => {
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
      localPlayer.coins >= target.cost &&
      !localPlayer.inventory.includes(itemId)
    ) {
      console.log(
        "[+] Bought item: " + itemId + " for " + target.cost + " coins",
      );
      localPlayer.coins -= target.cost;
      localPlayer.inventory.push(itemId);

      socket.emit("buyItem", { itemId: itemId });
      socket.emit("updateCoins", { balance: localPlayer.coins });
    }
  });

  socket.on("trigger", async () => {
    const activatedTrigger = await utils.getTrigger(
      localPlayer,
      localCrumb._roomId,
      localPlayer._partyId,
    );
    if (!activatedTrigger) return;

    if (activatedTrigger.hasItems) {
      for (const item of activatedTrigger.hasItems) {
        if (!localPlayer.inventory.includes(item)) return;
      }
    }

    if (activatedTrigger.grantItem) {
      let items = activatedTrigger.grantItem;
      if (typeof items == "string") items = [items];

      for (const item of items) {
        if (!localPlayer.inventory.includes(item)) {
          socket.emit("addItem", { itemId: item, showGUI: true });
          localPlayer.inventory.push(item);
        }
      }
    }

    if (activatedTrigger.addEgg) {
      const egg = activatedTrigger.addEgg;
      socket.emit("addEgg", egg);
      localPlayer.eggs.push(egg);
    }
  });

  socket.on("addIgnore", (playerId: string) => {
    if (
      z.object({
        playerId: z.enum(Object.keys(world.players) as any),
      }).strict().safeParse({ playerId: playerId }).success == false
    ) return;

    if (
      Object.keys(world.players).includes(playerId) &&
      !localPlayer.ignore.includes(playerId)
    ) {
      localPlayer.ignore.push(playerId);
    }
  });

  socket.on("attack", (playerId: string) => {
    if (
      z.object({
        playerId: z.enum(Object.keys(world.players) as any),
      }).strict().safeParse({ playerId: playerId }).success == false
    ) return;

    if (!localPlayer.gear.includes("bb_beebee")) return;
    const monster = Object.values(world.players).find((player) =>
      player.i == playerId && player.c == "huggable"
    );

    if (monster) {
      io.in(localCrumb._roomId).emit("R", monster);

      localPlayer.coins += 10;
      socket.emit("updateCoins", { balance: localPlayer.coins });

      delete world.players[playerId];
    }
  });

  socket.on("switchParty", (partyId: string) => {
    if (
      z.object({
        partyId: z.enum(Object.keys(parties) as any),
      }).strict().safeParse({ partyId: partyId }).success == false
    ) return;

    localPlayer._partyId = partyId;
    socket.emit("switchParty");
  });

  socket.on("beep", () => socket.emit("beep"));

  socket.on("disconnect", (reason) => {
    if (reason == "server namespace disconnect") return;

    if (localPlayer && localCrumb) {
      io.in(localCrumb._roomId).emit("R", localCrumb);
      delete world.players[localPlayer.playerId];
    }
  });
});
