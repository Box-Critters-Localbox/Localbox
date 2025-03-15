import { Image } from 'https://deno.land/x/imagescript@1.3.0/mod.ts';
import chalk from "https://deno.land/x/chalk_deno@v4.1.1-deno/source/index.js"
import { join } from "https://deno.land/std@0.224.0/path/mod.ts";

import { rooms, spawnRoom } from "./constants/world.ts";
import { Room, LocalPlayer, PlayerCrumb } from "./types.ts";

/** Condenses the local player variable into data that is sufficient enough for other clients */
export function makeCrumb(player: LocalPlayer, roomId: string): PlayerCrumb {
    return {
        i: player.playerId,
        n: player.nickname,
        c: player.critterId,
        x: player.x,
        y: player.y,
        r: player.rotation,
        g: player.gear,

        // message & emote
        m: "",
        e: "",

        _roomId: roomId
    }
}

// TODO: use the correct triggers for the active party
export async function getTrigger(player: LocalPlayer, roomId: string, partyId: string) {
    const room = rooms[roomId][partyId];
    if (!room) {
        console.log(chalk.red(`[!] Cannot find room: "${roomId}@${partyId}"!`));
        return;
    }

    try {
        //@ts-ignore: Deno lint
        const treasureBuffer = await Deno.readFile(room.media.treasure?.replace('..','public'));
        const treasure = await Image.decode(treasureBuffer);
        if (!treasure) throw new Error('Missing map server for room "' + roomId + '"!');

        const pixel = treasure.getPixelAt(player.x, player.y);
        const r = (pixel >> 24) & 0xFF, g = (pixel >> 16) & 0xFF, b = (pixel >> 8) & 0xFF;
        const hexCode = ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
        
        const trigger = room.triggers.find((trigger) => trigger.hex == hexCode);
        if (trigger) {
            return trigger.server;
        } else {
            return null;
        }
    } catch(e) {
        console.warn(chalk.red('[!] Caught error while checking for activated trigger.'), e);
    }
}

export function getNewCodeItem(player: LocalPlayer, items: Array<string>) {
    const itemsSet = new Set(player.inventory);
    const available = items.filter(item => !itemsSet.has(item));
    return available.length === 0 ? null : available[Math.floor(Math.random() * available.length)];
}

/**
 * Indexes the /media/rooms directory for all versions of all rooms
 * @returns All versions of every room
 */
export async function indexRoomData() {
    const _roomData: Record<string, Record<string, Room>> = {};

    const basePath = join(Deno.cwd(), 'public', 'media', 'rooms');
    const _rooms = Deno.readDir(basePath);

    for await (const room of _rooms) {
        if (room.isDirectory) {
            _roomData[room.name] = {};
            const roomPath = join(basePath, room.name);
            const versions = Deno.readDir(roomPath);
            for await (const version of versions) {
                if (version.isDirectory) {
                    const versionPath = join(roomPath, version.name, 'data.json');
                    try {
                        const data = await Deno.readTextFile(versionPath);
                        _roomData[room.name][version.name] = JSON.parse(data);
                    } catch(_) { 
                        console.log(chalk.red('[!] "%s@%s" is missing a data.json file'), room.name,  version.name);
                    };
                }
            }
        }
    }

    return _roomData
}

export async function getAccount(nickname?: string) {
    let accounts = [];
    try {
        const data = await Deno.readTextFile('accounts.json');
        accounts = JSON.parse(data);
    } catch (error) {
        if (error instanceof Deno.errors.NotFound) {
            console.log(chalk.gray('Persistent login JSON is missing, using blank JSON array..'));
            accounts = [];
        } else {
            console.log(chalk.red('[!] Failure to fetch persistent login data with nickname: '), nickname);
            throw error;
        };
    }

    if (nickname) {
        const existingAccount = accounts.find((player: { nickname: string }) => player.nickname == nickname);
        if (existingAccount) {
            return {
                all: accounts,
                individual: existingAccount,
            }
        } else {
            return {
                all: accounts,
                individual: null
            }
        }
    } else {
        return accounts;
    }
}

export async function updateAccount(nickname: string, property: string, value: unknown) {
    if (["x", "y", "rotation", "_partyId"].includes(property)) return;
    const accounts = await getAccount(nickname);

    accounts.individual[property] = value;
    await Deno.writeTextFile('accounts.json', JSON.stringify(accounts.all, null, 2));
}

export function trimAccount(player: LocalPlayer) {
    for (const key of [
        "critterId",
        "x",
        "y",
        "rotation",
        "_partyId",
        "_mods"
    ]) {
        delete player[key];
    }
    return player;
}

export function expandAccount(player: LocalPlayer) {
    const defaultPos = rooms[spawnRoom].default;
    player.x = defaultPos.startX;
    player.y = defaultPos.startY;
    player.rotation = defaultPos.startR;
    return player;
}

export function getDirection(x: number, y: number, targetX: number, targetY: number) {
    const a = Math.floor((180 * Math.atan2(targetX - x, y - targetY)) / Math.PI);
    return a < 0 ? a + 360 : a;
}

export async function createAccount(player: LocalPlayer) {
    const accounts = await getAccount();
    accounts.push(trimAccount(player));

    await Deno.writeTextFile('accounts.json', JSON.stringify(accounts, null, 2));
}