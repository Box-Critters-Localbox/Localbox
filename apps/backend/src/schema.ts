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

import { z } from "zod";
import parties from "../constants/parties.json" with { type: "json" };

const critterId = z.enum([
  "hamster",
  "beaver",
  "lizard",
  "raccoon",
  "penguin",
  "snail",
  "snow_greeter",
  "snowkeeper",
  "snowgirl",
  "snow_patrol",
  "snowgrandma",
  "alpha_hamster",
]);

const partyId = z.enum([
  ...Object.keys(parties) as [string, ...string[]],
  "today2019",
  "today2020",
  "today2021",
]);

const mods = z.array(z.enum(["roomExits"]));

/*
  LOGIN API
*/
export const login = z.object({
  nickname: z.string().trim().min(1, "Enter your nickname.").max(25),
  password: z.string().min(1, "Enter your password.").max(128),
  partyId: partyId.default("default"),
  mods: mods.default([]),
}).strict(); // Strict to disallow extra keys

/*
  SIGNUP API
*/
export const signup = z.object({
  nickname: z.string()
    .trim()
    .min(3, "The nickname must be at least 3 characters long.")
    .max(25, "The nickname must be less than 25 characters long.")
    .regex(
      /^[A-Za-z0-9_]+(?: [A-Za-z0-9_]+)*$/,
      "Nicknames can only use letters, numbers, underscores and single spaces.",
    ),
  password: z.string()
    .min(8, "The password must be at least 8 characters long.")
    .max(128, "The password must be less than 128 characters long."),
  critterId: critterId.default("hamster"),
  mods: mods.default([]),
}).strict();

/*
  SOCKET LOGIN TICKET
*/
export const ticket = z.object({
  sub: z.string().uuid(),
  partyId: partyId,
  mods: mods,
});
