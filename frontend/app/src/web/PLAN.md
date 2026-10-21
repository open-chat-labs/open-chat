# What's left, and how two of us can split it

This is the remaining work on the new web UI (`src/web`, behind `OC_WEB_LAYOUT=v3`), as
workstreams one person can take on their own.

- **Order:** only a few things have to happen in a set order. They're listed first ("What has to
  come first").
- **Pool:** everything else is a pool. Either of us takes the next workstream whose needs are
  met, writes their name in its "Taken by" column, and links the PR there.

ROUTES.md says what each route shows, DATA.md where each component's data comes from, and GAPS.md
what's missing or differs from the design. This file only says who does what, and what has to
wait for what. How the code is put together is in `frontend/CLAUDE.md` and README.md; both apply to
every workstream.

## Where we are

- **Done:**
  - phases 0–2: the library, the shell, routes onto regions;
  - Landing, Learn and sign-in;
  - phase 3 (the brief's step 4): the chat list, reading a conversation, the text composer, the
    activity feed over the open page (`?panel=activity`);
  - the rail labels and `?threads`.
- **Still to check on a real environment** (the local replica can't show them): live incoming
  messages, read ticks turning double, the typing indicator, a preview's read-only banner.

## Phase labels

The brief's build order (Architecture §10) is a suggestion, not a dependency. Phases stay only as
labels: they name the brief's steps in `TODO(phase N)` comments and in GAPS.md. **Phase N is the
brief's build step N + 1**, as phases 1–3 were.

| Phase | Brief step | What |
|---|---|---|
| 4 | 5 | Right column (details, members, threads), the Manage modal and the group dialogs |
| 5 | 6 | Rich messages, composer attachments, message actions and swipe |
| 6 | 7 | Wallet |
| 7 | 8 | Calls |
| 8 | 9 | Profile, CHIT, achievements, daily puzzle, Diamond, Explore, the join gate |
| 9 | 10 | Pages with no new design: the legal pages and `/diamond` (Landing and Learn are done) |
| 10 | 11 | Guest pass, then the narrow-layout pass |

Some TODOs and GAPS.md notes used the brief's step numbers. S0 below retags them:

- `TODO(phase 5)`: the header menu's dialogs and the share `ChatPicker` → **phase 4**.
- "phase 6": rich message kinds, attachments, replies, edits → **phase 5**.
- "phase 8": calls → **phase 7**. `?diamond`, `?hof`, `?chit` and `ProfileDialog` stay phase 8.
- "phase 9": the join gate → **phase 8**.

## Working in parallel

1. **Screens plug in through `features/app/screens.ts`**, one line each (README, "Rules"). A
   new screen touches only its own line there, so two PRs adding different screens don't conflict.
2. **Shared files** need a heads-up before changing anything more than a line:
   - `features/app/AppScreen.svelte`, `router/Router.svelte` (its query-parameter block),
     `router/regions.ts`;
   - `shell/*`.

   The "Touches" column says which workstreams go into them.
3. **Library components:** one of us at a time per component. Say in the channel before a hand
   change to one, log it in `openchat-ui/EXPORT-LOG.md`, and list it in GAPS.md. EXPORT-LOG,
   GAPS, ROUTES and DATA get appended to by both of us; their conflicts are trivial (keep both
   entries).
4. **New app strings** go in every locale (`app/src/i18n/*.json`), under the feature's own
   namespace where there is one, so additions don't land next to each other.
5. **Small PRs from master.** Stack only on your own work. Rebase onto master when the other
   person's PR merges.
6. **Tests:** business logic only (`CLAUDE.md`). Browser checks against the local replica go in
   the PR's test plan.

## What has to come first

These are the only real orderings. A workstream that isn't on the right of this table can start at
any time.

| First | Then |
|---|---|
| **F1** move, then **F2** reconcile | everything else: the foundations S0–S3 and the whole pool |
| **S2** dialog host | every dialog: Manage and the group dialogs (4b), `ChatPicker` (4d), the "+" builders (5d), the join gate (8b), Profile (8c), CHIT (8d), Diamond (8e) |
| **S1** right column host | the details panels (4a), `ThreadPanel` (4c) |
| **S3** PIN prompt | wallet Send (6b), the "+" builders that move tokens (5d) |
| `ChatPicker` (4d) | wallet Receive's "Share to chat" (6b) |
| wallet panel and token data (6a) | Send / Receive (6b), Swap (6c), recipients and settings (6d), the "+" builders (5d) |
| the "+" builders (5d) | plugging them into the composer's "+" menu (part of 5c) |
| the gates adapter (in 4a) and Explore (8a) | the join gate (8b) |
| Diamond (8e) | the `/diamond` page (9a) |
| Explore (8a) | Landing's featured communities (9b) |
| the call-mode decision (7a) | the call panel (7b), then `MiniCall` (7c) |
| almost everything | the guest and narrow passes (10a, 10b), last |

A screen that opens something not built yet, such as "Get Diamond" in `CreateGroupDialog` or the
join gate, waits for nothing. It opens the dialog by its query param or the dialog host, and gets a
placeholder until that dialog lands.

## Before anything else

An audit of `src/web` (2026-10-21) found that the client and stores are reused well, but most of
the view logic it needed was still inside legacy components, so it was copied into `src/web`.
About a dozen copies already behave differently from the originals, and one gap is a live bug.
These two items fix that before more is built on top. Nothing else starts until both have landed.

| Id | What | Size | Taken by |
|---|---|---|---|
| F1 | **Move shared code to its new homes.** Mechanical, no behaviour change. <ul><li>`components_shared/**/*.svelte.ts` and `app/src/runes` → `app/src/logic`;</li><li>`ChatEventList`, `Markdown`, `CanisterMapFrame` (and what they import from `components_shared`, such as `flatChatItems`) → `app/src/core`;</li><li>`VirtualList` and `VirtualChatList` → `@openchat/ui/src/lib/virtual`, taking `vclDebug` with them, with `recordError` and the iOS check passed in;</li><li>a lint rule that `app/src/logic` imports no `.svelte` file and doesn't call `navigate`, `toastStore` or `publish`.</li></ul> | M | |
| F2 | **Reconcile `src/web` with the rules.** Several PRs in a row, one per group: <ul><li>**Bus events:** done in `app/src/logic/appEvents` (not-found, no-access, restricted, invalid selection, `chatWith`, `suspendUser`, `userSuspensionChanged`, `notification`, call ringing), except `joinGroup`, which waits for the join gate dialog (8b). `src/web` has no suspend dialog yet (GAPS.md).</li><li>**Client operations:** done for send (`sendMessage`), sign-in (`signIn`, `requestEmailSignIn`) and sign-up (`signUp`, terms required), used by every tree. Left: auto-unarchive leaves `ChatsScreen`. Deferred until `src/web` has a join flow (8b, and the guest pass in phase 10): `postLoginJoin` as a client step, and moving the sign-in dialog state to `app/src/logic/auth` (it's view-agnostic already, and only `src/web` uses it).</li><li>**Adapters back to shapes:** `conversation.adapter` (`eventLines`, `messageStatus`, `MessageRows`), `activity.adapter` (summaries; `totalVotes` from `utils/polls`), `auth.adapter`.</li><li>**Copies replaced by the original, extracted:** done: `chatPreview` (now `logic/chats/latestMessagePreview`, shared with the old rows), `listed` (`chatMatchesSearch`), `copyUrl` (`copyPageUrl`, on the site's origin, with `copyToClipboard`), the marketing routes (`isLandingPageRoute`), and the composer's `sendBlocked` (now `entryBlock`, the old footers' order), `expandMentions`, typing throttle (`TypingNotifier`) and the send-throttle countdown (`throttleCountdown`, on the app's `now500` clock; seconds rounded up, so it never reads 0s while still throttled), all in `logic/composer` and used by every tree. Not copies after all: `parentRoute` (`narrowBack` is the narrow screen's back, not "up"), the rail's profile name (a `CreatedUser`, which `client.displayName` doesn't take). Also done: the default chat (`defaultChat`: the last opened in the scope, else the first; decided 2026-10-21). Left: `authOptions`, `privatePreview`, the mute and pin failure toasts, proposal grouping, bot commands in a bot DM.</li><li>~~**Reactivity:**~~ dropped. `isChatReadOnly`, `maskChatMessages`, `canSendMessage` and `messageIsReadByThem` read `.value`, but every `$derived` calling them also depends on `chat`, so they update with it. What they don't follow (a suspension, which reloads the app; a DM recipient's record loading late, as in the old composer) isn't worth making per-row code re-run for every store change. Not the read-ticks item.</li><li>**Hygiene:** `Composer` and `RulesDialog` touching stores, the specs that mount components (`Router.spec`, `NavRail.spec`), `import.meta.env` outside config, `.then` chains, `WalletRoute` as a sum type, `as unknown as` in `screens.ts`, `TokenState.refreshBalance` showing its own toast (the one lint exception in `app/src/logic`).</li></ul> | L | |

