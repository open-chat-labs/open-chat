# The MiniApp service protocol

The MiniApp service is run by OpenChat. It sits between the website and the game servers (bots), so that:
- a user is on a game's card only if they asked to join through OpenChat and the bot accepted them;
- spectators watch through the service and never reach the bot;
- a card exists only if the service knows its game, as bots post cards through the service.

This document is the contract between the website, the service, bots and their apps.

## Conventions

- Everything is JSON.
- Ids:
  - user, bot and canister ids are principal text;
  - message ids are decimal strings, since they don't fit a JavaScript number;
  - channel ids and message indexes are numbers.
- A game is the bot's MiniApp message it's played from:
  ```json
  { "chat": { "Group": "<chat id>" }, "thread": null, "message_id": "123" }
  ```
  `chat` is `{ "Group": id }` or `{ "Channel": [community id, channel id] }`. `thread` is the thread's root message index, or `null`.
- Every token is a JWT that lasts an hour. Its `claim_type` must be the one expected; the claims are in `types::claims`.

| Token | Claim type | From | Held by |
|---|---|---|---|
| Chat | `MiniAppChat` | the LocalUserIndex's `access_token_v2`, `MiniAppChat { chat }` | the website, one per chat |
| Post | `MiniAppPost` | the LocalUserIndex's `bot_mini_app_post_token`, called as the bot | the bot, one per card |
| Bot | `MiniAppBot` | the LocalUserIndex's `bot_mini_app_token`, called as the bot | the bot |
| Player | `MiniAppPlayer` | the service, when a player joins or opens a game | the app, one per player per game |

The LocalUserIndex signs the first three with OpenChat's key, the same key as its other tokens. The website and bots get its public key from the UserIndex's `public_key`.

- **A chat token** says whether the user is a member, who may join the chat's games, or can only see the chat's messages, and may only watch them. Anyone else is refused one.
  - Who can see a chat follows its events: anyone can see a public group, or a public channel in a public community without a payment gate, unless it hides its messages from non-members.
  - A community's members can see its public channels.
- **A post token** is a bot's permission to post one card: the bot, its endpoint, the chat, thread and message id, and who asked (a command and its user, or the bot itself). The LocalUserIndex resolves those as it would for `bot_send_message`, and fixes the message id: a chat command's, or otherwise one the bot chooses (the SDKs pick a random one). Posting the same token again posts nothing new, as the chat answers a bot's repeated card with the card it holds, so a bot can safely retry. A command's token lasts as long as the command can be answered.
- **The service posts a card** through the LocalUserIndex's `send_mini_app_message`, with the bot's post token, and **writes to it** through `update_mini_app`. Only its principal may call either; it's set by the UserIndex's `set_mini_app_service_principal` proposal. A bot can't post a card any other way: `bot_send_message` refuses MiniApp content.

The service also signs `MiniAppJoin`, `MiniAppStart` and `MiniAppLeave` for its calls to bots. Its public key is at `GET /public_key` (PEM).

## Website ↔ service: WebSocket

`wss://<service>/ws`. Messages have a `type`. A request carries an `id`, which its reply repeats; pushes have none.

- **Tokens:** the website keeps its tokens for their hour. If the socket drops, it reconnects with them and sends its `follow` and `open` requests again.
- **Order:** requests are handled in order, except `join`, `start` and `leave`, which wait on the bot.
- **Liveness:**
  - The service pings every 30 seconds, and closes a socket it hears nothing from for 90.
  - It also closes a socket which stops reading, rather than queuing messages for it.
- **Errors:** a message the service can't read gets `{ "type": "error", "code": "invalid_message" }`.

### Connecting

The first message must be `connect`, within 10 seconds, with any of the user's chat tokens. Its user becomes the socket's user.

```json
{ "type": "connect", "chat_token": "<chat token>" }
```
- Success: `{ "type": "connected", "user_id": "..." }`.
- Connecting doesn't follow the chat; `follow` does that.
- Otherwise: `{ "type": "error", "code": "invalid_token" }`, and the socket closes.

### Following cards

```json
{ "type": "follow", "id": 1, "chat_token": "<chat token>", "games": [game, ...] }
{ "type": "unfollow", "games": [game, ...] }
```

- The chat token must be the connected user's, and every game must be in its chat. The service checks both on every request that takes a chat token.
- The service replies `{ "type": "ok", "id": 1 }`, then pushes a `card` for each game it knows, and again whenever one changes.
- A game the service doesn't know gets nothing, and its card shows the copy stored in the chat.

