import { $ } from "bun";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const MIRROR_REPO = "Box-Critters-Localbox/Localbox";
const MIRROR_URL = `https://github.com/${MIRROR_REPO}.git`;
const MIRROR_BRANCH = "main";
export const EXCLUDED_PATHS = ["apps/frontend"];
const HEADER_EXTENSIONS = [".ts", ".tsx", ".mts", ".cts"];

const HEADER = `/*
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
`;

export const root = (await $`git rev-parse --show-toplevel`.text()).trim();

export async function releaseNotes(tag: string, excludedPaths: string[] = []): Promise<string> {
  const previous = await $`git -C ${root} describe --tags --abbrev=0 --exclude ${tag} HEAD`
    .nothrow()
    .quiet();
  if (previous.exitCode !== 0) return "First tagged release.";

  const pathspec = ["--", ".", ...excludedPaths.map((path) => `:(exclude)${path}`)];
  const log = await $`git -C ${root} log ${`${previous.text().trim()}..HEAD`} --format=%s ${pathspec}`.text();
  const subjects = log
    .split("\n")
    .filter((subject) => subject && !/^v\d+\.\d+\.\d+$/.test(subject));
  return subjects.length ? subjects.map((subject) => `- ${subject}`).join("\n") : "No changes.";
}

async function assertNoExcludedContent(mirrorDir: string) {
  const staged = (await $`git -C ${mirrorDir} ls-files`.text()).split("\n").filter(Boolean);
  const leaked = staged.filter((file) =>
    EXCLUDED_PATHS.some((path) => file === path || file.startsWith(`${path}/`)),
  );
  if (leaked.length) {
    throw new Error(
      `Refusing to mirror: ${leaked.length} excluded file(s) are staged (e.g. ${leaked.slice(0, 3).join(", ")}).`,
    );
  }

  const lockfile = Bun.file(join(mirrorDir, "bun.lock"));
  if (await lockfile.exists()) {
    const lock = await lockfile.text();
    const referenced = EXCLUDED_PATHS.filter((path) => lock.includes(`"${path}"`));
    if (referenced.length) {
      throw new Error(`Refusing to mirror: bun.lock still references ${referenced.join(", ")}.`);
    }
  }
}

export async function mirror({ version, dryRun = false }: { version?: string; dryRun?: boolean } = {}) {
  version ??= JSON.parse(await $`git -C ${root} show HEAD:package.json`.text()).version as string;
  const tag = `v${version}`;

  if ((await $`git ls-remote --tags ${MIRROR_URL} ${`refs/tags/${tag}`}`.text()).trim()) {
    console.log(`${tag} is already published to ${MIRROR_REPO}.`);
    return;
  }

  const sha = (await $`git -C ${root} rev-parse --short HEAD`.text()).trim();
  const workDir = await mkdtemp(join(tmpdir(), "localbox-mirror-"));
  const mirrorDir = join(workDir, "mirror");

  try {
    await $`git clone --quiet --branch ${MIRROR_BRANCH} ${MIRROR_URL} ${mirrorDir}`;

    for (const entry of await readdir(mirrorDir)) {
      if (entry !== ".git") await rm(join(mirrorDir, entry), { recursive: true, force: true });
    }
    const archivePathspec = [".", ...EXCLUDED_PATHS.map((path) => `:(exclude)${path}`)];
    await $`git -C ${root} archive --format=tar HEAD -- ${archivePathspec} | tar -x -C ${mirrorDir}`;
    for (const path of EXCLUDED_PATHS) {
      await rm(join(mirrorDir, path), { recursive: true, force: true });
    }

    let headered = 0;
    for (const path of await readdir(mirrorDir, { recursive: true })) {
      if (path.startsWith(".git/") || !HEADER_EXTENSIONS.some((ext) => path.endsWith(ext))) continue;
      const file = Bun.file(join(mirrorDir, path));
      const source = await file.text();
      if (source.includes("GNU Affero General Public License")) continue;
      const shebang = source.match(/^#!.*\n/)?.[0] ?? "";
      await Bun.write(file, shebang + HEADER + "\n" + source.slice(shebang.length));
      headered++;
    }
    console.log(`Added license header to ${headered} TypeScript files.`);

    await $`bun install --lockfile-only --silent`.cwd(mirrorDir);

    await $`git -C ${mirrorDir} add --all`;
    await assertNoExcludedContent(mirrorDir);
    const notes = await releaseNotes(tag, EXCLUDED_PATHS);

    if (dryRun) {
      console.log(await $`git -C ${mirrorDir} diff --cached --stat`.text());
      console.log(`Dry run: would publish ${tag} to ${MIRROR_REPO} with these notes:\n${notes}`);
      return;
    }

    await $`git -C ${mirrorDir} commit --quiet --allow-empty -m ${tag} -m ${`Mirrored from ${sha}.`}`;
    await $`git -C ${mirrorDir} tag -a ${tag} -m ${tag}`;
    await $`git -C ${mirrorDir} push --quiet --atomic origin ${MIRROR_BRANCH} ${tag}`;
    await $`gh release create ${tag} --repo ${MIRROR_REPO} --title ${tag} --notes ${notes} --verify-tag`;
    console.log(`Published ${tag} to ${MIRROR_REPO}.`);
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

if (import.meta.main) {
  await mirror({ dryRun: process.argv.includes("--dry-run") });
}
