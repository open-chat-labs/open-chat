# End-to-end tests

The new UI tested end to end against a local replica (PRD #10550). Each test signs up its own users with real passkeys, using Chrome's virtual WebAuthn authenticator, and drives them through the app the way a person would. It runs on both forms of the new UI, v3: desktop (`src/web`) and mobile (`src/native`, phones and the native apps):

| Project      | Tree         | Device                     |
| ------------ | ------------ | -------------------------- |
| `v3-desktop` | `src/web`    | a 1400×900 desktop browser |
| `v3-mobile`  | `src/native` | a Pixel 7: touch, no hover |

The same spec runs on both. Where the trees differ (a route, Enter versus the send button), the helper in `fixtures/` takes the tree into account so the spec doesn't have to.

## Running it

You need a local replica with OpenChat deployed. That's what `npm run dev` needs too:

```sh
dfx start --clean --background
./scripts/deploy-local.sh
```

Then, from `frontend/e2e`:

```sh
npm install
npx playwright install chromium
npm test                                  # both projects
npx playwright test dm --project v3-mobile # one spec, one tree
npm run report                            # the last run's report, with traces of failures
```

`npm test` starts its own dev server (`npm run dev:native` with `OC_E2E=true`) on port 5011. It uses its own Vite cache, so a dev server you already have running on 5001 is left alone. A server already running on 5011 is reused. To point the suite at another server, set `OC_E2E_URL`. That server must have been started with `OC_E2E=true`, and it must be on this machine: the suite refuses any other host (`config/local.mjs`).

The first load of a fresh server takes 10–20s while Vite builds. A sign-up takes about 10s, because it creates a user canister.

## Writing a spec

- **Act** through roles, names and placeholders (`getByRole("button", { name: "Join" })`), the way a screen reader sees the page. Don't use CSS classes or ids.
- **Check** what the other person sees: B's screen shows what A sent. For setup that isn't what the spec is about, and to read state back, use the user's own client through the `OC_E2E` hook (`window.__ocTest.client`, typed in `fixtures/window.d.ts`). `createPrivateGroup` is an example.
- **Make your own users and data.** Every test signs up the people it needs (`users.add`, `signUp`, `freshUsername`), or uses the worker's `pair` (`fixtures/pair.ts`): two people a worker's tests share, for tests that can't disturb each other through them, each working on messages with its own unique text. Nothing depends on another test or on a fixed account. The local backend allows each user 10 communities, so a spec that creates them uses fresh users.
- Put anything that differs between the trees in a helper in `fixtures/`, never in the spec. `fixtures/messages.ts` has the message menu, reactions, the composer and attachments.
- A test for one tree only is tagged `@desktop-only` or `@mobile-only` (`test("…", { tag: "@desktop-only" }, …)`), and the other project leaves it out.
- Wait with `expect(...)` and `expect.poll(...)`, never with `waitForTimeout`.

## Parity with the old UI

`frontend/e2e/parity` holds the switchover checks (#10550). They're run from `frontend/`:

- `npm run parity:reach` lists the client methods the old trees call that the new ones don't (#10554).
- `npm run parity:ledger` checks the capability ledger (`parity/ledger/<area>.mjs`): for each thing the old UI does, each new tree names a test that runs on it, a difference someone decided, or says it's `missing` (not built) or `untested`. It lists every row that isn't covered yet. A test that's renamed without its ledger rows fails it.

## The hook

With `OC_E2E=true`, `app/src/utils/openchatClient.ts` sets `window.__ocTest = { client }`. Only the dev server reads that flag. `rollup.config.mjs` sets it to `"false"` for every build, so the branch is removed, and CI fails a build that contains `__ocTest` (`frontend.yaml`).
