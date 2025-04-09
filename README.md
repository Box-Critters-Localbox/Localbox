# Localbox

Reopen the dusty box of the world of Box Critters! This repository features a
Typescript server emulator, **built using Deno**. The version of the game the
server is built around is **client version 161**.

This repository appears empty because it is a fork of my private repository so
that the assets didn't get included in the public version of the repository.

_project start: late November 2024_

## Assets

The assets for the game are not included in this repository, since I've been
told that Rocketsnail has taken down GitHub repositories for hosting the assets.
Though, I find it ironic since the modding community has been allowed to freely
host asset archives [here](https://github.com/boxcrittersmods/BCArchive) for 5
years at this point. As far as I can see, Localbox has the most comprehensive
archive of Box Critters assets, compiling several sources & custom spritesheet
JSON for spritesheet mis-matches.

### Archive Statistics

Below is a break down of the archive compilation, to be consider archived the
spritesheet has to be archived (spritesheet JSON is not taken into
consideration, as it is pretty easy to custom make). To get the assets, feel
free message me on Discord: @index.lua

> _Note:_ I do plan on manually cropping some rooms to make custom spritesheets,
> but when I do those will be marked as custom and not legit.

- **6/7** full-time rooms archived
  - Full-time rooms are rooms that were always available, no matter the party.
  - Missing: [_Jungle_](https://box-critters.fandom.com/wiki/Jungle)

- **6/10** party-exclusive rooms archived
  - Party-exclusive rooms are rooms that were only available during specific
    parties.
  - Missing:
    [_Holiday Cliff_](https://box-critters.fandom.com/wiki/Holiday_Cliff),
    [_Holiday Forest_](https://box-critters.fandom.com/wiki/Holiday_Forest),
    [_CritterCon Hall_](https://box-critters.fandom.com/wiki/Critter_Con_Hall),
    [_Box Realm_](https://box-critters.fandom.com/wiki/Box_Realm)

- **465/590** released items archived

- **12/12** critters archived

- **2/2** mini-games archived
  - This count excludes _Critter Ball_, because that requires an entirely
    separate backend. If you want to relive _Critter Ball_, check out
    [FarawayDrip30's Critter Ball server](https://farawaydrip30.itch.io/critterball-server).

## Party Switcher

A custom party switcher has been implemented, you can change the party on the
log-in page, or using the `/party [ID]` command in-game. For a breakdown of
party room recreation progress, go [here](Events.md).

## Development

### CLI

> Installation

```bash
deno install
```

> Serving

```bash
deno run start
> Listening on http://localhost:3257/
```

> Building to an executable (shorthand invocation of `deno compile` using
> already-set flags & config)

```bash
deno run build
> If the command is a success, a "Localbox" executable will appear in the project directory.
```

### APIs

The game has 4 APIs for debugging or for use by the game client:

- (GET) `/api/server/players`
  - This API returns information on the player(s) in-game, if any.

- (GET) `/api/server/rooms`
  - This API returns almost-identical information as the `/api/client/rooms`
    API, however it returns information on all hashes of all rooms with no
    required party ID URL parameter.

- (POST) `/api/client/login`
  - This API takes in all the information provided by the user on log-in and
    generates a JWT for that session.

- (GET) `/api/client/rooms?partyId=`
  - This API returns information on the parties the game supports, and depending
    on the party ID provided in the URL, information for each room that party
    changes in some way. If the party does not change the room in any way, the
    default version of that room will be returned. All the data is gathered by
    the server reading the `/public/media/rooms/` directory of the game - and
    cached for future requests.

## Contributors

- [jonastisell](https://github.com/jonastisell) - spritesheet extraction help &
  moral support
- [Boo0](https://github.com/Boo6447) - provided archived assets of party room
  versions & moral support
- [@boxcrittersmods/BCArchive](https://github.com/boxcrittersmods/BCArchive) -
  provided a lot of archived assets of early rooms
