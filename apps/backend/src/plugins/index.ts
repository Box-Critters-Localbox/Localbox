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

import { readdir } from "fs/promises";
import { dirname, join } from "path";
import { Hono } from "hono";
import type { Server } from "socket.io";

import db from "../db";
import * as queries from "../db/queries";
import * as world from "../../constants/world";
import { createStore } from "./store";
import type {
  CommandHandler,
  HookMap,
  MessageResult,
  NicknameResult,
  Plugin,
  PluginApi,
  Session,
} from "./types";

export type { Plugin, PluginApi, Session } from "./types";

const PLUGINS_DIR = process.env.EXECUTABLE === "true"
  ? join(dirname(process.execPath), "plugins")
  : join(import.meta.dir, "../../plugins");

const hooks: { [K in keyof HookMap]: Array<HookMap[K]> } = {
  login: [],
  disconnect: [],
  message: [],
  nickname: [],
};
const commands = new Map<string, CommandHandler>();

async function readOverrides(name: string): Promise<Record<string, unknown>> {
  const file = Bun.file(join(PLUGINS_DIR, name, "config.json"));
  return (await file.exists()) ? await file.json() : {};
}

function createApi(
  name: string,
  io: Server,
  overrides: Record<string, unknown>,
): PluginApi {
  return {
    name,
    io,
    db,
    players: world.players,
    routes: new Hono(),
    store: createStore(name),
    config: (defaults) => ({ ...defaults, ...overrides }),

    on(event, handler) {
      (hooks[event] as Array<typeof handler>).push(handler);
    },

    command(command, handler) {
      if (commands.has(command)) {
        throw new Error(`Command "${command}" is already registered`);
      }
      commands.set(command, handler);
    },

    alert({ socket }, text) {
      socket.emit("alert", { text, style: "light" });
    },

    grantCoins({ socket, player }, amount) {
      player.coins = queries.addCoins(player.playerId, amount) ?? player.coins;
      socket.emit("updateCoins", { balance: player.coins });
    },
  };
}

export async function loadPlugins(app: Hono, io: Server) {
  const entries = await readdir(PLUGINS_DIR, { withFileTypes: true })
    .catch(() => []);
  const names = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  for (const name of names) {
    const overrides = await readOverrides(name);
    if (overrides.enabled === false) continue;

    try {
      const { default: plugin }: { default: Plugin } = await import(
        join(PLUGINS_DIR, name)
      );
      const api = createApi(name, io, overrides);
      await plugin(api);
      app.route(`/api/plugins/${name}`, api.routes);
      console.log(`[+] Loaded plugin: ${name}`);
    } catch (error) {
      console.error(`[!] Failed to load plugin "${name}":`, error);
    }
  }
}

export async function runHook(
  event: "login" | "disconnect",
  session: Session,
) {
  for (const handler of hooks[event]) {
    try {
      await handler(session);
    } catch (error) {
      console.error(`[!] Plugin ${event} hook failed:`, error);
    }
  }
}

/** Resolves to the text to send, or null if a plugin dropped the message */
export async function runMessageHooks(
  session: Session,
  text: string,
): Promise<string | null> {
  for (const handler of hooks.message) {
    let result: MessageResult;
    try {
      result = await handler({ ...session, text });
    } catch (error) {
      console.error("[!] Plugin message hook failed:", error);
      continue;
    }

    if (result === false) return null;
    if (result) text = result.text;
  }
  return text;
}

const DEFAULT_NICKNAME_REASON = "That nickname isn't allowed.";

export async function runNicknameHooks(
  nickname: string,
): Promise<string | null> {
  for (const handler of hooks.nickname) {
    let result: NicknameResult;
    try {
      result = await handler({ nickname });
    } catch (error) {
      console.error("[!] Plugin nickname hook failed:", error);
      continue;
    }

    if (result === false) return DEFAULT_NICKNAME_REASON;
    if (result) return result.reason;
  }
  return null;
}

/** Returns true if a plugin command handled the code */
export async function runCommand(session: Session, code: string, args: string) {
  const handler = commands.get(code);
  if (!handler) return false;

  try {
    await handler({ ...session, args });
  } catch (error) {
    console.error(`[!] Plugin command "${code}" failed:`, error);
  }
  return true;
}
