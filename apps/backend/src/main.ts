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

import { type Context, Hono } from "hono";
import { getConnInfo, serveStatic } from "hono/bun";
import { z } from "zod";
import { dirname, extname, join, normalize } from "path";

import { engine, io, websocket } from "./socket";
import { loadPlugins, runNicknameHooks } from "./plugins";
import { config } from "./config";
import * as world from "../constants/world";
import * as schemas from "./schema";
import * as utils from "./utils";
import * as queries from "./db/queries";
import type { Account } from "./db/schema";
import parties from "../constants/parties.json";

const EXECUTABLE = process.env.EXECUTABLE === "true";
const BASE_DIR = EXECUTABLE
  ? dirname(process.execPath)
  : dirname(dirname(Bun.fileURLToPath(import.meta.url)));
const MONOREPO_ROOT = EXECUTABLE ? BASE_DIR : dirname(dirname(BASE_DIR));
const PUBLIC_DIR = join(MONOREPO_ROOT, "apps", "frontend", "dist");

const app = new Hono();

const DUMMY_HASH = await Bun.password.hash(crypto.randomUUID());

function clientIp(c: Context) {
  try {
    return getConnInfo(c).remote.address ?? "unknown";
  } catch {
    return "unknown";
  }
}

function tooManyRequests(c: Context) {
  return c.json({
    success: false,
    message: "Too many attempts, please wait a bit and try again.",
  }, 429);
}

async function parseBody<T extends z.ZodTypeAny>(
  c: Context,
  schema: T,
): Promise<z.infer<T> | Response> {
  if (!c.req.header("content-type")?.startsWith("application/json")) {
    return c.json({ success: false, message: "Expected a JSON body." }, 415);
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, message: "Bad request" }, 400);
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return c.json({
      success: false,
      message: parsed.error.issues[0]?.message ?? "Validation failure",
    }, 400);
  }

  return parsed.data;
}

function isUniqueViolation(error: unknown) {
  const code = (error as { code?: string })?.code ??
    (error as { cause?: { code?: string } })?.cause?.code;
  return code === "SQLITE_CONSTRAINT_UNIQUE";
}

async function startSession(
  c: Context,
  account: Account,
  data: Pick<z.infer<typeof schemas.login>, "partyId" | "mods">,
) {
  const token = await utils.createJWT(
    { partyId: data.partyId, mods: data.mods },
    account.id,
  );

  return c.json({
    success: true,
    playerId: account.id,
    token,
  });
}

// API Routes
app.post("/api/client/login", async (c) => {
  if (!utils.rateLimit(`login:${clientIp(c)}`, 10, 60_000)) {
    return tooManyRequests(c);
  }

  const data = await parseBody(c, schemas.login);
  if (data instanceof Response) return data;

  const account = queries.findAccountByNickname(data.nickname);
  const valid = await Bun.password.verify(
    data.password,
    account?.passwordHash ?? DUMMY_HASH,
  );

  if (!account || !valid) {
    return c.json({
      success: false,
      message: "Incorrect nickname or password.",
    }, 401);
  }

  return startSession(c, account, data);
});

app.post("/api/client/signup", async (c) => {
  if (!utils.rateLimit(`signup:${clientIp(c)}`, 10, 60 * 60_000)) {
    return tooManyRequests(c);
  }

  const data = await parseBody(c, schemas.signup);
  if (data instanceof Response) return data;

  const nicknameTaken = c.json({
    success: false,
    message: "That nickname is already taken.",
  }, 409);

  if (queries.findAccountByNickname(data.nickname)) return nicknameTaken;

  const rejection = await runNicknameHooks(data.nickname);
  if (rejection) {
    return c.json({ success: false, message: rejection }, 422);
  }

  let account: Account;
  try {
    account = queries.createAccount({
      nickname: data.nickname,
      passwordHash: await Bun.password.hash(data.password),
      critterId: data.critterId,
      coins: config.startingCoins,
    });
  } catch (error) {
    if (isUniqueViolation(error)) return nicknameTaken;
    throw error;
  }

  return startSession(c, account, { partyId: "default", mods: data.mods });
});

app.get("/api/server/players", (c) => {
  return c.json({ players: world.players });
});

app.get("/api/server/rooms", (c) => {
  return c.json(world.rooms);
});

app.get("/api/client/rooms", (c) => {
  const url = new URL(c.req.url);
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
    return c.json({
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
    return c.json({
      success: false,
      message:
        "No rooms were fetched while indexxing using the specified partyId hash.",
    });
  }

  const partyIds = Object.keys(parties);
  if (debug) {
    const roomNames = roomResponse.map((room) => room.name);
    return c.json({
      parties: partyIds,
      data: roomNames,
    });
  }

  return c.json({
    parties: partyIds,
    data: roomResponse,
  });
});

await loadPlugins(app, io);

app.use("/*", serveStatic({ root: PUBLIC_DIR }));

const port = parseInt(
  process.argv[2] || process.env.PORT || String(config.port),
);

if (isNaN(port)) {
  console.log("Port provided is not valid.");
  process.exit(1);
}

export default {
  port,
  idleTimeout: 30,
  fetch(req: Request, server: any) {
    const url = new URL(req.url);

    if (url.pathname.startsWith("/socket.io/")) {
      return engine.handleRequest(req, server);
    }

    return app.fetch(req, server);
  },
  websocket,
};