## Foundations

Small, and worth doing first, since much of the pool waits on them.

| Id | What | Size | Touches | Taken by |
|---|---|---|---|---|
| S0 | Retag the phase TODOs (above) | XS | comments, GAPS.md | |
| S1 | **Right column host.** The right column picks its screen through a `rightScreens` lookup table (as `leftScreens` / `middleScreens`), keyed by what the client's `rightPanelHistory` holds (details, members, pinned, profile …) and the URL's open thread. This replaces the placeholder in `AppScreen`. | S | `AppScreen`, `screens.ts` | |
| S2 | **Dialog host.** One place in the shell that mounts the app's local dialogs. The `closeModalStack` handler closes them before a navigation (`TODO(phase 4)` in `Router.svelte`). The `profile-clicked` event from `<profile-link>` opens `UserDialog`. | S | `AppScreen`, `Router` | |
| S3 | **PIN prompt.** Answer `pinNumberResolverStore` / `pinNumberFailureStore`, as `RulesDialog` answers the rules prompt. | S | `AppScreen` | |

## The pool

Grouped by area. "Needs" lists what has to land first (blank: start any time). Sizes are rough:
XS, S, M, L.

Each workstream's issue carries a port inventory, written when the issue is created and checked by
whoever takes it:

- the legacy desktop and mobile files it replaces;
- the behaviours and edge cases to keep, with the fix commits behind them;
- the client methods, stores and `app/src/logic` modules to call;
- the logic to extract from legacy components, and where it goes;
- where desktop and mobile differ, and which one is kept.

