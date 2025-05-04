import { z } from "zod";
import parties from "@/constants/parties.json" with { type: "json" };

/*
  LOGIN API
*/
export const login = z.object({
  nickname: z.string()
    .transform((s) => s.trim())
    .pipe(
      z.string()
        .min(3, "The nickname must be at least 3 characters long.")
        .max(25, "The nickname must be less than 25 characters long."),
    ),
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
    "alpha_hamster",
  ]).default("hamster"),
  partyId: z.enum([
    ...Object.keys(parties) as [string, ...string[]],
    "today2019",
    "today2020",
    "today2021",
  ]).default("default"),
  persistent: z.boolean().default(false),
  mods: z.array(z.enum(["roomExits"])).default([]),
}).strict(); // Strict to disallow extra keys
