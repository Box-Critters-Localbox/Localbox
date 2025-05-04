import { serve } from "https://deno.land/std@0.162.0/http/server.ts";
import { contentType } from "https://deno.land/std@0.224.0/media_types/mod.ts";
import {
  dirname,
  fromFileUrl,
  join,
  normalize,
} from "https://deno.land/std@0.224.0/path/mod.ts";
import { exists } from "jsr:@std/fs/exists";

import { io } from "@/socket/index.ts";
import * as world from "@/constants/world.ts";
import { getAccount } from "@/utils.ts";
import * as schemas from "@/schema.ts";
import * as utils from "@/utils.ts";
import parties from "@/constants/parties.json" with { type: "json" };
import { extname } from "https://deno.land/std@0.212.0/path/extname.ts";
import { parseArgs } from "jsr:@std/cli/parse-args";

const EXECUTABLE = Deno.env.get("EXECUTABLE") == "true";
const BASE_DIR = EXECUTABLE
  ? dirname(Deno.execPath())
  : dirname(dirname(fromFileUrl(Deno.mainModule)));
const PUBLIC_DIR = join(BASE_DIR, "public");

if (!EXECUTABLE) {
  if (!await exists("./public") || !await exists(".env")) {
    console.error("Missing files. Make sure you have `public/` and `.env`");
    Deno.exit();
  }
}

async function serveStatic(req: Request): Promise<Response> {
  const url = new URL(req.url);
  let pathname = url.pathname;
  pathname = decodeURIComponent(pathname);
  pathname = pathname.endsWith("/") ? pathname + "index.html" : pathname;

  const fsPath = normalize(join(PUBLIC_DIR, pathname));

  // Prevent directory traversal
  if (!fsPath.startsWith(PUBLIC_DIR)) {
    return new Response("Forbidden", { status: 403 });
  }

  try {
    const file = await Deno.readFile(fsPath);
    const mime = contentType(extname(fsPath)) || "application/octet-stream";
    return new Response(file, {
      headers: { "Content-Type": mime },
    });
  } catch {
    return new Response("Not Found", { status: 404 });
  }
}

async function handler(
  req: Request,
  connInfo: Deno.ServeHandlerInfo,
): Promise<Response> {
  const url = new URL(req.url);
  const pathname = url.pathname;

  if (req.headers.get("upgrade") === "websocket") {
    //@ts-ignore: The websocket successfully upgrades
    return io.handler()(req, connInfo);
  }

  if (req.method == "POST" && pathname == "/api/client/login") {
    try {
      const body = await req.json();
      const parsed = schemas.login.safeParse(body);
      if (!parsed.success) {
        return Response.json({
          success: false,
          message: "Validation failure",
          error: parsed.error,
        }, { status: 400 });
      }

      const data = parsed.data;
      const _players = Object.values(world.players);
      const nameInUse = _players.find((p) => p.n === data.nickname) ||
        world.queue.includes(data.nickname);

      if (nameInUse) {
        return Response.json({
          success: false,
          message: "There is already a player with this nickname online.",
        });
      }

      const JWT_CONTENT = {
        playerId: crypto.randomUUID(),
        ...data,
      };

      const JWT_TOKEN = Deno.env.get("JWT_TOKEN");
      if (!JWT_TOKEN) {
        return new Response("JWT_TOKEN not set in env", { status: 500 });
      }

      const token = await utils.createJWT(JWT_CONTENT);

      world.queue.push(data.nickname);

      return Response.json({
        success: true,
        playerId: JWT_CONTENT.playerId,
        token,
      });
    } catch {
      return Response.json({
        success: false,
        message: "Bad request",
      }, { status: 400 });
    }
  }

  if (req.method == "GET") {
    switch (pathname) {
      case "/api/server/players": {
        return Response.json({ players: world.players });
      }

      case "/api/server/rooms": {
        return Response.json(world.rooms);
      }

      case "/api/server/persistence": {
        const account = await getAccount();
        return Response.json({
          success: true,
          data: account,
        });
      }

      case "/api/client/rooms": {
        const url = new URL(req.url);
        let partyId = url.searchParams.get("partyId") || "default";
        const debug = url.searchParams.has("debug");

        if (
          [
            "today2019",
            "today2020",
            "today2021",
          ].includes(partyId)
        ) {
          partyId = utils.getCurrentEvent(
            parseInt(partyId.replace("today", "")),
          );
        }

        if (!Object.keys(parties).includes(partyId)) {
          return Response.json({
            success: false,
            message: "Invalid partyId hash provided.",
          });
        }

        let missing = 0;
        const roomResponse = Object.keys(world.rooms).reduce(
          (res, roomId) => {
            const room = world.rooms[roomId];

            if (room[partyId]) {
              if (
                !room[partyId].partyExclusive ||
                room[partyId]?.partyExclusive?.includes(partyId)
              ) {
                res.push(room[partyId]);
              } else {
                missing++;
              }
            } else {
              if (
                !room.default.partyExclusive ||
                room.default.partyExclusive.includes(partyId)
              ) {
                res.push(room.default);
              } else {
                missing++;
              }
            }

            return res;
          },
          [] as Array<typeof world.rooms[string]["default"]>,
        );

        if (missing === Object.keys(world.rooms).length) {
          return Response.json({
            success: false,
            message:
              "No rooms were fetched while indexxing using the specified partyId hash.",
          });
        }

        const partyIds = Object.keys(parties);
        if (debug) {
          const roomNames = roomResponse.map((room) => room.name);
          return Response.json({
            parties: partyIds,
            data: roomNames,
          });
        }

        return Response.json({
          parties: partyIds,
          data: roomResponse,
        });
      }

      default: {
        return serveStatic(req);
      }
    }
  }

  return new Response("Not Found", { status: 404 });
}

const args = parseArgs(Deno.args, {
  string: ["port"],
  default: {
    port: "3257",
  },
});

if (isNaN(Number(args.port))) {
  console.log("Port provided is not valid.");
  Deno.exit();
}

//@ts-ignore: Type issues occuring from upgrading websocket requests to Socket.io
await serve(handler, { port: args.port });