A workstream is done when every line of its inventory is either built or listed in GAPS.md.

### Right column and group management (phase 4)

| Id | Workstream | Size | Needs | Touches | Taken by |
|---|---|---|---|---|---|
| 4a | **Details panels.** <ul><li>`GroupPanel` for groups, channels and communities: details, members with roles, pinned messages, rules, gates summary, the `?everyone` and `?usergroup=` members views.</li><li>`DmPanel` for a DM, and `UserDialog`.</li></ul> It owns the shared **gates adapter** (gate config ↔ `AccessGates`), which 4b and 8b reuse, and the shared **user adapter** (name, avatar, bio, badges), which 8c reuses. | L | S1 | `screens.ts` | |
| 4b | **Manage and the group dialogs.** <ul><li>`GroupSettingsDialog`: sections hidden or read-only by role, the About page for members.</li><li>`InviteDialog`, `UserGroupDialog`, the Leave / Delete / Convert / Import dialogs, `CreateGroupDialog`, `NewChannelDialog`, `BotDialog`, `WebhookDialog`.</li></ul> It also wires the conversation header's other menu items (block, delete, leave, invite), the chat-list row's archive / delete, and the community header's menu. | L | S2; reuses 4a's gates adapter | `ConversationScreen` header menu, `ChatsScreen` row menu (agree the hooks with whoever is on 5a–5c) | |
| 4c | **Threads.** <ul><li>`ThreadPanel` in the right column for an open thread (`/:mi?open=true`, `/:mi/:tmi`): its replies through the same list as the conversation, and its own composer.</li><li>`ThreadList` as the `threads` left screen (`?threads`), All / Unread; opening a thread keeps `?threads`.</li></ul> | M | S1 | `features/conversation` | |
| 4d | **`ChatPicker`.** Share to a chat, for `/share` (`TODO` in `Router.svelte`), invite links, and Receive's "Share to chat". | S | S2 | `Router` | |

### Messages and the composer (phase 5)

