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

import { desc } from "drizzle-orm";

import { accounts } from "@/src/db/schema";
import type { Plugin } from "@/src/plugins";

const plugin: Plugin = (api) => {
  const { size } = api.config({ size: 5 });

  const top = () =>
    api.db
      .select({ nickname: accounts.nickname, coins: accounts.coins })
      .from(accounts)
      .orderBy(desc(accounts.coins))
      .limit(size)
      .all();

  api.command("top", (session) => {
    const lines = top().map((row, i) => `${i + 1}. ${row.nickname}: ${row.coins}`);
    api.alert(session, `Richest critters\n${lines.join("\n")}`);
  });

  api.routes.get("/", (c) => c.json(top()));
};

export default plugin;
