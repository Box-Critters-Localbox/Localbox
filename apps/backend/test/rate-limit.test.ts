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

import { RateLimiter } from "../src/rate-limit";

describe("RateLimiter", () => {
  test("allows hits up to the limit and rejects the rest", () => {
    const limiter = new RateLimiter();
    const results = Array.from({ length: 5 }, () => limiter.hit("a", 3, 1000, 0));
    expect(results).toEqual([true, true, true, false, false]);
  });

  test("starts a new window once the old one expires", () => {
    const limiter = new RateLimiter();
    for (let i = 0; i < 4; i++) limiter.hit("a", 3, 1000, 0);

    expect(limiter.hit("a", 3, 1000, 999)).toBe(false);
    expect(limiter.hit("a", 3, 1000, 1000)).toBe(true);
  });

  test("tracks keys independently", () => {
    const limiter = new RateLimiter();
    limiter.hit("a", 1, 1000, 0);

    expect(limiter.hit("a", 1, 1000, 0)).toBe(false);
    expect(limiter.hit("b", 1, 1000, 0)).toBe(true);
  });

  test("sweep forgets expired windows", () => {
    const limiter = new RateLimiter();
    limiter.hit("a", 1, 1000, 0);
    limiter.hit("a", 1, 1000, 0);
    limiter.sweep(1000);

    expect(limiter.hit("a", 1, 1000, 1000)).toBe(true);
  });
});
