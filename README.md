# Box Critters Localbox

Reopening the dusty box of the world of Box Critters! This is a Typescript server emulator using Deno.

## Party Switcher

A custom party switcher has been implemented, you can change the party on the log-in page, or using the `/party [ID]` command in-game.  For a breakdown of party room recreation progress, go [here](Events.md).

## Development

> Installation
```bash
deno install
```

> Serving
```bash
deno run start
> Listening on http://localhost:3257/
```

## APIs

The game has 4 APIs:

### (GET) `/api/server/players`

This API returns information on the player(s) in-game, if any.

### (GET) `/api/server/rooms`

This API returns almost-identical information as the `/api/client/rooms` API, however it returns information on all hashes of all rooms with no required party ID URL parameter.

### (POST) `/api/client/login`

This API takes in all the information provided by the user on log-in and generates a JWT for that session.

### (GET) `/api/client/rooms?partyId=`

This API returns information on the parties the game supports, and depending on the party ID provided in the URL, information for each room that party changes in some way. If the party does not change the room in any way, the default version of that room will be returned. All the data is gathered by the server reading the `/public/media/rooms/` directory of the game - and cached for future requests.