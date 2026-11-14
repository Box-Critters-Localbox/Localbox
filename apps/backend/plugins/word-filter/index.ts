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

import type { Plugin } from "@/src/plugins";

const plugin: Plugin = (api) => {
  const { words, action } = api.config({
    words: ["damn", "crap", "shit", "fuck", "bitch"],
    action: "censor" as "censor" | "block",
  });
  if (words.length === 0) return;

  const escaped = words.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const pattern = new RegExp(`\\b(?:${escaped.join("|")})\\b`, "gi");

  api.on("nickname", ({ nickname }) => {
    if (nickname.replace(/[_\d]+/g, " ").search(pattern) === -1) return;
    return { reason: "That nickname isn't allowed." };
  });

  api.on("message", (session) => {
    if (session.text.search(pattern) === -1) return;

    if (action === "block") {
      api.alert(session, "Your message was not sent because of its language.");
      return false;
    }
    return { text: session.text.replace(pattern, (match) => "*".repeat(match.length)) };
  });
};

export default plugin;
