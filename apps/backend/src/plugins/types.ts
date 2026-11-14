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

import type { Hono } from "hono";
import type { Server, Socket } from "socket.io";

import type { LocalPlayer, PlayerCrumb } from "../types";
import type db from "../db";

export type Session = {
  socket: Socket;
  player: LocalPlayer;
  crumb: PlayerCrumb;
};

/** `false` drops the message, `{ text }` replaces it, nothing lets it through */
export type MessageResult = void | false | { text: string };

export type NicknameResult = void | false | { reason: string };

export type HookMap = {
  login: (session: Session) => void | Promise<void>;
  disconnect: (session: Session) => void | Promise<void>;
  message: (
    session: Session & { text: string },
  ) => MessageResult | Promise<MessageResult>;
  nickname: (
    info: { nickname: string },
  ) => NicknameResult | Promise<NicknameResult>;
};

export type CommandHandler = (
  session: Session & { args: string },
) => void | Promise<void>;

export type PluginStore = {
  get<T>(accountId: string, key: string): T | undefined;
  set(accountId: string, key: string, value: unknown): void;
};

export type PluginApi = {
  name: string;
  io: Server;
  db: typeof db;
  players: Record<string, PlayerCrumb>;
  /** Mounted at /api/plugins/<name> */
  routes: Hono;
  store: PluginStore;
  /** Defaults merged with the overrides in plugins/<name>/config.json */
  config<T extends object>(defaults: T): T;
  on<K extends keyof HookMap>(event: K, handler: HookMap[K]): void;
  /** Registers a slash command, e.g. "top" for /top */
  command(name: string, handler: CommandHandler): void;
  alert(session: Session, text: string): void;
  grantCoins(session: Session, amount: number): void;
};

export type Plugin = (api: PluginApi) => void | Promise<void>;
