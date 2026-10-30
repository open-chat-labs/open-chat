# The MiniApp service

An off-chain service OpenChat runs between the website and the bots that host games in messages:
- Bots post their games' cards through it, with a post token from the LocalUserIndex, so it knows every game from the moment its card exists.
- Players join games through it, and the bot accepts or refuses each one.
- Spectators watch through it, and never reach the bot.
- Only the service posts a game's card in its chat and writes to it, through the LocalUserIndex's `send_mini_app_message` and `update_mini_app`, so a bot can't list anyone who didn't join.

The protocol, between the website, the service, bots and their apps, is in [`backend/docs/mini_app_service_protocol.md`](../docs/mini_app_service_protocol.md).

## Running it locally

With the local replica running:

```bash
./backend/mini_app_service/run-local.sh
```

The script:
- generates the service's keys into `backend/mini_app_service/.local` the first time;
- starts Redis, if it isn't already running;
- prints the service's principal, for a platform operator to set on the UserIndex from the website's admin page (`/admin`), as on mainnet. Locally, make your user an operator first with dfx's identity, which is the governance principal: `dfx canister call user_index add_platform_operator '(record { user_id = principal "<your user id>" })'`;
- then starts the service on port 8095.

## Config

| Variable | |
|---|---|
| `IC_URL` | The IC, `http://127.0.0.1:8080` if not set. |
| `IC_IDENTITY_PEM` | The service's identity on the IC, an Ed25519 or secp256k1 key. A platform operator must set its principal on the UserIndex with `set_mini_app_service_principal`, from the website's admin page; `mini_app_service principal` prints it. |
| `USER_INDEX_CANISTER_ID` | Where OpenChat's public key is fetched from. The tokens the service takes are signed with it. |
| `MINI_APP_SERVICE_KEY_PEM` | The key the service signs its own tokens with: a P-256 key in PKCS#8 PEM. Bots fetch its public key from `GET /public_key`. |
| `REDIS_URL` | Where games are kept. Without one they're kept in memory, so they end when the service does. |
| `PORT` | 8095 if not set. |
| `IS_PRODUCTION` | Whether the IC is mainnet, so its root key isn't fetched. |

## What it keeps

- **In Redis:** each game, with its players, latest state and what its card in the chat holds. A restart or a deploy doesn't end games: the website reconnects with the tokens it kept, and the service writes any card it was writing as it stopped. A card being posted is kept until OpenChat has taken it, so a post cut off by a restart is sent again. An ended game is remembered for two hours, so posting its token again is refused.
- **In memory:** the connections, which cards each follows and which games each has open. Spectators are counted from these.
- **One instance for now.** Running more than one needs the instances to share their connections' pushes through Redis.
