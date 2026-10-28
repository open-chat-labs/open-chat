# The MiniApp service protocol

The MiniApp service is run by OpenChat. It sits between the website and the game servers (bots), so that:
- a user is on a game's card only if they asked to join through OpenChat and the bot accepted them;
- spectators watch through the service and never reach the bot.

This document is the contract between the website, the service, bots and their apps.

## Conventions

- Everything is JSON.
- Ids are strings:
  - user, bot and canister ids are principal text;
  - message ids are decimal strings, since they don't fit a JavaScript number.
- A game is the bot's MiniApp message it's played from:
  ```json
  { "chat": { "Group": "<chat id>" }, "thread": null, "message_id": "123" }
  ```
  `chat` is `{ "Group": id }` or `{ "Channel": [community id, channel id] }`. `thread` is the thread's root message index, or `null`.
- Every token is a JWT that lasts an hour. Its `claim_type` must be the one expected; the claims are in `types::claims`.

| Token | Claim type | From | Held by |
|---|---|---|---|
| Connection | `MiniAppConnection` | the LocalUserIndex's `access_token_v2`, `MiniAppConnection` | the website |
| Chat | `MiniAppChat` | the LocalUserIndex's `access_token_v2`, `MiniAppChat { chat }` | the website, one per chat |
| Registration | `MiniAppRegistration` | `mini_app_registration` in the LocalUserIndex's reply when a bot posts a card with `bot_send_message` | the bot, one per game |
| Bot | `MiniAppBot` | the LocalUserIndex's `bot_mini_app_token`, called as the bot | the bot |
| Player | `MiniAppPlayer` | the service, when a player joins or opens a game | the app, one per player per game |

The LocalUserIndex signs the first four with OpenChat's key, the same key as its other tokens. The website and bots get its public key from the UserIndex's `public_key`.

- **A chat token** says whether the user is a member, who may join the chat's games, or can only see the chat, as anyone can a public group or a public channel in a public community, and may only watch them. Anyone else is refused one.
- **The service writes to a card** through the LocalUserIndex's `update_mini_app`, which only its principal may call. That principal is set by the UserIndex's `set_mini_app_service_principal` proposal.

The service also signs `MiniAppJoin` and `MiniAppLeave` for its calls to bots. Its public key is at `GET /public_key` (PEM).

## Website ↔ service: WebSocket

`wss://<service>/ws`. Messages have a `type`. A request carries an `id`, which its reply repeats; pushes have none.

The website keeps its tokens for their hour. If the socket drops, it reconnects with them and sends its `follow` and `open` requests again.

### Connecting

The first message must be `connect`, within 10 seconds:

```json
{ "type": "connect", "token": "<connection token>" }
```
- Success: `{ "type": "connected", "user_id": "..." }`.
- Otherwise: `{ "type": "error", "code": "invalid_token" }`, and the socket closes.

### Following cards

```json
{ "type": "follow", "id": 1, "chat_token": "<chat token>", "games": [game, ...] }
{ "type": "unfollow", "games": [game, ...] }
```

- Every game must be in the chat token's chat.
- The service replies `{ "type": "ok", "id": 1 }`, then pushes a `card` for each game it knows, and again whenever one changes.
- A game the service doesn't know gets nothing, and its card shows the copy stored in the chat.

```json
{ "type": "card", "game": game, "status": "Open", "players": ["..."], "watching": 3, "result": null }
```

### Joining

```json
{ "type": "join", "id": 2, "chat_token": "<chat token>", "game": game }
```

1. The service refuses straight away if:
   - the chat token isn't a member's;
   - it doesn't know the game;
   - the game isn't Open;
   - the game is full.
2. Otherwise it asks the bot (see "Service → bot"), with a 5 second timeout.
3. If the bot accepts:
   - the service replies `{ "type": "joined", "id": 2, "player_token": "..." }`;
   - it pushes a new `card` to everyone following the game;
   - it writes the players to the card in the chat.

Asking again as a player returns `joined` without asking the bot.

A refusal is `{ "type": "refused", "id": 2, "reason": "...", "message": "..." }`:

| reason | When |
|---|---|
| `not_member` | the chat token isn't a member's |
| `unknown_game` | the service doesn't know the game |
| `not_open` | the game has started or finished |
| `full` | the game has `max_players` players |
| `refused_by_bot` | the bot said no; `message` is the bot's, to show the user |
| `bot_unavailable` | the bot didn't answer within 5 seconds |

### Opening a game

The website sends this when it opens the game's app:

```json
{ "type": "open", "id": 3, "chat_token": "<chat token>", "game": game }
{ "type": "close", "game": game }
```

