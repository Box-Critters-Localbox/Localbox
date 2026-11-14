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

import { Image } from "imagescript";
import { dirname, join } from "path";
import { jwtVerify, SignJWT } from "jose";

import { rooms, spawnRoom } from "../constants/world.ts";
import { LocalPlayer, PlayerCrumb, Room, Trigger } from "./types.ts";
import parties from "../constants/parties.json" with { type: "json" };
import { readdir, readFile } from "fs/promises";
import { z } from "zod";
import { env } from "./env.ts";
import * as schemas from "./schema.ts";
import { RateLimiter } from "./rate-limit.ts";

const EXECUTABLE = process.env.EXECUTABLE === "true";
const BASE_DIR = EXECUTABLE
  ? dirname(process.execPath)
  : dirname(dirname(Bun.fileURLToPath(import.meta.url)));
const MONOREPO_ROOT = EXECUTABLE ? BASE_DIR : dirname(dirname(BASE_DIR));
const PUBLIC_DIR = join(MONOREPO_ROOT, "apps", "frontend", "public");

export async function createJWT(
  payload: Omit<z.infer<typeof schemas.ticket>, "sub">,
  accountId: string,
): Promise<string> {
  const jwt = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(accountId)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(env.JWT_SECRET));

  return jwt;
}

export async function verifyJWT(
  token: string,
): Promise<z.infer<typeof schemas.ticket> | null> {
  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(env.JWT_SECRET),
      { algorithms: ["HS256"] },
    );
    const parsed = schemas.ticket.safeParse(payload);
    return parsed.success ? parsed.data : null;
  } catch (_e) {
    return null;
  }
}

/** Condenses the local player variable into data that is sufficient enough for other clients */
export function makeCrumb(player: LocalPlayer, roomId: string): PlayerCrumb {
  return {
    i: player.playerId,
    n: player.nickname,
    c: player.critterId,
    x: player.x,
    y: player.y,
    r: player.rotation,
    g: player.gear,

    // message & emote
    m: "",
    e: "",

    _roomId: roomId,
  };
}

// TODO: use the correct triggers for the active party
export async function getTrigger(
  player: LocalPlayer,
  roomId: string,
  partyId: string,
) {
  const room = rooms[roomId][partyId];
  if (!room) {
    console.log(`[!] Cannot find room: "${roomId}@${partyId}"!`);
    return;
  }

  try {
    const treasureBuffer = new Uint8Array(
      await Bun.file(
        //@ts-ignore: Deno lint
        room.media.treasure?.replace("..", "public"),
      ).arrayBuffer(),
    );
    const treasure = await Image.decode(treasureBuffer);
    if (!treasure) {
      throw new Error('Missing map server for room "' + roomId + '"!');
    }

    const pixel = treasure.getPixelAt(player.x, player.y);
    const r = (pixel >> 24) & 0xFF,
      g = (pixel >> 16) & 0xFF,
      b = (pixel >> 8) & 0xFF;
    const hexCode = ((r << 16) | (g << 8) | b).toString(16).padStart(6, "0");

    const trigger = (room.triggers as Trigger[]).find((trigger) =>
      trigger.hex == hexCode
    );
    if (trigger) {
      return trigger.server;
    } else {
      return null;
    }
  } catch (e) {
    console.warn("[!] Caught error while checking for activated trigger.", e);
  }
}

export function getNewCodeItem(player: LocalPlayer, items: Array<string>) {
  const itemsSet = new Set(player.inventory);
  const available = items.filter((item) => !itemsSet.has(item));
  return available.length === 0
    ? null
    : available[Math.floor(Math.random() * available.length)];
}

/**
 * Indexes the /media/rooms directory for all versions of all rooms
 * @returns All versions of every room
 */
export async function indexRoomData() {
  const _roomData: Record<string, Record<string, Room>> = {};

  const basePath = join(PUBLIC_DIR, "media", "rooms");
  const _rooms = await readdir(basePath, { withFileTypes: true });

  for (const room of _rooms) {
    if (room.isDirectory()) {
      _roomData[room.name] = {};
      const roomPath = join(basePath, room.name);
      const versions = await readdir(roomPath, { withFileTypes: true });
      for (const version of versions) {
        if (version.isDirectory()) {
          const versionPath = join(roomPath, version.name, "data.json");
          try {
            const data = await readFile(versionPath, "utf-8");
            _roomData[room.name][version.name] = JSON.parse(data);
          } catch (_) {
            console.log(
              `[!] "${room.name}@${version.name}" is missing a data.json file`,
            );
          }
        }
      }
    }
  }

  return _roomData;
}

export function expandAccount(player: LocalPlayer) {
  const defaultPos = rooms[spawnRoom].default;
  player.x = defaultPos.startX;
  player.y = defaultPos.startY;
  player.rotation = defaultPos.startR;
  return player;
}

export function getDirection(
  x: number,
  y: number,
  targetX: number,
  targetY: number,
) {
  const a = Math.floor((180 * Math.atan2(targetX - x, y - targetY)) / Math.PI);
  return a < 0 ? a + 360 : a;
}

export function getCurrentEvent(year: number): string {
  const today = new Date();
  const testDate = new Date(year, today.getMonth(), today.getDate());

  //@ts-ignore: Types are bugging out here for absolutely no reason
  for (const [eventId, { start, end }] of Object.entries(parties)) {
    if (!start || !end) continue;

    const originalStart = new Date(start);
    const originalEnd = new Date(end);

    const adjustedStart = new Date(
      year,
      originalStart.getMonth(),
      originalStart.getDate(),
    );
    const adjustedEnd = new Date(
      // Handle roll over
      originalEnd.getFullYear() > originalStart.getFullYear() ? year + 1 : year,
      originalEnd.getMonth(),
      originalEnd.getDate(),
    );

    if (testDate >= adjustedStart && testDate <= adjustedEnd) {
      return eventId;
    }
  }

  return "default";
}

export function resolvePartyId(partyId: unknown): string {
  if (typeof partyId !== "string") return "default";

  if (["today2019", "today2020", "today2021"].includes(partyId)) {
    return getCurrentEvent(parseInt(partyId.replace("today", "")));
  }

  return Object.hasOwn(parties, partyId) ? partyId : "default";
}

const limiter = new RateLimiter();

setInterval(() => limiter.sweep(), 60_000).unref();

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  return limiter.hit(key, limit, windowMs);
}
