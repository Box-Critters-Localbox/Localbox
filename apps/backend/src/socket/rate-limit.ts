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

import type { Socket } from "socket.io";

import { config } from "../config";
import { RateLimiter } from "../rate-limit";

/** Drops events that exceed their rule, and disconnects sockets that keep flooding */
export function limitSocket(socket: Socket) {
  const limiter = new RateLimiter();
  let violations = 0;

  socket.use(([event], next) => {
    const name = Object.hasOwn(config.socketRateLimits, event)
      ? event
      : "default";
    const { limit, windowMs } = config.socketRateLimits[name];

    if (limiter.hit(name, limit, windowMs)) return next();

    if (++violations >= config.maxViolations) {
      console.log(`[!] Disconnecting ${socket.id} for flooding`);
      socket.disconnect(true);
    }
  });
}
