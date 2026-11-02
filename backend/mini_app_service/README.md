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
| `REDIS_URL` | Where games are kept: `redis://`, or `rediss://` over TLS, eg. ElastiCache with encryption in transit, `rediss://:<auth token>@<primary endpoint>:6379`, its certificate checked against the public roots the service carries. Without one they're kept in memory, so they end when the service does. |
| `PORT` | 8095 if not set. |
| `IS_PRODUCTION` | Whether the IC is mainnet, so its root key isn't fetched. |

## What it keeps

- **In Redis:** each game, with its players, latest state and what its card in the chat holds. A restart or a deploy doesn't end games: the website reconnects with the tokens it kept, and the service writes any card it was writing as it stopped. A card being posted is kept until OpenChat has taken it, so a post cut off by a restart is sent again. An ended game is remembered for two hours, so posting its token again is refused.
- **In memory:** the connections, which cards each follows and which games each has open. Spectators are counted from these.
- **One instance for now.** Running more than one needs the instances to share their connections' pushes through Redis.

## Deploying

The service runs on mainnet as the container `oc-mini-app-service`, on the EC2 instance `i-0198f9d466e519454` in us-east-1, an arm64 t4g.small running Amazon Linux 2023 which it shares with the Discord and Twitch bridges. It holds the website's WebSocket connections, so it runs on a host that stays up rather than on Lambda, and as one instance (see "What it keeps").

**Deploys** are done by the *Deploy MiniApp service* GitHub Actions workflow ([`deploy-mini-app-service.yaml`](../../.github/workflows/deploy-mini-app-service.yaml)), run by hand from `master`:
- It builds the image with [`Dockerfile`](Dockerfile), on an arm runner, pushes it to ECR's `oc-mini-app-service` tagged `latest` and with the commit, and through SSM installs the host's systemd unit and start script from [`aws/`](aws) as they are in that commit, then restarts the service. So the host runs what's in the repo, and a change to either is deployed like a change to the service. The config in Parameter Store stays as it is.
- If the service doesn't start, or doesn't stay up for 30 seconds, the deploy fails, and systemd keeps restarting it.
- It then checks the service answers `GET /health` at its `PUBLIC_URL`.
- A restart drops the website's connections, which reconnect, and games carry on from Redis.
- On a PR that changes the service, the workflow, or the toolchain, it only builds the image.

### Setting it up

Once, by hand, before the first deploy:

1. **ECR:** a repository `oc-mini-app-service`.
2. **Config,** in SSM Parameter Store, under `/oc-mini-app-service/`:
   - `IC_IDENTITY_PEM` (SecureString): the service's identity, eg. `openssl ecparam -name secp256k1 -genkey -noout`;
   - `MINI_APP_SERVICE_KEY_PEM` (SecureString): its token signing key, `openssl genpkey -algorithm EC -pkeyopt ec_paramgen_curve:P-256`;
   - `USER_INDEX_CANISTER_ID`: mainnet's, `4bkt6-4aaaa-aaaaf-aaaiq-cai`;
   - `REDIS_URL` (SecureString): the ElastiCache cluster `oc-mini-app-service`'s, over TLS, `rediss://:<auth token>@<primary endpoint>:6379`. It's set already, as is its token, `REDIS_AUTH_TOKEN`;
   - `PUBLIC_URL`: where the service is served, the CloudFront distribution's url (step 5), which the deploy checks.
3. **The host:**
   - nothing to copy: each deploy installs [`aws/oc-mini-app-service-start`](aws/oc-mini-app-service-start) as `/usr/local/bin/oc-mini-app-service-start` and [`aws/oc-mini-app-service.service`](aws/oc-mini-app-service.service) in `/etc/systemd/system/`, and enables the unit. The script pulls the image, writes the config to `/run/oc-mini-app-service`, readable only by root, and runs the container with the service's port on the host's 8083, as 8080 to 8082 are the bridges' and the price service's;
   - the instance's role, `oc-discord-bridge`, also needs [`aws/instance-role-policy.json`](aws/instance-role-policy.json), as a policy of its own beside the bridges' and the price service's: `ssm:GetParameter` on `/oc-mini-app-service/*`, pulling from the `oc-mini-app-service` ECR repository, and writing to the log group `/oc/mini-app-service`, which is made beforehand, with 30 days' retention. With a key of your own for its SecureStrings, `kms:Decrypt` on the key too;
   - the instance's security group, `oc-discord-bridge`, admits 8083 only from CloudFront, as it does 8080 to 8082, from CloudFront's origin-facing prefix list, `pl-3b927c52`. A rule with that prefix list counts against the group's limit once for each of the list's many entries, so there's no room for a second one: widen the existing rule's ports, `sgr-00f8bcacba0e7ed49`, to 8080 to 8083, with `aws ec2 modify-security-group-rules`. The Redis's security group, `sg-0288199ed2cae3ece`, admits this instance's.
4. **The service's principal:** a platform operator sets it on the UserIndex from the website's admin page (`/admin`), with `set_mini_app_service_principal`. With the config in step 2, `mini_app_service principal` prints it.
5. **Public URL:** a CloudFront distribution of its own in front of the host's port 8083, over HTTPS, set up as the Twitch bridge's is:
   - origin: the instance's public DNS name, HTTP on 8083, with a 60s read timeout;
   - viewers: HTTPS only, every method allowed, as bots `POST`;
   - caching disabled (`CachingDisabled`), and all the viewer's headers but `Host` forwarded (`AllViewerExceptHostHeader`), which carries the WebSocket upgrade of `GET /ws` through.
6. **The deploy role,** `GitHubActions-DeployMiniAppService`, which GitHub can assume only from `master`:
   - **Trust:** the OIDC provider `token.actions.githubusercontent.com`, with `aud` `sts.amazonaws.com` and `sub` `repo:open-chat-labs/open-chat:ref:refs/heads/master`.
   - **Permissions:** pushing to the `oc-mini-app-service` ECR repository, plus `ecr:GetAuthorizationToken`, `ssm:SendCommand` on the instance with the `AWS-RunShellScript` document, `ssm:GetCommandInvocation`, and `ssm:GetParameter` on `/oc-mini-app-service/PUBLIC_URL`.
   - `AWS-RunShellScript` runs any command on the host as root, so the role can do anything there, including to the bridges, as their roles can to this.
7. **Point the website and bots at it:** build the website with `OC_MINI_APP_SERVICE_URL={PUBLIC_URL}`, and set a bot's `MINI_APP_SERVICE_URL`, eg. MiniGameBot's, to the same.