- **A player** gets `{ "type": "opened", "id": 3, "role": "player", "player_token": "..." }`.
- **Anyone else** gets `{ "type": "opened", "id": 3, "role": "spectator" }`, if the card allows spectators. Otherwise they get `refused` with `no_spectators`, or `unknown_game`.
- Then the service pushes the latest state, and every update after it:

```json
{ "type": "state", "game": game, "seq": 12, "shared": {}, "private": {} }
```
- `private` is the user's own part, and is only sent to players.
- Spectators get at most about 4 updates a second. When updates come faster, they get only the latest.
- Spectators count towards the card's `watching` while they have a game open.

### Refreshing a player token

```json
{ "type": "player_token", "id": 4, "game": game }
```
The reply is `{ "type": "player_token", "id": 4, "token": "..." }`, or `refused` with `not_a_player`. The service doesn't ask the bot.

### Leaving

```json
{ "type": "leave", "id": 5, "game": game }
```
- Only while the game is Open.
- The service replies `ok`, tells the bot, pushes a new `card`, and writes the players to the card in the chat.

## Bot → service: HTTPS

Every call has `Authorization: Bearer <bot token>`.

### `POST /bot/register`

```json
{ "registration": "<registration token>" }
```
- The bot sends this after posting a game. The LocalUserIndex returns the registration token with the posted message.
- It must be the bot's own registration.
- Registering again does nothing.

### `POST /bot/update`

```json
{
  "game": game,
  "status": "Active",
  "result": null,
  "remove": ["<user id>"],
  "state": { "seq": 12, "shared": {}, "private": { "<user id>": {} } }
}
```
Every field but `game` is optional.

- **`status`** only moves forward: Open → Active → Finished, or Open → Finished. Active closes joining.
- **`result`** is up to 200 characters, and only comes with Finished.
- **`remove`** takes players off the game.
- **`state`:**
  - It goes to everyone with the game open.
  - `shared` goes to everyone; each `private` part goes only to its player.
  - `seq` must increase. The service drops a state whose `seq` isn't above the last one.
  - The bot includes a format version, so an app left open from an older release knows to reload. It also includes the last move, so the app can animate it.
- **The body** is at most 64 KB.
- **Writing to the card:** after a change to the players, status or result, the service writes them to the card in the chat. Finished ends the game.

Errors:

| Status | Meaning |
|---|---|
| 400 | invalid: status moving back, a result without Finished |
| 403 | not the bot's game |
| 404 | unknown game |
| 409 | the game has finished |
| 413 | over 64 KB |

## Service → bot: HTTPS

The service calls the bot at the endpoint in the game's registration. It sends a token it signs, in `x-oc-jwt`, which lasts a minute. The bot verifies it with the service's public key, checking `claim_type` and that `bot` is its own id.

### `POST <endpoint>/mini_app/join`

The token is `MiniAppJoin`, with `{ bot, game, user_id }`. The bot answers within 5 seconds:

```json
{ "accepted": true }
{ "accepted": false, "message": "Seats are taken" }
```

### `POST <endpoint>/mini_app/leave`

The token is `MiniAppLeave`, with `{ bot, game, user_id }`. A player left. The bot answers 200. The service retries a few times if it doesn't.

## App ↔ website: postMessage

The website loads `<endpoint>/app` in a sandboxed iframe. It sends messages only to the app's origin, and takes them only from the app's frame and origin.

**App → website:**
- `{ kind: "mini_app_ready" }`
- `{ kind: "mini_app_token_request" }`: a player's token is running out.

**Website → app:**
- `{ kind: "initialise_mini_app", role: "player" | "spectator", user_id, token, dark_mode, locale }`
  - `token` is the player token, and only players get one.
- `{ kind: "mini_app_token", token }`
- `{ kind: "mini_app_state", seq, shared, private }`
  - The website holds the latest state until the app is ready.
- `{ kind: "set_dark_mode", dark_mode }`

A player's app sends the player token, in `x-oc-jwt`, with each request to the bot.

## Rules

- **Joining and leaving** only happen through OpenChat's own buttons on the card and around the frame. Nothing lets an app join or leave for its user. Otherwise an app could sign up everyone who opens it.
- **A bot checks its own player list on every request.** A player token outlives a removal by up to an hour.
- **Spectators get only the shared state,** which every player sees too, so watching can't leak a player's hand.
- **Only the service writes a card's players, status and result.**
  - A bot can take players off but never put them on.
  - The service ends a game after 24 hours with no update from its bot, or when a write fails because the card was deleted or the bot uninstalled. It writes the card as Finished, with no result.
