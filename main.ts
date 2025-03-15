import { serve } from "https://deno.land/std@0.162.0/http/server.ts";

import { sign } from 'hono/jwt';
import { Hono } from "https://deno.land/x/hono@v3.0.0/mod.ts";
import { serveStatic } from "https://deno.land/x/hono@v3.0.0/middleware.ts";
import { env } from 'hono/adapter';
import { validator } from 'hono/validator';

import { io } from "./io.ts";
import * as world from "./constants/world.ts";
import { Room } from "./types.ts";
import * as schemas from "./schema.ts";
import { getAccount } from "./utils.ts";
import parties from "./constants/parties.json" with { type: 'json' };

const app = new Hono();
app.get('/*', serveStatic({ root: './public' }));

// APIs for debugging and other purposes
app.get('/api/server/players', (c) => c.json({ players: world.players }));

app.get('/api/server/rooms', (c) => c.json(world.rooms));

app.get('/api/server/persistence', async (c) => {
  const account = await getAccount();
  return c.json({
    success: true,
    data: account
  });
})

// APIs for use by the client
app.post('/api/client/login', validator('json', async (_value, c) => {
  try {
    const body = await c.req.json();
    const parsed = schemas.login.safeParse(body);
    if (!parsed.success) {
      return c.json({
        success: false,
        message: "Validation failure",
        error: parsed.error
      }, 400);
    };
    return parsed.data;
  } catch(_e) {
    return c.json({
      success: false,
      message: "Bad request"
    }, 400);
  }
// deno-lint-ignore no-explicit-any
}) as any, async (c) => {
  const body = c.req.valid('json') as {
    nickname: string,
    critterId: string,
    partyId: string,
    persistent: boolean,
    mods: Array<string>
  };

  const _players = Object.values(world.players);
  if (_players.find((player) => player.n == body.nickname) || world.queue.includes(body.nickname)) {
    return c.json({
      success: false,
      message: "There is already a player with this nickname online."
    });
  }

  const JWT_CONTENT = {
    sub: {
      playerId: crypto.randomUUID(),
      ...body // ZOD validator is set to make the body strict, so this expansion should be fine
    },
    exp: Math.floor(Date.now() / 1000) + 60 * 5 // 5 mins expiry
  };

  //@ts-ignore: Deno lint
  const { JWT_TOKEN } = env<{ JWT_TOKEN: string }>(c);
  const token = await sign(JWT_CONTENT, JWT_TOKEN);
  
  world.queue.push(body.nickname);
  return c.json({
    success: true,
    playerId: JWT_CONTENT.sub.playerId, 
    token: token
  });
});

app.get('/api/client/rooms', (c) => {
  const partyId = c.req.query('partyId') || 'default';
  if (!parties.includes(partyId)) {
    return c.json({
      success: false,
      message: "Invalid partyId hash provided."
    });
  }

  let missing = 0;
  const roomResponse = Object.keys(world.rooms).reduce((res: Array<Room>, roomId) => {
    const room = world.rooms[roomId];

    if (room[partyId]) {
      if (!room[partyId].partyExclusive || room[partyId].partyExclusive.includes(partyId)) {
        res.push(room[partyId]);
      } else {
        missing++;
      }
    } else {
      if (!room.default.partyExclusive || room.default.partyExclusive.includes(partyId)) {
        res.push(room.default);
      } else {
        missing++;
      }
    }
    return res;
  }, []);

  if (missing == Object.keys(world.rooms).length) {
    return c.json({
      success: false,
      message: "No rooms were fetched while indexxing using the specified partyId hash."
    });
  }

  const res = roomResponse.filter((room) => room != null);
  if (c.req.query('debug')) {
    const roomNames = res.map((room) => room.name);
    return c.json({
      parties: parties,
      data: roomNames
    });
  }
  
  return c.json({
    parties: parties,
    data: res
  });
});

const handler = io.handler(async (req) => {
  return await app.fetch(req);
});

await serve(handler, { port: 3257 });