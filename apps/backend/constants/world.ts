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

import { PlayerCrumb, Room } from "@/src/types.ts";
import { indexRoomData } from "@/src/utils.ts";

export const rooms: Record<string, Record<string, Room>> =
  await indexRoomData();
export const spawnRoom = "tavern";

export const players: Record<string, PlayerCrumb> = {
  "0": {
    "i": "0",
    "n": "Huggable",
    "c": "huggable",
    "x": 1670,
    "y": 323,
    "r": 180,
    "g": [],
    "m": "",
    "e": "",
    "_roomId": "crash_site",
  },
};

export const roomExits = {
  "cellar->tavern": { x: 360, y: 410, r: 0 },
  "crash_site->cellar": { x: 615, y: 400, r: 0 },
  "shack->port": { x: 550, y: 235, r: 0 },
  "jungle->port": { x: 650, y: 230, r: 0 },
  "snowman_village->tavern": { x: 563, y: 368, r: 0 },
};

// deno-lint-ignore no-explicit-any
export const npcs: { [key: string]: any } = {
  snowman_village: [
    {
      "i": "NPC0",
      "n": "Snow Girl",
      "c": "snowgirl",
      "x": 1289,
      "y": 228,
      "r": 180,
      "g": [],
      "m": "",
      "e": "",
    },
    {
      "i": "NPC1",
      "n": "Snow Patrol",
      "c": "snow_patrol",
      "x": 1644,
      "y": 221,
      "r": 180,
      "g": [],
      "m": "",
      "e": "",
    },
    {
      "i": "NPC2",
      "n": "Snow Greeter",
      "c": "snow_greeter",
      "x": 443,
      "y": 317,
      "r": 180,
      "g": [],
      "m": "",
      "e": "",
    },
    {
      "i": "NPC3",
      "n": "Snow Grandma",
      "c": "snowgrandma",
      "x": 1938,
      "y": 251,
      "r": 180,
      "g": [],
      "m": "",
      "e": "",
    },
    {
      "i": "NPC4",
      "n": "Snow Keeper",
      "c": "snowkeeper",
      "x": 893,
      "y": 216,
      "r": 180,
      "g": [],
      "m": "",
      "e": "",
    },
  ],
};
