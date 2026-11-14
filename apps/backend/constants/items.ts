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

// Source: https://box-critters.fandom.com/wiki/Shop and /wiki/Featured_Item

// [start date, free itemId]; each item is free until the next entry starts
const FEATURED: Array<[string, string]> = [
  ["2019-12-30", "ski_suit_blue"],
  ["2020-01-06", "stripe_red_white"],
  ["2020-01-13", "scarf_purple"],
  ["2020-01-20", "ski_helmet_blue"],
  ["2020-01-27", "sweater_orange"],
  ["2020-02-03", "football_jersey_red"],
  ["2020-02-10", "blockhead"],
  ["2020-02-17", "hoodie_purple"],
  ["2020-02-24", "hotdog"],
  ["2020-03-02", "tactical_headset"],
  ["2020-03-09", "hawaii_blue"],
  ["2020-03-16", "traffic_cone"],
  ["2020-03-23", "toque_orange"],
  ["2020-03-30", "ringmaster_suit_red"],
  ["2020-04-06", "ringmaster_hat_black"],
  ["2020-04-13", "fuzzy_body_yellow"],
  ["2020-04-20", "raincoat_yellow"],
  ["2020-04-27", "rainhat_yellow"],
  ["2020-05-03", "flight_helmet_red"],
  ["2020-05-11", "doll_dress_white"],
  ["2020-05-18", "grass_green"],
  ["2020-05-25", "pirate_crew_blue"],
  ["2020-06-01", "clown_wig"],
  ["2020-06-08", "clown_suit_red"],
  ["2020-06-15", "doctor_coat_white"],
  ["2020-06-22", "plaid_blue"],
  ["2020-06-28", "pirate_hat_pink"],
  ["2020-07-05", "potato_brown"],
  ["2020-07-12", "pirate_bandana_red"],
  ["2020-07-19", "wooden_barrel"],
  ["2020-07-26", "pirate_hat_hook"],
  ["2020-08-03", "swimsuit_green"],
  ["2020-08-10", "bandana_pink"],
  ["2020-08-17", "robot_head"],
  ["2020-08-23", "space_helmet"],
  ["2020-08-30", "school_pack_blue"],
  ["2020-09-06", "school_pack_pink"],
  ["2020-09-14", "sun_green"],
  ["2020-09-21", "rainhat_red"],
  ["2020-09-28", "hazmat_hood"],
  ["2020-10-05", "hero_mask_blue"],
  ["2020-10-14", "hero_mask_pink"],
  ["2020-10-19", "witch_hat_black"],
  ["2020-10-26", "scarecrow_hat"],
  ["2020-11-02", "super_girl_suit"],
  ["2020-11-10", "beard3_black"],
  ["2020-11-16", "pirate_bandana_blue"],
  ["2020-11-23", "turkey"],
  ["2020-11-30", "wizard_blizzard"], // wiki: Blizzard Wizard Hat with Hair (not in items.json)
  ["2020-12-07", "tacky_red"],
  ["2020-12-14", "bulb_blue"],
  ["2020-12-22", "winter_dress_red"],
  ["2020-12-28", "tophat_black"],
  ["2021-01-11", "super_cape_red"],
];

