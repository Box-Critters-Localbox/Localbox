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

import { describe, expect, test } from "bun:test";

import { configSchema, defaultSocketRateLimits } from "../src/config";

describe("configSchema", () => {
  test("fills in defaults for an empty config", () => {
    const config = configSchema.parse({});

    expect(config.port).toBe(3257);
    expect(config.startingCoins).toBe(150);
    expect(config.maxViolations).toBe(100);
    expect(config.socketRateLimits).toEqual(defaultSocketRateLimits);
  });

  test("overrides only the rate limits that are listed", () => {
    const config = configSchema.parse({
      socketRateLimits: { message: { limit: 1, windowMs: 100 } },
    });

    expect(config.socketRateLimits.message).toEqual({ limit: 1, windowMs: 100 });
    expect(config.socketRateLimits.emote).toEqual(defaultSocketRateLimits.emote);
  });

  test("rejects unknown keys", () => {
    expect(configSchema.safeParse({ prot: 1 }).success).toBe(false);
  });

  test.each([
    { port: 0 },
    { port: 70000 },
    { port: 1.5 },
    { startingCoins: -1 },
    { maxViolations: 0 },
    { socketRateLimits: { message: { limit: 0, windowMs: 1000 } } },
    { socketRateLimits: { message: { limit: 5 } } },
  ])("rejects invalid values: %j", (config) => {
    expect(configSchema.safeParse(config).success).toBe(false);
  });
});
