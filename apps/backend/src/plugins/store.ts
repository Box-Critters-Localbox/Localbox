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

import { and, eq } from "drizzle-orm";

import db from "../db";
import { pluginData } from "../db/schema";
import type { PluginStore } from "./types";

export function createStore(plugin: string): PluginStore {
  return {
    get<T>(accountId: string, key: string) {
      const row = db
        .select({ value: pluginData.value })
        .from(pluginData)
        .where(
          and(
            eq(pluginData.plugin, plugin),
            eq(pluginData.accountId, accountId),
            eq(pluginData.key, key),
          ),
        )
        .get();
      return row?.value as T | undefined;
    },

    set(accountId, key, value) {
      db.insert(pluginData)
        .values({ plugin, accountId, key, value })
        .onConflictDoUpdate({
          target: [pluginData.plugin, pluginData.accountId, pluginData.key],
          set: { value },
        })
        .run();
    },
  };
}
