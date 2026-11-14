# Plugins

Plugins add behavior to the server without touching its core: chat filters,
commands, rewards, HTTP endpoints, and so on. They run in the server process, so
only install plugins you trust.

## Layout

Each plugin is a folder in `apps/backend/plugins/`. The folder name is the
plugin's name.

```
apps/backend/plugins/
  motd/
    index.ts      # default export, required
    config.json   # optional overrides
```

For a compiled executable, put the `plugins/` folder next to the binary.

Plugins load once at startup in alphabetical order. A plugin that throws while
loading is logged and skipped. Setting `"enabled": false` in its `config.json`
skips it without deleting it.

## Writing a plugin

Default-export a function that receives the plugin API.

```ts
import type { Plugin } from "@/src/plugins";

const plugin: Plugin = (api) => {
  api.command("hello", (session) => {
    api.alert(session, `Hello, ${session.player.nickname}!`);
  });
};

export default plugin;
```

The function may be async. Any `@/` import from the backend works.

## Session

Hooks and commands receive a `session`:

| Field    | Description                                                    |
| -------- | -------------------------------------------------------------- |
| `socket` | The player's socket.io socket                                  |
| `player` | The `LocalPlayer` (id, nickname, coins, inventory, gear, etc.) |
| `crumb`  | The `PlayerCrumb` other clients see (position, current room)   |

## API

### `api.on(event, handler)`

Registers a hook. Handlers run in registration order. A handler that throws is
logged and skipped, so one broken plugin can't stop the rest.

| Event        | Payload                | Return                                |
| ------------ | ---------------------- | ------------------------------------- |
| `login`      | `session`              | nothing                               |
| `disconnect` | `session`              | nothing                               |
| `message`    | `session` and `text`   | `false`, `{ text }`, or nothing       |
| `nickname`   | `{ nickname }`         | `false`, `{ reason }`, or nothing     |

For `message`, returning `false` drops the message, returning `{ text }`
replaces it for the next hook and for the broadcast, and returning nothing lets
it through. Handlers can be async, and the message waits for them.

```ts
api.on("message", (session) => {
  if (session.text.length > 100) return false;
});
```

`nickname` runs on signup after the format checks and before the account is
created, so there is no session. Returning `{ reason }` rejects the signup and
shows that reason to the player, `false` rejects it with a generic reason, and
returning nothing allows it. Nicknames can't be rewritten.

```ts
api.on("nickname", ({ nickname }) => {
  if (nickname.toLowerCase().includes("admin")) {
    return { reason: "That nickname is reserved." };
  }
});
```

### `api.command(name, handler)`

Registers `/name`. The handler receives `session` and `args`, the text after the
command. Names are lowercase because the client lowercases input. Registering
the same name twice throws. Commands the client handles itself (`/join`,
`/shop`, `/gear`, and so on) never reach the server.

### `api.alert(session, text)`

Shows a message to one player. Use `\n` for line breaks.

### `api.grantCoins(session, amount)`

Adds coins to the player's account and updates their client.

### `api.store`

Per-plugin, per-account key/value storage, persisted in the database. Values are
JSON. Data is namespaced by plugin name and deleted with the account.

```ts
const visits = api.store.get<number>(session.player.playerId, "visits") ?? 0;
api.store.set(session.player.playerId, "visits", visits + 1);
```

### `api.config(defaults)`

Returns `defaults` merged with the keys in `plugins/<name>/config.json`.

```ts
const { size } = api.config({ size: 5 });
```

The merge is shallow: an override replaces the whole value for its key,
including arrays and objects. The file is read once at startup and isn't
validated.

### `api.routes`

A Hono instance mounted at `/api/plugins/<name>`.

```ts
api.routes.get("/", (c) => c.json({ ok: true }));
```

### Other

| Property      | Description                                         |
| ------------- | --------------------------------------------------- |
| `api.name`    | The plugin's folder name                            |
| `api.io`      | The socket.io server, for broadcasting to rooms     |
| `api.db`      | The Drizzle database; tables are in `src/db/schema` |
| `api.players` | Online players, keyed by player id                  |

## Bundled examples

| Plugin         | What it does                                          | Config                                  |
| -------------- | ----------------------------------------------------- | --------------------------------------- |
| `leaderboard`  | `/top` and `GET /api/plugins/leaderboard`             | `size`                                  |
| `word-filter`  | Censors or blocks messages, rejects nicknames, with listed words | `words`, `action` (`censor` or `block`) |
| `motd`         | Welcome message on login                              | `message` (`{nickname}`), `delayMs`     |
| `login-streak` | Daily coin reward that grows with consecutive days    | `base`, `step`, `max`, `delayMs`        |

`/streak` shows a player's current streak and tomorrow's reward.

## Notes

- Alerts sent right after login can arrive before the client UI is ready. The
  bundled plugins wait `delayMs` before alerting, and yours should too.
- `message` hooks are awaited, so a slow async hook delays that player's chat.
  Two quick messages from one player can finish out of order.
- Hooks only exist for the events in the table above. If a plugin needs another
  one (emotes, joining a room, buying an item), add it in `src/plugins/index.ts`
  and call it from the matching socket handler.