/*
[itemId, cost, available from, available until (exclusive)]
Wiki items missing from items.json are left out of this list:
   Blizzard Wizard Coat (2020-11-30), Red Neck Bandana (2020-11-30),
   Red and White Goggles (2020-12-22), Blizzard Wizard Hat with Hair (2020-11-30, see FEATURED)
The wiki lists the "2021-01-05" group as "January 5, 2020"; treated as 2021.
"Still available" rows (2020-12-28 group) are capped at 2021-01-12 so they don't last all year.
If a date has no 2020 stock (the shop launched 2020-06-14), it falls back to the launch stock.
*/
const COLLECTION: Array<[string, number, string, string]> = [
  ["beard1_red", 20, "2020-06-14", "2020-06-18"],
  ["pirate_crew_green", 200, "2020-06-14", "2020-06-28"],
  ["pirate_bandana_pink", 100, "2020-06-14", "2020-06-28"],
  ["backpack_green", 1000, "2020-06-14", "2020-06-28"],
  ["fedora_black", 50, "2020-06-14", "2020-06-22"],
  ["plaid_pink", 400, "2020-06-14", "2020-06-22"],
  ["beard2_red", 20, "2020-06-18", "2020-06-22"],
  ["army_helmet_green", 400, "2020-06-22", "2020-07-05"],
  ["goggles_orange", 50, "2020-06-22", "2020-07-05"],
  ["pirate_dress_tan", 100, "2020-06-22", "2020-07-05"],
  ["shark_blue", 400, "2020-06-28", "2020-07-12"],
  ["pirate_vest_white", 100, "2020-06-28", "2020-07-12"],
  ["super_cape_pink", 50, "2020-06-28", "2020-07-12"],
  ["pirate_capt_red", 100, "2020-07-05", "2020-07-19"],
  ["mermaid_blue", 100, "2020-07-05", "2020-07-19"],
  ["beard3_brown", 20, "2020-07-05", "2020-07-19"],
  ["mermaid_hair_pink", 20, "2020-07-12", "2020-07-26"],
  ["pirate_crew_red", 200, "2020-07-12", "2020-07-26"],
  ["super_cape_blue", 50, "2020-07-12", "2020-07-26"],
  ["goggles_blue", 20, "2020-07-19", "2020-08-03"],
  ["tshirt_orange", 50, "2020-07-19", "2020-08-03"],
  ["pirate_hair_pink", 100, "2020-07-19", "2020-08-03"],
  ["water_wings_blue", 20, "2020-07-26", "2020-08-10"],
  ["lifeguard_suit", 100, "2020-07-26", "2020-08-10"],
  ["straw_sun_hat", 40, "2020-07-26", "2020-08-10"],
  ["trunks_red", 20, "2020-08-03", "2020-08-17"],
  ["trunks_yellow", 20, "2020-08-03", "2020-08-17"],
  ["swimsuit_pink", 20, "2020-08-03", "2020-08-17"],
  ["box_helmet", 20, "2020-08-10", "2020-08-23"],
  ["space_shirt_red", 50, "2020-08-10", "2020-08-23"],
  ["porkpie_straw", 20, "2020-08-10", "2020-08-23"],
  ["robot_body", 100, "2020-08-17", "2020-08-30"],
  ["trunks_blue", 20, "2020-08-17", "2020-08-30"],
  ["pirate_bandana_purple", 100, "2020-08-17", "2020-08-30"],
  ["space_suit", 100, "2020-08-23", "2020-09-06"],
  ["beard3_red", 20, "2020-08-23", "2020-09-06"],
  ["glasses_blue", 20, "2020-08-23", "2020-09-06"],
  ["climb_helmet_green", 40, "2020-08-30", "2020-09-14"],
  ["pirate_hair_purple", 100, "2020-08-30", "2020-09-14"],
  ["trunks_purple", 20, "2020-08-30", "2020-09-14"],
  ["bandana_yellow", 100, "2020-09-06", "2020-09-21"],
  ["peacoat_red", 100, "2020-09-06", "2020-09-21"],
  ["beard2_black", 20, "2020-09-06", "2020-09-21"],
  ["plaid_pink", 400, "2020-09-14", "2020-09-28"],
  ["ballcap_orange", 40, "2020-09-14", "2020-09-28"],
  ["goggles_green", 20, "2020-09-14", "2020-09-28"],
  ["sweater_pink", 20, "2020-09-21", "2020-10-05"],
  ["raincoat_blue", 50, "2020-09-21", "2020-10-05"],
  ["shark_blue", 400, "2020-09-21", "2020-10-05"],
  ["hazmat_suit", 100, "2020-09-28", "2020-10-14"],
  ["moustache_black", 20, "2020-09-28", "2020-10-14"],
  ["pirate_crew_red", 200, "2020-09-28", "2020-10-14"],
  ["hero_suit_blue", 80, "2020-10-05", "2020-10-19"],
  ["mummy_body", 40, "2020-10-05", "2020-10-19"],
  ["box_helmet", 20, "2020-10-05", "2020-10-19"],
  ["hero_suit_pink", 80, "2020-10-14", "2020-10-26"],
  ["mummy_head", 20, "2020-10-14", "2020-10-26"],
  ["army_helmet_green", 200, "2020-10-14", "2020-10-26"],
  ["witch_dress_black", 40, "2020-10-19", "2020-11-02"],
  ["chocolate_bar", 20, "2020-10-19", "2020-11-02"],
  ["gelatinous_green", 200, "2020-10-19", "2020-11-02"],
  ["scarecrow", 20, "2020-10-26", "2020-11-10"],
  ["candy_corn", 40, "2020-10-26", "2020-11-10"],
  ["plaid_pink", 200, "2020-10-26", "2020-11-10"],
  ["hero_suit_black", 80, "2020-11-02", "2020-11-16"],
  ["hero_cape_black", 50, "2020-11-02", "2020-11-16"],
  ["pirate_hair_pink", 100, "2020-11-02", "2020-11-16"],
  ["hero_cape_blue", 50, "2020-11-10", "2020-11-23"],
  ["pirate_dress_green", 100, "2020-11-10", "2020-11-23"],
  ["goggles_orange", 50, "2020-11-10", "2020-11-23"],
  ["pirate_capt_red", 100, "2020-11-16", "2020-11-30"],
  ["glasses_red", 20, "2020-11-16", "2020-11-30"],
  ["puffy_blue", 40, "2020-11-16", "2020-11-30"],
  ["pilgram_suit", 100, "2020-11-23", "2020-12-07"],
  ["pilgram_dress", 100, "2020-11-23", "2020-12-07"],
  ["pilgram_hat", 100, "2020-11-23", "2020-12-07"],
  ["hazmat_suit", 100, "2020-11-30", "2020-12-13"],
  ["reindeer_head", 80, "2020-12-07", "2020-12-22"],
  ["winter_dress", 100, "2020-12-07", "2020-12-22"],
  ["ornament_pink", 20, "2020-12-07", "2020-12-22"],
  ["reindeer_body", 80, "2020-12-13", "2020-12-28"],
  ["goggles_white", 20, "2020-12-13", "2020-12-28"],
  ["ushanka", 120, "2020-12-13", "2020-12-28"],
  ["onesie_plaid_red", 80, "2020-12-22", "2021-01-05"],
  ["bulb_pink", 20, "2020-12-22", "2021-01-05"],
  ["sleeping_red", 20, "2020-12-28", "2021-01-12"],
  ["tuxedo_black", 120, "2020-12-28", "2021-01-12"],
  ["backpack_green", 1000, "2020-12-28", "2021-01-12"],
  ["beard2_brown", 20, "2021-01-05", "2021-01-12"],
  ["goggles_pink", 20, "2021-01-05", "2021-01-12"],
  ["scout_uniform", 100, "2021-01-05", "2021-01-12"],
];

