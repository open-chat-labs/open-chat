# What's left, and how two of us can split it

This is the remaining work on the new web UI (`src/web`, behind `OC_WEB_LAYOUT=v3`), as
workstreams one person can take on their own.

- **Order:** only a few things have to happen in a set order. They're listed first ("What has to
  come first").
- **Pool:** everything else is a pool. Each workstream is a GitHub issue under the epic
  [#10107](https://github.com/open-chat-labs/open-chat/issues/10107), linked from its id below.
  Either of us takes the next one whose needs are met, puts their name on the issue, and links the
  PR there.

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
| **S2** dialog host | every dialog: Manage and the group dialogs (4b), `ChatPicker` (4d), the message kinds and actions (5a, 5b), the "+" builders (5d), the join gate (8b), Profile (8c), CHIT (8d), Diamond (8e) |
| **S1** right column host | the details panels (4a), `ThreadPanel` (4c) |
| **S3** PIN prompt | wallet Send (6b), the "+" builders that move tokens (5d), accepting a swap (5a), tipping (5b), paying at the join gate (8b), streak insurance (8d) |
| `ChatPicker` (4d) | wallet Receive's "Share to chat" (6b), forward (5b), sharing the daily result (8d) |
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
Both have (2026-10-21); what's left of F2 is deferred, as its row says.

| Id | What | Size |
|---|---|---|
| F1 | **Move shared code to its new homes.** Mechanical, no behaviour change. <ul><li>`components_shared/**/*.svelte.ts` and `app/src/runes` → `app/src/logic`;</li><li>`ChatEventList`, `Markdown`, `CanisterMapFrame` (and what they import from `components_shared`, such as `flatChatItems`) → `app/src/core`;</li><li>`VirtualList` and `VirtualChatList` → `@openchat/ui/src/lib/virtual`, taking `vclDebug` with them, with `recordError` and the iOS check passed in;</li><li>a lint rule that `app/src/logic` imports no `.svelte` file and doesn't call `navigate`, `toastStore` or `publish`.</li></ul> | M |
| F2 | **Reconcile `src/web` with the rules.** Several PRs in a row, one per group: <ul><li>**Bus events:** done in `app/src/logic/appEvents` (not-found, no-access, restricted, invalid selection, `chatWith`, `suspendUser`, `userSuspensionChanged`, `notification`, call ringing), except `joinGroup`, which waits for the join gate dialog (8b). `src/web` has no suspend dialog yet (GAPS.md).</li><li>**Client operations:** done for send (`sendMessage`), sign-in (`signIn`, `requestEmailSignIn`) and sign-up (`signUp`, terms required), used by every tree. Also auto-unarchive, now in the client (`unarchiveChatsWithUnread`, after each chats sync answer): every scope, one batched request, one failure toast; a chat that keeps failing is retried on each answer that contains it. Bot commands in a bot DM: `sendDirectBotMessage`, used by every tree. Deferred until `src/web` has a join flow: `postLoginJoin` as a client step (8b), and moving the sign-in dialog state to `app/src/logic/auth` (10a; it's view-agnostic already, and only `src/web` uses it).</li><li>**Adapters back to shapes:** done. Timeline event wording is `logic/conversation/timelineEventText`, used by both old `ChatEvent`s and the web screen (the per-kind components are deleted); the row cache is `features/conversation/rowCache.ts`; `messageStatus` follows the old ticks (accepted means sent). Activity summaries are `logic/activity/activitySummary` (a `ResourceKey`, votes by `totalVotes`), used by both old feeds. `auth.adapter` holds shapes only; its flow decisions are in `features/auth/authFlow.ts` until another tree needs them (then `app/src/logic/auth`).</li><li>**Copies replaced by the original, extracted:** done: `chatPreview` (now `logic/chats/latestMessagePreview`, shared with the old rows), `listed` (`chatMatchesSearch`), `copyUrl` (`copyPageUrl`, on the site's origin, with `copyToClipboard`), the marketing routes (`isLandingPageRoute`), and the composer's `sendBlocked` (now `entryBlock`, the old footers' order), `expandMentions`, typing throttle (`TypingNotifier`) and the send-throttle countdown (`throttleCountdown`, on the app's `now500` clock; seconds rounded up, so it never reads 0s while still throttled), all in `logic/composer` and used by every tree. Also `privatePreview`: the community half is now `isPrivateCommunityPreview` in `@client`, used by both old message lists, and the screen adds `maskChatMessages` as the old `CurrentChat` does. Not copies after all: `parentRoute` (`narrowBack` is the narrow screen's back, not "up"), the rail's profile name (a `CreatedUser`, which `client.displayName` doesn't take), proposal grouping (`src/web` passes no `groupInner`, so it has none; when proposals render (5a), the old lists' `groupInner` / `isCollapsed` move to `@client` and the screen uses them). Also done: the default chat (`defaultChat`: the last opened in the scope, else the first; decided 2026-10-21), and the mute and pin failure toasts (`pinChatFailureMessage`, `muteNotificationsFailureMessage` in `@client`; a failed mute of @everyone now says "muted", as it never did in the old trees), and `authOptions` (now `signInOptions` in `@client`: the old trees' native branch, `src/web`'s email-only browser without WebAuthn and bare `?auth`).</li><li>~~**Reactivity:**~~ dropped. `isChatReadOnly`, `maskChatMessages`, `canSendMessage` and `messageIsReadByThem` read `.value`, but every `$derived` calling them also depends on `chat`, so they update with it. What they don't follow (a suspension, which reloads the app; a DM recipient's record loading late, as in the old composer) isn't worth making per-row code re-run for every store change. Not the read-ticks item.</li><li>**Hygiene:** done. `Composer` takes props (its store reads moved to `ConversationScreen`) and so does `RulesDialog` (from `AppScreen`); the Solana wallets' `import.meta.env` read is in `utils/solanaWallets.ts`; `.then` chains replaced with `await`; `WalletRoute` (and the wallet region) is a sum type over `WalletPage`; `screens.ts` is down to one cast, with a comment saying why; `TokenState.refreshBalance` returns its failure `ResourceKey` and the views toast it, so `app/src/logic` has no lint exception. Left: the `.then` chain in `authDialog.svelte.ts` (L7), and the specs that mount components (`Router.spec`, `NavRail.spec`, and `@openchat/ui`'s), kept for now until someone checks whether they catch anything.</li></ul> | L |

## Foundations

Small, and worth doing first, since much of the pool waits on them.

| Id | What | Size | Touches |
|---|---|---|---|
| [S0](https://github.com/open-chat-labs/open-chat/issues/10108) | Retag the phase TODOs (above) | XS | comments, GAPS.md |
| [S1](https://github.com/open-chat-labs/open-chat/issues/10109) | **Right column host.** The right column picks its screen through a `rightScreens` lookup table (as `leftScreens` / `middleScreens`), keyed by what the client's `rightPanelHistory` holds (details, members, pinned, profile …) and the URL's open thread. This replaces the placeholder in `AppScreen`. | S | `AppScreen`, `screens.ts` |
| [S2](https://github.com/open-chat-labs/open-chat/issues/10110) | **Dialog host.** One place in the shell that mounts the app's local dialogs. The `closeModalStack` handler closes them before a navigation (`TODO(phase 4)` in `Router.svelte`). The `profile-clicked` event from `<profile-link>` opens `UserDialog`. | S | `AppScreen`, `Router` |
| [S3](https://github.com/open-chat-labs/open-chat/issues/10111) | **PIN prompt.** Answer `pinNumberResolverStore` / `pinNumberFailureStore`, as `RulesDialog` answers the rules prompt. | S | `AppScreen` |

## The pool

Grouped by area. "Needs" lists what has to land first (blank: start any time). Sizes are rough:
XS, S, M, L.

Each workstream's issue carries its port inventory, invariants and open questions. Whoever takes
it checks the inventory before building. The epic holds the rules every issue follows and the
owners of work that fell between rows; the rows below name the ones that land on them.

A workstream is done when every line of its inventory is either built or listed in GAPS.md, and
each of its invariants has a check.

### Taking an issue

More than one person, each with agents, works this pool at once. To stop two of them building
the same thing (S2 was built twice):

1. Take an issue only if it has no assignee. If it has one, leave it, even if it looks stalled,
   and ask the assignee.
2. Before anything else (reading code, branching, starting agents), assign it to the person
   you're working for: `gh issue edit N --add-assignee @me`.
3. Check the assignees again (`gh issue view N --json assignees`). If someone else is there too,
   you both took it at once: remove yourself and pick another.

### Right column and group management (phase 4)

| Id | Workstream | Size | Needs | Touches |
|---|---|---|---|---|
| [4a](https://github.com/open-chat-labs/open-chat/issues/10112) | **Details panels.** <ul><li>`GroupPanel` for groups, channels and communities: details, members with roles, pinned messages, rules, gates summary, the `?everyone` and `?usergroup=` members views.</li><li>`DmPanel` for a DM, and `UserDialog`.</li></ul> It owns the shared **gates adapter** (gate config ↔ `AccessGates`), which 4b and 8b reuse, and the shared **user adapter** (name, avatar, bio, badges), which 8c reuses. Also the suspend user dialog (`UserDialog`'s menu), and moving the mobile-only `membersState` / `communityState` to `app/src/logic`. | L | S1; S2 opens `UserDialog` (agree it with whoever is on S2) | `screens.ts` |
| [4b](https://github.com/open-chat-labs/open-chat/issues/10113) | **Manage and the group dialogs.** <ul><li>`GroupSettingsDialog`: sections hidden or read-only by role, the About page for members.</li><li>`InviteDialog`, `UserGroupDialog`, the Leave / Delete / Convert / Import dialogs, `CreateGroupDialog`, `NewChannelDialog`, `BotDialog`, `WebhookDialog`.</li><li>Create and edit community, including create from Explore's `onCreate`.</li></ul> It also wires the conversation header's other menu items (block, delete, leave, invite), the chat-list row's archive / delete, and the community header's menu. | L | S2; reuses 4a's gates adapter | `ConversationScreen` header menu, `ChatsScreen` row menu (agree the hooks with whoever is on 5a–5c) |
| [4c](https://github.com/open-chat-labs/open-chat/issues/10114) | **Threads.** <ul><li>`ThreadPanel` in the right column for an open thread (`/:mi?open=true`, `/:mi/:tmi`): its replies through the same list as the conversation, and its own composer.</li><li>`ThreadList` as the `threads` left screen (`?threads`), All / Unread; opening a thread keeps `?threads`.</li><li>The "N replies" link under a message.</li></ul> | M | S1 | `features/conversation`, `screens.ts` |
| [4d](https://github.com/open-chat-labs/open-chat/issues/10115) | **`ChatPicker`.** Share to a chat, for `/share` (`TODO` in `Router.svelte`), invite links, Receive's "Share to chat", forward (5b) and sharing the daily result (8d). | S | S2 | `Router` |

### Messages and the composer (phase 5)

| Id | Workstream | Size | Needs | Touches |
|---|---|---|---|---|
| [5a](https://github.com/open-chat-labs/open-chat/issues/10116) | **Message kinds.** Each in its bubble, through `conversation.adapter`, one small PR per kind: <ul><li>media: image, video, GIF;</li><li>file, and voice (no `levels` in GAPS);</li><li>link previews (`ogPreviews`);</li><li>transfer, swap offer, poll, prize;</li><li>proposal (not in the `GroupMessage` union in GAPS);</li><li>call events.</li></ul> Also deleted / undelete, translations, tips, reaction chips. | L | S2, S3 | `features/conversation` |
| [5b](https://github.com/open-chat-labs/open-chat/issues/10117) | **Message actions.** <ul><li>`MessageActions` (reply, edit, delete, pin, forward, copy, translate, report, tip, remind, hide link preview);</li><li>the hover bar's reactions and emoji picker (`selectReaction`);</li><li>swipe to reply / edit / forward;</li><li>Retry on a failed message.</li></ul> The library's callbacks are by index (GAPS, "Messages have no ids"). | L | S2, S3, 4d | `features/conversation` |
| [5c](https://github.com/open-chat-labs/open-chat/issues/10118) | **Composer.** <ul><li>reply and edit states above the input;</li><li>files and media (one per message: `AttachmentContent` holds one);</li><li>voice;</li><li>GIF search (the library has no results prop yet, GAPS);</li><li>the @mention picker, bot commands, the link-count warning;</li><li>the "+" menu, once 5d's builders land.</li></ul> | L | 5d for the "+" menu | `Composer.svelte` (also 7c, 8b, 10a) |
| [5d](https://github.com/open-chat-labs/open-chat/issues/10119) | **The "+" builders.** `PollBuilderDialog`, `PrizeBuilderDialog`, `SendCryptoDialog`, `SwapOfferDialog`, `MemeFighterDialog`, each a component with its adapter (DATA.md, "Composer '+' dialogs"). They hand the composer a content to attach, or a poll to publish. | M | S2, S3, 6a's token data | |

5a, 5b and 5c all change `features/conversation`, so they're best taken by one person, in that
order. 5d is the piece to split off: build the dialogs on their own, then 5c plugs them in.

### Wallet (phase 6)

A workspace of its own (left `WalletPanel`, middle `WalletMain`). `screens.ts` already has its
`wallet` lines, and `/wallet/*` routes into regions already.

| Id | Workstream | Size | Needs | Touches |
|---|---|---|---|---|
| [6a](https://github.com/open-chat-labs/open-chat/issues/10120) | **Wallet panel, All activity, token page.** Totals, allocation, token list with its menu, hide balances, the token page (summary card, fact strip, activity filter, day-grouped history from `getAccountTransactions`). | L | | `screens.ts` |
| [6b](https://github.com/open-chat-labs/open-chat/issues/10121) | **Send and Receive.** Send in two steps, then the PIN, then the receipt card with View in chat / Done (`onSent` from Done, `openChat: true`). Receive: network, address card with QR, copy QR as an image, Share to chat. | M | 6a, S3, 4d | |
| [6c](https://github.com/open-chat-labs/open-chat/issues/10122) | **Swap.** ICPSwap only, manual quote with countdown, two steps, `ProgressTimeline`. | M | 6a | |
| [6d](https://github.com/open-chat-labs/open-chat/issues/10123) | **Recipients and settings.** `WalletRecipients` in the middle, `WalletSettingsDialog`. GAPS has an address-validation mismatch. | S | 6a, S2 | |

### Calls (phase 7)

A call replaces the middle column and keeps the chat header. It's best taken by whoever knows the
conversation screen.

| Id | Workstream | Size | Needs | Touches |
|---|---|---|---|---|
| [7a](https://github.com/open-chat-labs/open-chat/issues/10124) | **Decision:** `CallPanel` / `VideoTile` need `MediaStream`s, and the app uses Daily's prebuilt iframe (GAPS, "Calls"). Agree on Daily's call-object mode. | – | | |
| [7b](https://github.com/open-chat-labs/open-chat/issues/10125) | **Call panel and controls.** Start a voice or video call from the header, join and leave, the call view in the middle. Handle `startVideoCall`, `hangup` and `askToSpeak` (DATA.md). "Call in progress" in the chat list. The incoming call's ring (Accept / Decline). | L | 7a | `ConversationScreen`, `AppScreen` |
| [7c](https://github.com/open-chat-labs/open-chat/issues/10126) | **`MiniCall`.** Minimise to a floating, draggable window that snaps to 8 positions, kept clear of the header and composer as measured live (`MiniCall`'s `safeTop` / `safeBottom`). It stays up while switching chats. | M | 7b | `Composer.svelte`, `ConversationScreen` |

### Profile, CHIT, Diamond (phase 8)

Each opens from the rail or a query param, so none of them waits on anything but the dialog host.

| Id | Workstream | Size | Needs | Touches |
|---|---|---|---|---|
| [8c](https://github.com/open-chat-labs/open-chat/issues/10129) | **Profile.** `ProfileDialog` on `?profile` (placeholder today), its settings (theme, the accent and font size controls, Enter-to-send, linked accounts). L4 puts font size onto the tokens; the accent is already applied (`web/accent.ts`). Reuses 4a's user adapter, or writes it if 8c comes first. | M | S2 | `Router` query block, `AppScreen` |
| [8d](https://github.com/open-chat-labs/open-chat/issues/10130) | **CHIT.** <ul><li>`ChitDialog` on `?chit`, with Earn;</li><li>`LeaderboardDialog` on `?hof`, `AchievementsDialog`, `AchievementToast`, `StreakInsuranceDialog`;</li><li>`PuzzleDialog` and `DailyPuzzleCard`;</li><li>the rail's CHIT claim;</li><li>the daily result message kind (`DailyResultContent`).</li></ul> Moves `utils/dailyPuzzle.svelte.ts` and `utils/puzzleBoard.svelte.ts` out of `utils`. | L | S2, S3, 4d | `Router` query block, `features/rail` |
| [8e](https://github.com/open-chat-labs/open-chat/issues/10131) | **Diamond.** `DiamondDialog` on `?diamond`, which the join gate, `CreateGroupDialog` and the `upgrade` event open. Move its body into `DiamondContent` (a library change, ROUTES decision 5) for the page in 9a. | M | S2 | `Router` query block |

### Explore and joining (phase 8)

| Id | Workstream | Size | Needs | Touches |
|---|---|---|---|---|
| [8a](https://github.com/open-chat-labs/open-chat/issues/10127) | **Explore.** The `explore` middle screen, full width: Featured, Popular, search in the URL, preview mode. `onCreate` opens 4b's create community dialog. | M | | `screens.ts` |
| [8b](https://github.com/open-chat-labs/open-chat/issues/10128) | **Join gate.** `JoinGateDialog` (any or all gates, pay and join), and the preview's Join / Leave in place of "This chat is read-only". `ComposerBar` needs a banner action handler (GAPS). Lapsed rejoin. `postLoginJoin` as a client step and the `?autojoin` event. Moves `utils/preview.svelte.ts` to `app/src/logic`. | M | S2, S3, 8a, 4a's gates adapter | `Composer.svelte` (agree with whoever is on 5c) |

### Pages with no new design (phase 9)

ROUTES decision 5.

| Id | Workstream | Size | Needs | Touches |
|---|---|---|---|---|
| [9a](https://github.com/open-chat-labs/open-chat/issues/10132) | **The legal pages and `/diamond`.** Learn's extra doc pages (the library change, which 9a makes first), `/terms`, `/privacy`, `/guidelines`, and `/csea-reporting` with the moderators' NCA reporting checklist. `/diamond` from `DiamondContent`. | M | 8e, for `/diamond` only | `features/marketing` |
| [9b](https://github.com/open-chat-labs/open-chat/issues/10133) | **Landing's loose ends.** Featured communities (from Explore's hot list), the Android APK link (GitHub releases, as the old landing page). | S | 8a | `features/marketing` |

### Guest and narrow passes (phase 10)

Last. These touch everything, so split them by area when we get there.

| Id | Workstream | Size | Needs | Touches |
|---|---|---|---|---|
| [10a](https://github.com/open-chat-labs/open-chat/issues/10134) | **Guest pass.** Explore and public chats read-only, the composer's Sign in prompt, the routes ROUTES.md marks "sign in". Moves the sign-in dialog state to `app/src/logic/auth`. | M | the screens it covers | `Router` (its route effect), `Composer.svelte` |
| [10b](https://github.com/open-chat-labs/open-chat/issues/10135) | **Narrow pass (< 768px).** One column at a time, Back in the conversation header, `--vh`, the shell's minimum width. Stop falling back to the old UI below 768px (`selectLayout`). | L | most of the pool | `shell/*`, `AppScreen`, `regions.ts`, `utils/layout.ts` |

### Loose ends

Small, any time, good between bigger pieces. Each is its own PR.

| Id | What | Touches |
|---|---|---|
| [L1](https://github.com/open-chat-labs/open-chat/issues/10136) | **Chat list** (GAPS "Chat list, first cut"): <ul><li>avatars instead of swatches;</li><li>the typing line, presence, unread mentions;</li><li>the thread count;</li><li>server-side search for users and groups outside the list.</li></ul> Also `Avatar`'s `url` prop, which L3 needs too. | `features/chats` |
| [L2](https://github.com/open-chat-labs/open-chat/issues/10137) | **Conversation** (GAPS "Conversation, first cut"): <ul><li>a DM's last-seen line;</li><li>go to first mention, the sticky date.</li></ul> The event kinds that showed nothing are done (#10098). | `features/conversation` |
| [L3](https://github.com/open-chat-labs/open-chat/issues/10138) | **Activity:** tips on the message, poll votes' tab. | `features/activity` |
| [L4](https://github.com/open-chat-labs/open-chat/issues/10139) | **Font size** onto the library's text tokens (GAPS). The accent is done (`web/accent.ts`); its in-app control is 8c's. | `App.svelte` |
| [L5](https://github.com/open-chat-labs/open-chat/issues/10140) | **Router's known issues** (ROUTES.md): the legacy `/:chatId` catch-all, `landingPagePaths`, unused route kinds. | `router/` |
| [L6](https://github.com/open-chat-labs/open-chat/issues/10141) | **Native and operator hooks** (GAPS "Wiring"). The native half isn't needed while native builds keep the old UI. The operator and moderator console hooks are needed on desktop at cutover. | |
| [L7](https://github.com/open-chat-labs/open-chat/issues/10142) | **F2's small leftovers:** the `.then` chain in `authDialog.svelte.ts`, the client's `mobileWidth` read, and F1's specs left in `components_shared` (`pinNumberForm`, `tipForm`, `cryptoTransferForm`, `group`, `community`) with `prizeClaim.ts`. | `openchat-client/src/openchat.ts`, `features/auth` |

## Two people: a suggested start

One sensible split, by area, so each of us mostly stays in our own folders:

- **One of us, the chat core:** 5a → 5b → 5c, 4c threads, then calls (7), plus L1 and L2.
- **The other, everything around it:** S0–S3, then 4a/4b/4d, and the self-contained screens and
  dialogs (8a, 8c, 8d, 8e, the wallet's 6a–6d, 5d, 8b, 9).

It's only a starting point. Anything in the pool whose needs are met can go to whoever is free.
For example, Profile, CHIT, Diamond and Explore can run alongside the group dialogs once S2 lands.
