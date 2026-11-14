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

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { Hono } from "hono";
import { io as connect, type Socket } from "socket.io-client";

import { engine, io, websocket } from "../src/socket";
import { loadPlugins, runNicknameHooks } from "../src/plugins";
import * as queries from "../src/db/queries";
import * as utils from "../src/utils";

let server: ReturnType<typeof Bun.serve>;
const sockets: Array<Socket> = [];

beforeAll(async () => {
  await loadPlugins(new Hono(), io);
  server = Bun.serve({
    port: 0,
    fetch: (req, srv) => engine.handleRequest(req, srv),
    websocket,
  });
});

afterAll(() => {
  for (const socket of sockets) socket.disconnect();
  server.stop(true);
});

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function next<T>(socket: Socket, event: string, timeoutMs = 2000) {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timed out waiting for "${event}"`)),
      timeoutMs,
    );
    socket.once(event, (data: T) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

async function join(nickname: string) {
  const account = queries.createAccount({ nickname, passwordHash: "unused" });
  const ticket = await utils.createJWT({ partyId: "default", mods: [] }, account.id);

  const socket = connect(`http://localhost:${server.port}`, {
    transports: ["websocket"],
    forceNew: true,
  });
  sockets.push(socket);

  await next(socket, "connect");
  const loggedIn = next(socket, "login");
  socket.emit("login", ticket);
  await loggedIn;
  return socket;
}

describe("plugins", () => {
  test("word filter censors chat for everyone in the room", async () => {
    const [alice, bob] = await Promise.all([join("Alice"), join("Bob")]);

    const bobHears = next<{ m: string }>(bob, "M");
    const aliceHears = next<{ m: string }>(alice, "M");
    alice.emit("message", "well damn it");

    expect((await bobHears).m).toBe("well **** it");
    expect((await aliceHears).m).toBe("well **** it");
  });

  test("nickname hooks reject words from the word filter", async () => {
    expect(await runNicknameHooks("Friendly")).toBeNull();
    expect(await runNicknameHooks("big_damn_hero")).toBeString();
    expect(await runNicknameHooks("Scunthorpe")).toBeNull();
  });

  test("/top lists accounts by coins", async () => {
    const carol = await join("Carol");

    const alert = next<{ text: string }>(carol, "alert");
    carol.emit("code", "top", "");

    const { text } = await alert;
    expect(text).toStartWith("Richest critters");
    expect(text).toContain("Carol: 150");
  });
});

describe("socket rate limiting", () => {
  test("drops events over the limit and keeps the rest", async () => {
    const [sender, listener] = await Promise.all([join("Sender"), join("Listener")]);

    const heard: Array<string> = [];
    listener.on("M", (crumb: { m: string }) => heard.push(crumb.m));

    for (let i = 0; i < 8; i++) sender.emit("message", `hi ${i}`);
    await wait(300);

    expect(heard).toEqual(["hi 0", "hi 1", "hi 2", "hi 3", "hi 4"]);
  });

  test("disconnects a connection that keeps flooding", async () => {
    const flooder = await join("Flooder");

    const disconnected = next(flooder, "disconnect");
    for (let i = 0; i < 200; i++) flooder.emit("beep");

    await disconnected;
    expect(flooder.connected).toBe(false);
  });
});