| Id | Workstream | Size | Needs | Touches | Taken by |
|---|---|---|---|---|---|
| 5a | **Message kinds.** Each in its bubble, through `conversation.adapter`, one small PR per kind: <ul><li>media: image, video, GIF, album;</li><li>file, and voice (no `levels` in GAPS);</li><li>link previews (`ogPreviews`);</li><li>transfer, swap offer, poll, prize;</li><li>proposal (not in the `GroupMessage` union in GAPS);</li><li>call events, with the 8h grouping.</li></ul> Also deleted / undelete, translations, tips, reaction chips. | L | | `features/conversation` | |
| 5b | **Message actions.** <ul><li>`MessageActions` (reply, edit, delete, pin, forward, copy, translate, report, tip, remind, hide link preview);</li><li>the hover bar's reactions and emoji picker (`selectReaction`);</li><li>swipe to reply / edit / forward;</li><li>Retry on a failed message.</li></ul> The library's callbacks are by index (GAPS, "Messages have no ids"). | L | | `features/conversation` | |
| 5c | **Composer.** <ul><li>reply and edit states above the input;</li><li>files and media (up to 10);</li><li>voice;</li><li>GIF search (the library has no results prop yet, GAPS);</li><li>the @mention picker, bot commands, the link-count warning;</li><li>the "+" menu, once 5d's builders land.</li></ul> | L | 5d for the "+" menu | `Composer.svelte` | |
| 5d | **The "+" builders.** `PollBuilderDialog`, `PrizeBuilderDialog`, `SendCryptoDialog`, `SwapOfferDialog`, `MemeFighterDialog`, each a component with its adapter (DATA.md, "Composer '+' dialogs"). They hand the composer a content to attach, or a poll to publish. | M | S2, S3, 6a's token data | | |

5a, 5b and 5c all change `features/conversation`, so they're best taken by one person, in that
order. 5d is the piece to split off: build the dialogs on their own, then 5c plugs them in.

### Wallet (phase 6)

A workspace of its own (left `WalletPanel`, middle `WalletMain`). `screens.ts` already has its
`wallet` lines, and `/wallet/*` routes into regions already.

| Id | Workstream | Size | Needs | Touches | Taken by |
|---|---|---|---|---|---|
| 6a | **Wallet panel, All activity, token page.** Totals, allocation, token list with its menu, hide balances, the token page (summary card, fact strip, activity filter, day-grouped history from `getAccountTransactions`). | L | | `screens.ts` | |
| 6b | **Send and Receive.** Send in two steps, then the PIN, then the receipt card with View in chat / Done (`onSent` from Done, `openChat: true`). Receive: network, address card with QR, copy QR as an image, Share to chat. | M | 6a, S3, 4d | | |
| 6c | **Swap.** ICPSwap only, manual quote with countdown, two steps, `ProgressTimeline`. | M | 6a | | |
| 6d | **Recipients and settings.** `WalletRecipients` in the middle, `WalletSettingsDialog`. GAPS has an address-validation mismatch. | S | 6a, S2 | | |

### Calls (phase 7)

A call replaces the middle column and keeps the chat header. It's best taken by whoever knows the
conversation screen.

| Id | Workstream | Size | Needs | Touches | Taken by |
|---|---|---|---|---|---|
| 7a | **Decision:** `CallPanel` / `VideoTile` need `MediaStream`s, and the app uses Daily's prebuilt iframe (GAPS, "Calls"). Agree on Daily's call-object mode. | – | | | |
| 7b | **Call panel and controls.** Start a voice or video call from the header, join and leave, the call view in the middle. Handle `startVideoCall`, `hangup` and `askToSpeak` (DATA.md). "Call in progress" in the chat list. | L | 7a | `ConversationScreen`, `AppScreen` | |
| 7c | **`MiniCall`.** Minimise to a floating, draggable window that snaps to 8 positions, measured live from the header and composer (`data-mini-top` / `data-mini-bottom`). It stays up while switching chats. | M | 7b | `Composer.svelte`, `ConversationScreen` | |

### Profile, CHIT, Diamond (phase 8)

Each opens from the rail or a query param, so none of them waits on anything but the dialog host.

