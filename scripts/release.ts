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

import { $ } from "bun";
import { join } from "node:path";
import { mirror, releaseNotes, root } from "./mirror.ts";

const REPO = "Box-Critters-Localbox/DeveloperBox";
const BRANCH = "main";
const VERSIONED_PACKAGES = ["package.json", "apps/backend/package.json"];

const dryRun = process.argv.includes("--dry-run");
const bump = process.argv.slice(2).find((arg) => !arg.startsWith("--"));

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function parse(version: string) {
  return version.split(".").map(Number) as [number, number, number];
}

function nextVersion(current: string, bump = ""): string {
  const [major, minor, patch] = parse(current);
  if (bump === "major") return `${major + 1}.0.0`;
  if (bump === "minor") return `${major}.${minor + 1}.0`;
  if (bump === "patch") return `${major}.${minor}.${patch + 1}`;
  if (/^v?\d+\.\d+\.\d+$/.test(bump)) return bump.replace(/^v/, "");
  fail("Usage: bun run release <major|minor|patch|X.Y.Z> [--dry-run]");
}

const current = (await Bun.file(join(root, "package.json")).json()).version as string;
const version = nextVersion(current, bump);
const tag = `v${version}`;

const [next, previous] = [parse(version), parse(current)];
const changed = next.findIndex((part, i) => part !== previous[i]);
if (changed === -1 || next[changed]! < previous[changed]!) {
  fail(`${tag} is not newer than the current version v${current}.`);
}

if ((await $`git -C ${root} branch --show-current`.text()).trim() !== BRANCH) {
  fail(`Releases are cut from ${BRANCH}.`);
}
if ((await $`git -C ${root} status --porcelain`.text()).trim()) {
  fail("Commit or stash your changes first.");
}
await $`git -C ${root} fetch --quiet origin ${BRANCH} --tags`;
if ((await $`git -C ${root} rev-list --count ${`HEAD..origin/${BRANCH}`}`.text()).trim() !== "0") {
  fail(`${BRANCH} is behind origin/${BRANCH}; pull first.`);
}
if ((await $`git -C ${root} tag --list ${tag}`.text()).trim()) {
  fail(`${tag} already exists.`);
}

const notes = await releaseNotes(tag);

if (dryRun) {
  console.log(`Dry run: would release ${tag} (from v${current}) to ${REPO} with these notes:\n${notes}\n`);
  await mirror({ version, dryRun });
  process.exit(0);
}

for (const path of VERSIONED_PACKAGES) {
  const file = Bun.file(join(root, path));
  await Bun.write(file, (await file.text()).replace(/"version":\s*"[^"]*"/, `"version": "${version}"`));
}
await $`bun install --lockfile-only --silent`.cwd(root);

await $`git -C ${root} add ${VERSIONED_PACKAGES} bun.lock`;
await $`git -C ${root} commit --quiet -m ${tag}`;
await $`git -C ${root} tag -a ${tag} -m ${tag}`;
await $`git -C ${root} push --quiet --atomic origin ${BRANCH} ${tag}`;
await $`gh release create ${tag} --repo ${REPO} --title ${tag} --notes ${notes} --verify-tag`;
console.log(`Released ${tag} to ${REPO}.`);

try {
  await mirror({ version });
} catch (error) {
  console.error(`${tag} is released here, but mirroring failed. Fix the cause and run \`bun run mirror\`.`);
  throw error;
}
