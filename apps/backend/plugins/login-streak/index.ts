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

import type { Plugin } from "@/src/plugins";

type Streak = { count: number; lastClaim: string };

const day = (offset = 0) =>
  new Date(Date.now() + offset * 864e5).toISOString().slice(0, 10);

const plugin: Plugin = (api) => {
  const { base, step, max, delayMs } = api.config({
    base: 10,
    step: 5,
    max: 50,
    delayMs: 3000,
  });

  const reward = (count: number) => Math.min(base + (count - 1) * step, max);

  api.on("login", (session) => {
    const id = session.player.playerId;

    setTimeout(() => {
      if (!session.socket.connected) return;

      const streak = api.store.get<Streak>(id, "streak");
      if (streak?.lastClaim === day()) return;

      const count = streak?.lastClaim === day(-1) ? streak.count + 1 : 1;
      api.store.set(id, "streak", { count, lastClaim: day() });
      api.grantCoins(session, reward(count));
      api.alert(
        session,
        `Day ${count} login streak! You earned ${reward(count)} coins.`,
      );
    }, delayMs);
  });

  api.command("streak", (session) => {
    const streak = api.store.get<Streak>(session.player.playerId, "streak");
    const count = streak && streak.lastClaim >= day(-1) ? streak.count : 0;
    api.alert(
      session,
      `Login streak: ${count} days. Tomorrow's reward: ${reward(count + 1)} coins.`,
    );
  });
};

export default plugin;
