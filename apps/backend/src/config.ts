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

import { existsSync, readFileSync } from "fs";
import { dirname, join } from "path";
import { z } from "zod";

const rateLimitRule = z.object({
  limit: z.number().int().min(1),
  windowMs: z.number().int().min(1),
}).strict();

export type RateLimitRule = z.infer<typeof rateLimitRule>;

/** Events without their own rule share the "default" rule */
export const defaultSocketRateLimits: Record<string, RateLimitRule> = {
  default: { limit: 30, windowMs: 5000 },
  message: { limit: 5, windowMs: 5000 },
  emote: { limit: 5, windowMs: 5000 },
  moveTo: { limit: 10, windowMs: 1000 },
  joinRoom: { limit: 5, windowMs: 5000 },
  switchParty: { limit: 5, windowMs: 10000 },
  trigger: { limit: 10, windowMs: 5000 },
  code: { limit: 10, windowMs: 10000 },
  buyItem: { limit: 10, windowMs: 10000 },
  updateGear: { limit: 10, windowMs: 5000 },
  addIgnore: { limit: 10, windowMs: 10000 },
  attack: { limit: 10, windowMs: 5000 },
};

export const configSchema = z.object({
  port: z.number().int().min(1).max(65535).default(3257),
  startingCoins: z.number().int().min(0).default(150),
  socketRateLimits: z.record(rateLimitRule).default({}).transform((
    overrides,
  ) => ({ ...defaultSocketRateLimits, ...overrides })),
  maxViolations: z.number().int().min(1).default(100),
}).strict();

export type Config = z.infer<typeof configSchema>;

const CONFIG_PATH = process.env.LOCALBOX_CONFIG ?? join(
  process.env.EXECUTABLE === "true"
    ? dirname(process.execPath)
    : join(import.meta.dir, ".."),
  "localbox.config.json",
);

function loadConfig(): Config {
  if (!existsSync(CONFIG_PATH)) return configSchema.parse({});

  try {
    return configSchema.parse(JSON.parse(readFileSync(CONFIG_PATH, "utf8")));
  } catch (error) {
    const reason = error instanceof z.ZodError
      ? error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("\n  ")
      : (error as Error).message;
    console.error(`Invalid config file ${CONFIG_PATH}:\n  ${reason}`);
    process.exit(1);
  }
}

export const config = loadConfig();
