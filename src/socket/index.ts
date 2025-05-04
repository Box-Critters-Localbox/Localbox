import { Server } from "https://deno.land/x/socket_io@0.2.0/mod.ts";

import * as connection from "./handlers/connection.ts";
import * as player from "./handlers/player.ts";
import * as world from "./handlers/world.ts";
import * as social from "./handlers/social.ts";
import * as economy from "./handlers/economy.ts";

export const io = new Server();

io.on("connection", (socket) => {
  const context = {
    localPlayer: null,
    localCrumb: null,
  };

  connection.listen(io, socket, context);
  player.listen(io, socket, context);
  world.listen(io, socket, context);
  social.listen(io, socket, context);
  economy.listen(io, socket, context);
});
