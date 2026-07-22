## Problem

Message translation for diamond users is currently performed entirely client-side:

- The Google Translate API key is baked into the client bundle (`OC_PUBLIC_TRANSLATE_API_KEY`, inlined by Vite) and sent as a query param from the browser — it is fully public in every shipped build. (Note: `frontend/.env` is gitignored and untracked, so the key is NOT in git history — exposure is via the bundle only.)
- The diamond gate is a client-side UI check only (`ChatMessageMenu.svelte` / `ChatMessageOptions.svelte`), so a capable user can bypass it and use the key freely.

## Agreed design

Replace the client-side Google call with a small off-chain proxy, gated by an OC-issued JWT.

We explicitly considered and rejected doing the translation on-chain via the message-owning canisters (user/group/community endpoint → c2c → HTTPS outcall with `is_replicated: false`). It is feasible, but end-to-end latency is ~4–7s per request (ingress update call + c2c hop + outcall rounds), which makes following a conversation effectively unusable, and it requires substantially more machinery (new endpoints on three canister types, an outcall library, a stable-memory cache with edit/delete invalidation, and API-key fan-out to canisters). The proxy approach matches today's latency (~500ms, ~50ms on cache hit) with far less code.

### 1. Token issuance (on-chain)

- New token type in `local_user_index` `access_token_v2` (already a composite query, so issuance is query-speed).
- Issued only if the caller is a diamond member **or** a platform moderator (the moderator case covers the admin translation-corrections flow, since those users are not necessarily diamond). The LUI already knows diamond status locally (`global_users.is_diamond_member`) — no c2c required, unlike the video-call token types.
- Claims: `{ user_id, exp }`. TTL 30 minutes (existing token types use 5). Signed with the existing `oc_key_pair` like all other OC JWTs.
- Client fetches the token lazily, caches it, and refetches when the proxy returns 401.

### 2. Translation proxy (AWS, configured with SAM)

Lambda (function URL, no API Gateway) + DynamoDB, deployed via a SAM template:

- **Auth**: verify the OC JWT signature (ES256 / ECDSA P-256, OC public key — `user_index.public_key`; the key differs per environment, so accept a list) and expiry.
- **Request**: `{ texts: [...], target_locale }` — batch accepted from day one (Google v2 supports up to 128 `q` segments per request); the client will initially send single items.
- **Cache**: DynamoDB, keyed on `hash(text + target_locale)` → translated text, with native DynamoDB TTL for eviction. Content-addressed keying means message edits and deletions need no invalidation at all: edited text produces a new key, and stale/orphaned entries simply age out. It also dedupes identical text across all chats.
- **Rate limits** (DynamoDB atomic counters):
  - per-user (from `user_id` claim): ~30 requests/min burst, ~100k chars/day
  - per-IP limit on unauthenticated / invalid-JWT requests
  - global daily character budget with alerting and a hard kill switch (fail closed, e.g. alert ~$20/day equivalent, stop ~$50/day) so the Google bill is bounded no matter what
- **Google call**: Translation API v2 REST, `format=text`, same shape as today.
- **Key handling**: Google key lives in SSM only, referenced as a Lambda environment value. The new key must be API-restricted (Cloud Translation only) and IP-restricted to the proxy's egress.

### 3. Frontend

- Replace the three direct Google call sites (`ChatMessageMenu.svelte`, `ChatMessageOptions.svelte`, `ReviewTranslationCorrections.svelte`) with calls to the proxy.
- Token fetch/cache/refresh handled in openchat-client; display model unchanged (`translationsStore`, `applyTranslation` — text content, media captions, poll text).
- Remove `OC_PUBLIC_TRANSLATE_API_KEY` (and the other translate key variants) from the bundle, `.env`, and build scripts.

### 4. Key rotation (mandatory)

The current key is public in git history. After rollout, revoke it and replace with the restricted proxy-only key. We are not too worried about stragglers on old native builds losing translation until they update; exact sequencing to be decided at deployment time.

## Explicitly out of scope / dropped from the original sketch

- ~~platform_operator endpoint to set the key~~ — key is proxy config now
- ~~translate_message endpoints on user/group/community canisters~~
- ~~shared-lib HTTPS outcall + stable-memory translation cache~~
- Auto-translate-a-whole-chat mode: future feature; the proxy batch endpoint already supports it.

## Open questions (implementation-time)

- Lambda runtime: TypeScript (least friction with tooling) vs Rust via `cargo-lambda` (shop consistency — SAM supports both natively).
- Exact rate-limit numbers and the global budget thresholds — start with the values above and tune against observed volume.
- Rollout sequencing / straggler window before old-key revocation.