| Id | Workstream | Size | Needs | Touches | Taken by |
|---|---|---|---|---|---|
| 8c | **Profile.** `ProfileDialog` on `?profile` (placeholder today), its settings (theme, accent and font size from GAPS, Enter-to-send, linked accounts). The Profile Dialog handoff notes apply. Reuses 4a's user adapter, or writes it if 8c comes first. | M | S2 | `Router` query block, `AppScreen` | |
| 8d | **CHIT.** <ul><li>`ChitDialog` on `?chit`, with Earn;</li><li>`LeaderboardDialog` on `?hof`, `AchievementsDialog`, `AchievementToast`, `StreakInsuranceDialog`;</li><li>`PuzzleDialog` and `DailyPuzzleCard`;</li><li>the rail's CHIT claim.</li></ul> | L | S2 | `Router` query block, `features/rail` | |
| 8e | **Diamond.** `DiamondDialog` on `?diamond`, which the join gate and `CreateGroupDialog` open. Move its body into `DiamondContent` (a library change, ROUTES decision 5) for the page in 9a. | M | S2 | `Router` query block | |

### Explore and joining (phase 8)

| Id | Workstream | Size | Needs | Touches | Taken by |
|---|---|---|---|---|---|
| 8a | **Explore.** The `explore` middle screen, full width: Featured, Popular, search in the URL, preview mode. | M | | `screens.ts` | |
| 8b | **Join gate.** `JoinGateDialog` (any or all gates, pay and join), and the preview's Join / Leave in place of "This chat is read-only". `ComposerBar` needs a banner action handler (GAPS). Lapsed rejoin. | M | S2, 8a, 4a's gates adapter | `Composer.svelte` (agree with whoever is on 5c) | |

### Pages with no new design (phase 9)

ROUTES decision 5.

| Id | Workstream | Size | Needs | Touches | Taken by |
|---|---|---|---|---|---|
| 9a | **The legal pages and `/diamond`.** Learn's extra doc pages (library), `/terms`, `/privacy`, `/guidelines`, and `/csea-reporting` with its report form. `/diamond` from `DiamondContent`. | M | 8e, for `/diamond` only | `features/marketing` | |
| 9b | **Landing's loose ends.** Featured communities (from Explore's hot list), the Android APK link. | S | 8a | `features/marketing` | |

### Guest and narrow passes (phase 10)

Last. These touch everything, so split them by area when we get there.

| Id | Workstream | Size | Needs | Taken by |
|---|---|---|---|---|
| 10a | **Guest pass.** Explore and public chats read-only, the composer's Sign in prompt, the routes ROUTES.md marks "sign in". | M | the screens it covers | |
| 10b | **Narrow pass (< 768px).** One column at a time, Back in the conversation header, `--vh`, the shell's minimum width. Stop falling back to the old UI below 768px (`selectLayout`). | L | most of the pool | |

### Loose ends

Small, any time, good between bigger pieces. Each is its own PR.

| Id | What | Touches | Taken by |
|---|---|---|---|
| L1 | **Chat list** (GAPS "Chat list, first cut"): <ul><li>avatars instead of swatches;</li><li>the typing line, presence, unread mentions;</li><li>the thread count;</li><li>server-side search for users and groups outside the list.</li></ul> | `features/chats` | |
| L2 | **Conversation** (GAPS "Conversation, first cut"): <ul><li>a DM's last-seen line;</li><li>go to first mention, the sticky date;</li><li>the event kinds that show nothing yet.</li></ul> | `features/conversation` | |
| L3 | **Activity:** tips on the message, poll votes' tab. | `features/activity` | |
| L4 | **Settings:** accent and font size onto the tokens (GAPS). | `App.svelte` | |
| L5 | **Router's known issues** (ROUTES.md): the legacy `/:chatId` catch-all, `landingPagePaths`, unused route kinds. | `router/` | |
| L6 | **Native and operator hooks** (GAPS "Wiring"): not needed while native builds keep the old UI. | | |

## Two people: a suggested start

One sensible split, by area, so each of us mostly stays in our own folders:

- **One of us, the chat core:** 5a → 5b → 5c, 4c threads, then calls (7), plus L1 and L2.
- **The other, everything around it:** S0–S3, then 4a/4b/4d, and the self-contained screens and
  dialogs (8a, 8c, 8d, 8e, the wallet's 6a–6d, 5d, 8b, 9).

It's only a starting point. Anything in the pool whose needs are met can go to whoever is free.
For example, Profile, CHIT, Diamond and Explore can run alongside the group dialogs once S2 lands.