const LAST_ITEM_COST = 20;

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

export function getShop(now: Date = new Date()) {
  const mmdd = isoDate(now).slice(5);
  const d2020 = mmdd == "02-29" ? "2020-02-29" : `2020-${mmdd}`;
  const d2021 = mmdd == "02-29" ? "2021-02-28" : `2021-${mmdd}`;

  let current = 0;
  FEATURED.forEach(([start], i) => {
    if (start <= d2020) current = i;
  });

  const lastIndex = (current - 1 + FEATURED.length - 1) % (FEATURED.length - 1);
  const nextIndex = (current + 1) % FEATURED.length;

  const inWindow = (d: string) =>
    COLLECTION.filter(([, , from, until]) => from <= d && d < until);
  let collection = inWindow(d2020);
  if (collection.length == 0) collection = inWindow(d2021);
  if (collection.length == 0) collection = inWindow("2020-06-14");

  const seen = new Set<string>();
  return {
    lastItem: { itemId: FEATURED[lastIndex][1], cost: LAST_ITEM_COST },
    freeItem: { itemId: FEATURED[current][1], cost: 0 },
    nextItem: { itemId: FEATURED[nextIndex][1], cost: 0 },
    collection: collection
      .filter(([itemId]) => !seen.has(itemId) && seen.add(itemId))
      .map(([itemId, cost]) => ({ itemId, cost })),
  };
}

