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

export type CritterId =
  | "hamster"
  | "snail"
  | "lizard"
  | "beaver"
  | "raccoon"
  | "penguin"
  | "huggable";

export type Trigger = {
  hex: string;
  world?: { joinRoom: string };
  room?: { hide: Array<string> };
  server?: {
    grantItem?: string | Array<string>;
    hasItems?: Array<string>;
    joinGame?: string;
    addEgg?: string;
  };
};

export type Room = {
  roomId: string;
  name: string;
  width: number;
  height: number;
  startX: number;
  startY: number;
  startR: number;
  media: {
    background: string;
    foreground?: string;
    treasure?: string;
    navMesh: string;
    music?: string;
    video?: string;
  };
  layout: string;
  triggers: Array<Trigger>;
  spriteSheet: string;
  extra: null;
  partyExclusive?: Array<string>;
};

export type LocalPlayer = {
  playerId: string;
  nickname: string;
  critterId: CritterId;
  ignore: Array<string>;
  friends: Array<string>;
  inventory: Array<string>;
  gear: Array<string>;
  /** Eggs is the term used to describe any object used in a scavenger hunt. Any prop name found in that list will be hidden and replaced with it's "_found" suffix prop counterpart */
  eggs: Array<string>;
  coins: number;
  isMember: boolean | false;
  isGuest: boolean | false;
  isTeam: boolean | false;
  x: number | 440;
  y: number | 210;
  rotation: number | 180;
  mutes: Array<unknown>;

  _partyId: string;
  _mods: Array<string>;

  // deno-lint-ignore no-explicit-any
  [key: string]: any;
};

export type PlayerCrumb = {
  /** Player ID */
  i: string;
  /** Player Nickname */
  n: string;
  /** Critter (Hamster, Beaver, Lizard, Snail, etc) */
  c: CritterId;
  x: number;
  y: number;
  r: number;
  /** Gear (equipped items) */
  g: Array<string>;

  /** Message */
  m: string;
  /** Emote */
  e: string;

  _roomId: string;
};

export type ShopData = {
  lastItem: { itemId: string; cost: number };
  freeItem: { itemId: string; cost: number };
  nextItem: { itemId: string; cost: number };
  collection: Array<{ itemId: string; cost: number }>;
};

export type PartySchedule = {
  [key: string]: {
    start: string | null;
    end: string | null;
  };
};

export type SocketHandlerContext = {
  localPlayer: null | LocalPlayer;
  localCrumb: null | PlayerCrumb;
};