```json
{ "type": "card", "game": game, "status": "Active", "players": ["..."], "waiting_for": ["..."], "watching": 3, "result": null }
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
   - it pushes a new `card` to everyone following the game.

While a game is taking players, who's joined is only in the service. The card in the chat records them when the game starts.

Asking again as a player returns `joined` without asking the bot.

The bot is asked without the game being held, so it can update the game before it answers. If the game started or filled up meanwhile, the join is refused, and the bot is told the user left.

The user isn't a player until the service adds them, after the bot answers. So the bot mustn't count them as playing until it's asked to start the game (see "Starting"), which may come while it's still answering.

### Refusals

Any request can be refused: `{ "type": "refused", "id": 2, "reason": "...", "message": "..." }`.

| reason | When |
|---|---|
| `invalid_token` | the chat token is invalid, expired, or someone else's |
| `wrong_chat` | a game isn't in the chat token's chat |
| `not_member` | joining with a chat token that isn't a member's |
| `unknown_game` | the service doesn't know the game |
| `not_open` | joining, leaving or starting a game that has started or finished |
| `full` | the game has `max_players` players, or 100, a card's most |
| `refused_by_bot` | the bot said no; `message` is the bot's, to show the user |
| `bot_unavailable` | the bot didn't answer within 5 seconds. After a join, it's told the user left, in case it accepted late. Also when the bot answers a start invalidly. |
| `no_spectators` | opening a game that isn't the user's, which doesn't allow spectators |
| `not_a_player` | asking for a player token for, or to start, a game the user isn't playing |
| `unavailable` | the service couldn't read or save the game; try again |

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
- Spectators count towards the card's `watching` while they have a game open. The website opens a game while its card is on screen, in the card itself, so anyone looking at a game which allows spectators is watching it.
- A state can arrive twice, or out of order, so the website drops one whose `seq` is below the last it had. One with the same `seq` replaces it: it's the same state, re-sent when the user's role changes.
- **Changing role:** when a user joins, leaves, or is removed, the service tells their connections with the game open, then re-sends the latest state:

```json
{ "type": "role", "game": game, "role": "player", "player_token": "..." }
{ "type": "role", "game": game, "role": "spectator" }
{ "type": "closed", "game": game }
```
  - A spectator who joins becomes a player, with a player token, and gets their own part of the state.
  - A player who leaves becomes a spectator, getting the shared part, or has the game closed if it doesn't allow spectators.
  - The website initialises the app again in its new role before passing it the state.

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
- The service tells the bot, then replies `ok`, so rejoining can't overtake the leave. It also pushes a new `card`.

### Starting

A player asks to start the game, eg. from a Start button in the app (see "App ↔ website"):

```json
{ "type": "start", "id": 6, "game": game }
```
- Only a player, while the game is Open.
- The service asks the bot (see "Service → bot"), and holds the game meanwhile, so no one joins or leaves but those whose joins the bot is still answering.
- If the bot starts it, the service replies `ok`. Everyone gets the new `card`, and everyone with the game open gets its first `state`, after a `role` message for anyone whose role changed.
- Otherwise it's `refused`, with `refused_by_bot` and the bot's message, eg. "Needs 2 players".

## The bot's apps

A bot declares the apps it hosts in its definition, each with its artwork, and a card names one of them:

```json
"mini_apps": [{ "name": "chess", "image_url": "app/chess.svg" }]
```

- `name` is 1 to 50 characters, and what a card's `app` names. The LocalUserIndex refuses a card whose app isn't in the bot's definition.
- `image_url` is an absolute http(s) URL, or a path relative to the bot's endpoint, eg. `app/chess.svg`.

The website shows the image in the card's frame box whenever there's no app to show: before the app loads, to someone who can't open it, and when the game is over with no end state, with the result, or "Game over", over it.

## Bot → service: HTTPS

Every call has `Authorization: Bearer <bot token>`.

### `POST /bot/post`

```json
{
  "token": "<post token>",
  "card": {
    "text": "**Uno** · 2 to 4 players",
    "app": "uno",
    "max_players": 4,
    "spectators": true,
    "app_size": { "width": 440, "height": 720 }
  },
  "block_level_markdown": false,
  "replies_to": null
}
```
- The bot gets the token from the LocalUserIndex's `bot_mini_app_post_token`, with the same context it would send a message with: a command's token or an autonomous chat, the channel for a community command, the thread, and the message id it chose, unless a chat command's token fixes it. The token must be the bot's own.
- `card` is the card as the bot posts it: `max_players` and `replies_to` are optional, and `block_level_markdown` is false if left out. `app` names one of the bot's apps, as its definition declares them (see "The bot's apps"): the LocalUserIndex refuses a card whose app isn't in the bot's definition. The card shows the app's image, from the definition, whenever there's no app to show. `app_size` is the size the app's designed for, in CSS pixels, each 1 to 10,000 and neither more than three times the other: the card shows the app at that aspect ratio, sized before it loads. Its status is Open.
- The service posts the card as the bot, through the LocalUserIndex, and answers `{ "game": game }` once it's in the chat. The game is in the token, so the bot knows it before the card is posted.
- **Posting again with the same token** answers `{ "game": game }` too, without posting another card: the chat answers a bot's repeated card with the card it holds. So a bot which doesn't get an answer, eg. as the service restarted, sends the same token again. Any other message at the card's message id is a refusal, so a command answered with a card isn't answered with anything else at its id first, except an unfinalised placeholder, which the card replaces.
- Until the service has posted a card, it doesn't know the game: no one can follow, join or open it, and `/bot/update` answers 404.

Errors:

| Status | Meaning |
|---|---|
| 400 | the token is invalid or expired, the card is invalid, or OpenChat refused it, eg. the bot isn't installed in the chat, lacks the MiniApp permission, or has no app of that name; `error` says which |
| 403 | another bot's token |
| 409 | the game has finished |
| 503 | the service couldn't reach OpenChat, or read or save the game. The service keeps trying for as long as the token lasts; the bot may post the same token again too |

### `POST /bot/update`

```json
{
  "game": game,
  "waiting_for": ["<user id>"],
  "result": null,
  "end_state": null,
  "remove": ["<user id>"],
  "state": { "seq": 12, "shared": {}, "private": { "<user id>": {} } }
}
```
Every field but `game` is optional.

- **`status`** is only `Finished`, which ends the game, whether it started or not. A player starts it, through the service (see "Starting").
- **`waiting_for`** is whose turn it is now, all players, each once. Leave it out to keep it as it is; send it empty when it's no one in particular.
- **`result`** is up to 200 characters, and only comes with Finished.
- **`end_state`** is how the game ended, as any JSON, eg. for chess the final position and the moves, so viewers can step through them. At most 16 KB serialized, and only with Finished. It's written to the card with the result, and the website hands it to the app, which shows it as how the game ended (see "App ↔ website"). A finished card with an end state shows the app with it; one without shows the app's image and the result.
- **`remove`** takes players off the game.
- **`state`:**
  - It goes to everyone with the game open.
  - `shared` goes to everyone; each `private` part goes only to its player.
  - `seq` must increase. The service drops a state whose `seq` isn't above the last one.
  - The bot includes a format version, so an app left open from an older release knows to reload. It also includes the last move, so the app can animate it.
- **The body** is at most 64 KB.
- **Writing to the card:** the service updates the card through the LocalUserIndex's `update_mini_app`, with a `MiniAppStatusUpdate`.
  - When a player starts the game: `Started { players, waiting_for, settings }`, with the players the bot started it with, and its settings (see "Starting" under "Service → bot").
  - When whose turn it is changes: `Turn { waiting_for }`.
  - When the bot sets Finished: `Ended { result, end_state }`. The card keeps the players the game started with, and its settings, or no one and none if it never started. Finished ends the game.
  - The service remembers what the card holds, and sends the updates it still needs, in order. Turns that pass while an update's being written go as one.
  - Removing a player after the game has started doesn't change the card's players, only the live card's.

Errors:

| Status | Meaning |
|---|---|
| 400 | invalid: a status other than Finished, a result or an end state without Finished, an end state over 16 KB, waiting for someone who isn't playing |
| 403 | not the bot's game |
| 404 | unknown game, eg. one whose card hasn't been posted |
| 409 | the game has finished |
| 413 | over 64 KB |

## Service → bot: HTTPS

The service calls the bot at the endpoint in the game's post token, the bot's when it posted the card. It sends a token it signs, in `x-oc-jwt`, which lasts a minute. The bot verifies it with the service's public key, checking `claim_type` and that `bot` is its own id.

### `POST <endpoint>/mini_app/join`

The token is `MiniAppJoin`, with `{ bot, game, user_id }`. The bot answers within 5 seconds:

```json
{ "accepted": true }
{ "accepted": false, "message": "Seats are taken" }
```

### `POST <endpoint>/mini_app/start`

The token is `MiniAppStart`, with `{ bot, game, user_id }`: the player who asked. The bot answers within 5 seconds, starting the game:

```json
{ "accepted": true, "players": ["..."], "waiting_for": ["..."], "settings": { "target": 2048, "seconds": 120 }, "state": { "seq": 1, "shared": {}, "private": {} } }
```
or not:
```json
{ "accepted": false, "message": "Needs 2 players" }
```
- **`players`** are who it starts with, in any order.
  - Each should be playing, or have a join the bot's still answering, as it accepted them; that join then succeeds.
  - Anyone else isn't added, and the bot's told they left, eg. a player whose leave hadn't reached the bot yet.
  - Anyone playing whom the bot leaves out is taken off, as with `remove`.
- **`waiting_for`** and **`state`** are as in `/bot/update`. The state's `seq` must be above any state the bot has already sent.
- **`settings`** are the game's settings, as the players chose them before the start: any JSON value but `null`, eg. for the 2048 race the winning tile and the time limit. At most 4 KB serialized. Leave it out, or send `null`, for none. They're fixed at the start: the service writes them to the card with the players, the card keeps them when the game finishes, and the website hands them to the app (see "App ↔ website"). OpenChat never reads or shows them. `/bot/update` can't change them.
- **The service holds the game while it asks.** So the bot answers with the game's first state rather than calling `/bot/update`, and its answer mustn't wait on any `/bot/update` call for the game, eg. one made while answering a join. Those would wait until the start timed out.
- **An answer which is invalid in itself is refused:** a player listed twice, more than the game's limit, waiting for someone it doesn't list, settings over 4 KB, or a state that isn't newer.
- **If a start fails,** eg. it timed out or the service couldn't save it, the player can ask again. So a bot asked to start a game it already started answers with its players as they are now.

### `POST <endpoint>/mini_app/leave`

The token is `MiniAppLeave`, with `{ bot, game, user_id }`. A player left, or isn't playing after all, eg. the bot accepted them too late. The bot answers 200, treating a leave for someone who isn't a player as done. The service retries a few times if it doesn't answer.

The service doesn't follow redirects from a bot's endpoint.

## App ↔ website: postMessage

The website loads `<endpoint>/app` in a sandboxed iframe. It sends messages only to the app's origin, and takes them only from the app's frame and origin.

**App → website:**
- `{ kind: "mini_app_ready" }`
- `{ kind: "mini_app_token_request" }`: a player's token is running out.
- `{ kind: "mini_app_start" }`: the player asks to start the game. The website sends `start`.

**Website → app:**
- `{ kind: "initialise_mini_app", role: "player" | "spectator", user_id, token, dark_mode, locale, finished, settings }`
  - The website sends it again when the user's role changes.
  - `token` is the player token, and only players get one.
  - `finished` is true when the game is over and the card holds how it ended. Then there's no token, `role` is "player" if the user was one of the game's players and "spectator" otherwise, and no `mini_app_state` follows: a `mini_app_end_state` does.
  - `settings` are the game's settings as the card records them, parsed from the JSON the bot started the game with, and absent (`undefined`) while the card has none, or if they don't parse. They come with every initialise, a finished card's included. The card's copy arrives with the next initialise only, so an app that's open when the game starts learns the settings from the bot's state, as it does everything else about the game.
- `{ kind: "mini_app_end_state", state }`: the bot's end state, as JSON. The website sends it after `initialise_mini_app` for a finished card, and also to an app that's open live when its game finishes and the card gets its end state, so the app switches to its end view. The website opens a finished card's app only when the card has an end state; otherwise it shows the app's image with the result.
- `{ kind: "mini_app_token", token }`
- `{ kind: "mini_app_state", seq, shared, private }`
  - The website holds the latest state until the app is ready.
  - The app drops a state whose `seq` is below the last one, and takes one with the same `seq` in place of the one it has.
- `{ kind: "set_dark_mode", dark_mode }`
- `{ kind: "mini_app_start_result", accepted, message }`: the answer to `mini_app_start`. `message` is the bot's, or why OpenChat couldn't start it.

A player's app sends the player token, in `x-oc-jwt`, with each request to the bot.

## Rules

- **Joining and leaving** only happen through OpenChat's own buttons on the card and around the frame. Nothing lets an app join or leave for its user. Otherwise an app could sign up everyone who opens it.
- **Starting goes through OpenChat,** so the card records exactly who the game started with. An app asks for its player, and the bot decides. Moves go straight to the bot.
- **A bot checks its own player list on every request.** A player token outlives a removal by up to an hour.
- **Spectators get only the shared state,** which every player sees too, so watching can't leak a player's hand.
- **Only the service posts a card, and only it writes the card's status.** So every card is a game the service knows from the moment it exists. The status holds the game's players and settings once it starts, whose turn it is, and its result and end state once it finishes.
  - A bot can take players off but never put them on.
  - The service ends a game:
    - after 24 hours with no update from its bot, ending the card with no result;
    - when an update fails because the card was deleted (`MessageNotFound`);
    - when an update fails because the bot was uninstalled (`BotNotFound`). It then ends the card with no result, which is let through, so the card doesn't look like it's still being played;
    - when updates keep failing for a day.
  - A game which ended stays ended: posting its token again is refused.
