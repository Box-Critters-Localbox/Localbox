import { z } from "zod";
import parties from "../constants/parties.json" with { type: "json" };

/*
  LOGIN API
*/
export const login = z.object({
  nickname: z.string().nonempty().max(25),
  critterId: z.enum([
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
  ]).default("hamster"),
  partyId: z.enum([
    ...Object.keys(parties) as [string, ...string[]],
    "today2019",
    "today2020",
    "today2021"
  ]).default("default"),
  persistent: z.boolean().default(false),
  mods: z.array(z.enum(["roomExits"])).default([]),
}).strict(); // Strict to disallow extra keys