export const codes = {
  rocketsnail: ["viking", "rocket_red"],
  andybulletin: "propeller",
  cute: "toque_pink",
  oommgames: "space_red",
  boxcritters3d: ["3d_white", "3d_black"],
  goodnight: "sleeping",
  madeincanada: "toque_white",
  thekeeper: "party_green",
  bunnyhug: "hoodie_blue",
  greenplumber: "ballcap_green",
  duckhunter: "float_pink",
  piratepack: "pirate_patch",
  pickle: "pickle",
  oscarproductions: "guitar_blue",
  livestream: "headphones_black",
  creative: "headphones_black",
  fun: "propeller_pink",
  marco: "keytar_red",
  snowball: "hoodie_white",
  critbits: "ballcap_pink",
  esporte: "kit_yellow",
  squeeze: "hoodie_orange",
  imagination: "box_brown",
  sparkle: "propeller_silver",
  adventure: "snorkel_blue",
  tamago: "sun_square",
  redcross: "australian_hat",
  discordcritterspt: "headphones_green",
  scarletraven: "wings_black",
  boxcritterswiki: "paperhat_colour",
  wikicritters: "brain_green",
  boxcrittersguild: "cardboard_sword_silver",
  staysafe: "doctor_mask_blue",
  glitter: "pirate_capt_pink",
};

export const throwback = [
  "goggles_black",
  "pot",
  "sombrero_yellow",
  "cone",
  "toque_purple",
  "sun_orange",
  "pirate_capt_black",
  "lifejacket_red",
  "ballcap_black",
  "super_cape_red",
  "tshirt_white",
  "lei_red",
  "ballcap_blue",
  "viking_blue",
  "overalls_orange",
  "bunny_blue",
  "messenger_brown",
  "plaid_black",
  "tinfoil_hat",
  "monk",
  "pirate_hat_black",
  "hawaii_orange",
  "space_black",
  "traffic_cone",
  "grass_yellow",
  "ushanka",
  "bandana_purple",
  "ski_suit_blue",
  "hotdog",
  "space_blue",
  "sweater_orange",
  "tactical_headset",
  "ballcap_yellow",
  "ringmaster_suit_red",
  "flight_helmet_red",
  "rainhat_yellow",
  "raincoat_yellow",
  "ballcap_red",
  "ballerina_pink",
  "hawaii_blue",
  "stripe_red_white",
  "grass_green",
  "plaid_blue",
  "toque_orange",
  "school_pack_orange",
  "pirate_crew_blue",
  "ringmaster_hat_black",
  "super_mask_black",
  "pirate_hat_pink",
  "rainhat_red",
  "tophat_black",
  "scarf_red",
  "skeleton_body",
  "dracula_cloak",
  "pumpkin",
  "hotdog",
  "beard3_black",
  "scarf_purple",
  "puffy_red",
  "blockhead",
  "hoodie_purple",
  "winter_dress_red",
  "bulb_blue",
  "tacky_red",
  "pirate_bandana_red",
];

export const eventCodes = {
  christmas2019: {
    jinglebells: "elf_hat_green",
    winter: "winter_dress",
    joy: "bulb_yellow",
    rudolph: "reindeer_head",
    elf: "elf_suit_green",
    cheer: "bulb_green",
    glow: "bulb_red",
    rednose: "reindeer_body",
    blizzard: "wizard_blizzard",
    family: "ornament_red",
    shine: "angel_halo",
    peace: "angel_wings",
    jolly: "santa_beard",
    merry: "santa_hat",
    christmas: "santa_suit",
    boxingday: "onsie_plaid_red",
    warm: "sleeping_red",
    tacky: "tacky_green",
    snow: "goggles_white",
    beautiful: "winter_dress_red",
    newyear: "tuxedo_black",
    "2020": "tophat_black",
  },
};
