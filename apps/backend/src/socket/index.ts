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

import { Server } from "socket.io";
import { Server as Engine } from "@socket.io/bun-engine";

import * as connection from "./handlers/connection.ts";
import * as player from "./handlers/player.ts";
import * as world from "./handlers/world.ts";
import * as social from "./handlers/social.ts";
import * as economy from "./handlers/economy.ts";
import { limitSocket } from "./rate-limit.ts";

export const io = new Server();

export const engine = new Engine();
io.bind(engine);

io.on("connection", (socket) => {
  const context = {
    localPlayer: null,
    localCrumb: null,
  };

  limitSocket(socket);

  connection.listen(io, socket, context);
  player.listen(io, socket, context);
  world.listen(io, socket, context);
  social.listen(io, socket, context);
  economy.listen(io, socket, context);
});

export const { websocket } = engine.handler();
