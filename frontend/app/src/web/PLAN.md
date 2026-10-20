# What's left, and how two of us can split it

This is the remaining work on the new web UI (`src/web`, behind `OC_WEB_LAYOUT=v3`), phase by
phase, cut into workstreams that one person can take on their own. It won't be a perfect
separation. Where two workstreams touch the same files, the section says which ones, so we can
agree who goes first.

ROUTES.md says what each route shows, DATA.md where each component's data comes from, and GAPS.md
what's missing or differs from the design. This file only says who does what, and in what order.

## Where we are

- **Done:**
  - phases 0–2: the library, the shell, routes onto regions;
  - Landing, Learn and sign-in;
  - phase 3 (the brief's step 4): the chat list, reading a conversation, the text composer.
  - The rail labels, `?threads` and `?panel=activity` are merged too.
- **In review:** #10059, phase 3d (`?panel=activity`, the activity feed).
- **Still to check on a real environment** (the local replica can't show them): live incoming
  messages, read ticks turning double, the typing indicator, a preview's read-only banner.

## Phase numbers

From here on, **phase N is the brief's build step N + 1** (Architecture §10), as phases 1–3 were.

| Phase | Brief step | What |
|---|---|---|
| 4 | 5 | Right column (details, members, threads) and the Manage modal, with the group dialogs |
| 5 | 6 | Rich messages, composer attachments, message actions and swipe |
| 6 | 7 | Wallet |
| 7 | 8 | Calls |
| 8 | 9 | Profile, CHIT, achievements, daily puzzle, Diamond, Explore, the join gate |
| 9 | 10 | Pages with no new design: the legal pages and `/diamond` (Landing and Learn are done) |
| 10 | 11 | Guest pass, then the narrow-layout pass |

Some TODOs and GAPS.md notes were written with the brief's step numbers. Retag them in the first
small PR (workstream S0):

- `TODO(phase 5)`: the header menu's dialogs and the share `ChatPicker` → **phase 4**.
- "phase 6": rich message kinds, attachments, replies, edits → **phase 5**.
- "phase 8": calls → **phase 7**. `?diamond`, `?hof`, `?chit` and `ProfileDialog` stay phase 8.
- "phase 9": the join gate → **phase 8**.

## How we split

Two tracks, so each of us owns a set of folders most of the time:

- **Track A, chat core:** everything inside a conversation or a chat list.
  - Folders: `features/conversation`, `features/chats`, threads, calls.
  - Library: `MessageGroup`, the bubbles, `MessageComposer` / `ComposerBar`, `ThreadPanel`,
    `ThreadList`, `CallPanel`, `MiniCall`.
- **Track B, workspaces and dialogs:** the right column's panels, every dialog, and the
  self-contained screens.
  - Screens: wallet, explore, profile, CHIT, Diamond, the legal pages.
  - Folders: new `features/<name>` folders, plus `features/rail` and `features/activity`.

Rules that keep us out of each other's way:

1. **Screens plug in through `features/app/screens.ts`**, one line each (README, "Rules"). A
   new screen touches only its own line there, so two PRs adding different screens don't conflict.
2. **Shared files** need a heads-up before changing anything more than a line:
   - `features/app/AppScreen.svelte`, `router/Router.svelte`, `router/regions.ts`;
   - `shell/*`.
3. **Library components:** one of us at a time per component. Say in the channel before a hand
   change to one, log it in `openchat-ui/EXPORT-LOG.md`, and list it in GAPS.md. EXPORT-LOG,
   GAPS, ROUTES and DATA get appended to by both of us; their conflicts are trivial (keep both
   entries).
4. **New app strings** go in every locale (`app/src/i18n/*.json`), under the feature's own
   namespace where there is one, so additions don't land next to each other.
5. **Small PRs from master.** Stack only inside your own track. Rebase onto master when the other
   track's PR merges.
6. **Tests:** business logic only (`CLAUDE.md`). Browser checks against the local replica go in
   the PR's test plan.

## Shared foundations (first, small, one person each)

These unblock both tracks. Doing them first saves rework.

| Id | What | Size | Who | Unblocks |
|---|---|---|---|---|
| S0 | Retag the phase TODOs above | XS | either | clarity |
| S1 | **Right column host.** The right column picks its screen through a `rightScreens` lookup table (as `leftScreens` / `middleScreens`), keyed by what the client's `rightPanelHistory` holds (details, members, pinned, profile …) and the URL's open thread. This replaces the placeholder in `AppScreen`. | S | B | 4a, 4c |
| S2 | **Dialog host.** One place in the shell that mounts the app's local dialogs. The `closeModalStack` handler closes them before a navigation (`TODO(phase 4)` in `Router.svelte`). The `profile-clicked` event from `<profile-link>` opens `UserDialog`. | S | B | 4b, 4d, 5c, 8 |
| S3 | **PIN prompt.** Answer `pinNumberResolverStore` / `pinNumberFailureStore`, as `RulesDialog` answers the rules prompt. | S | B | 5c (crypto, prizes, swaps), 6 |

## Phase 4: right column and group management

| Id | Workstream | Track | Depends on |
|---|---|---|---|
| 4a | **Details panels.** `GroupPanel` for groups, channels and communities: details, members with roles, pinned messages, rules, gates summary, the `?everyone` and `?usergroup=` members views. `DmPanel` for a DM, and `ProfileDialog` "This chat" below 1476px. | B | S1 |
| 4b | **Manage and the group dialogs.** `GroupSettingsDialog`, with sections hidden or read-only by role, and the About page for members. `InviteDialog`, `UserGroupDialog`, the Leave / Delete / Convert / Import dialogs, `CreateGroupDialog`, `NewChannelDialog`, `BotDialog`, `WebhookDialog`. Wire the conversation header's other menu items (block, delete, leave, invite), the chat-list row's archive / delete, and the community header's menu. | B | S2 |
| 4c | **Threads.** `ThreadPanel` in the right column for an open thread (`/:mi?open=true`, `/:mi/:tmi`): its replies through the same list as the conversation, and its own composer. `ThreadList` as the `threads` left screen (`?threads`), All / Unread, opening a thread with `?threads` kept. | A | S1 |
| 4d | **`ChatPicker`.** Share to a chat, for `/share` (`TODO` in `Router.svelte`), invite links, and Receive's "Share to chat". | B | S2 |

Touches: 4c changes `features/conversation` (the list's reuse) and `screens.ts`. 4b changes the
conversation header's `onMenu` in `ConversationScreen.svelte` and the chat list's row menu in
`ChatsScreen.svelte`, both track A files. Agree on the hooks first (4b adds the handlers, A
reviews).

## Phase 5: rich messages, attachments and message actions

| Id | Workstream | Track | Depends on |
|---|---|---|---|
| 5a | **Message kinds.** Each in its bubble, through `conversation.adapter`. Each kind is its own small PR, so this splits further if needed: <ul><li>media: image, video, GIF, album;</li><li>file, and voice (`VoiceMessage` has no `levels` in GAPS);</li><li>link previews from `ogPreviews`;</li><li>transfer, swap offer, poll, prize;</li><li>proposal (not in the `GroupMessage` union in GAPS);</li><li>call events, with the 8h grouping.</li></ul> Also deleted / undelete, translations, tips, reaction chips. | A | – |
| 5b | **Message actions.** <ul><li>`MessageActions` (reply, edit, delete, pin, forward, copy, translate, report, tip, remind, hide link preview);</li><li>the hover bar's reactions and emoji picker (`selectReaction`);</li><li>swipe to reply / edit / forward;</li><li>Retry on a failed message.</li></ul> The library's callbacks are by index (GAPS, "Messages have no ids"). | A | – |
| 5c | **Composer.** <ul><li>reply and edit states above the input;</li><li>files and media (up to 10);</li><li>voice;</li><li>GIF search (the library has no results prop yet, GAPS);</li><li>the @mention picker, bot commands, the link-count warning.</li></ul> | A | – |
| 5d | **The "+" builders.** `PollBuilderDialog`, `PrizeBuilderDialog`, `SendCryptoDialog`, `SwapOfferDialog`, `MemeFighterDialog`, each as a component with its adapter (DATA.md, "Composer '+' dialogs"). They hand A's composer a content to attach or a poll to publish. | B | S2, S3, the wallet's token data (6a) |

5a, 5b and 5c are all in A's folders, so A does them in that order. 5d is the parallel piece:
B builds the dialogs on their own, and A plugs them into the "+" menu once they land.

## Phase 6: wallet

All track B. It's a workspace of its own (left `WalletPanel`, middle `WalletMain`), so it splits
cleanly. `screens.ts` already has its `wallet` lines, and `/wallet/*` routes into regions already.

| Id | Workstream | Depends on |
|---|---|---|
| 6a | **Wallet panel, All activity, token page.** Totals, allocation, token list with its menu, hide balances, the token page (summary card, fact strip, activity filter, day-grouped history from `getAccountTransactions`). | – |
| 6b | **Send and Receive.** Send in two steps, then the PIN, then the receipt card with View in chat / Done (`onSent` from Done, `openChat: true`). Receive: network, address card with QR, copy QR as an image, Share to chat. | 6a, S3, 4d |
| 6c | **Swap.** ICPSwap only, manual quote with countdown, two steps, `ProgressTimeline`. | 6a |
| 6d | **Recipients and settings.** `WalletRecipients` in the middle, `WalletSettingsDialog`. GAPS has an address-validation mismatch. | 6a |

## Phase 7: calls

Track A: a call replaces the middle column and keeps the chat header.

| Id | Workstream | Depends on |
|---|---|---|
| 7a | **Decision first:** `CallPanel` / `VideoTile` need `MediaStream`s, and the app uses Daily's prebuilt iframe (GAPS, "Calls"). Agree on Daily's call-object mode before building. | – |
| 7b | **Call panel and controls.** Start a voice or video call from the header, join and leave, the call view in the middle. Handle `startVideoCall`, `hangup` and `askToSpeak` (DATA.md). "Call in progress" in the chat list. | 7a |
| 7c | **`MiniCall`.** Minimise to a floating, draggable window that snaps to 8 positions, measured live from the header and composer (`data-mini-top` / `data-mini-bottom`). It stays up while switching chats. | 7b |

## Phase 8: profile, CHIT, Diamond, Explore, join gate

Track B. Every item is a dialog or a screen of its own.

| Id | Workstream | Depends on |
|---|---|---|
| 8a | **Explore.** The `explore` middle screen, full width: Featured, Popular, search in the URL, preview mode. | – |
| 8b | **Join gate.** `JoinGateDialog` (any or all gates, pay and join), and the preview's Join / Leave in place of "This chat is read-only". `ComposerBar` needs a banner action handler (GAPS). Lapsed rejoin. | 8a, S2; touches A's `Composer.svelte` (agree on it) |
| 8c | **Profile.** `ProfileDialog` on `?profile` (placeholder today), its settings (theme, accent and font size from GAPS, Enter-to-send, linked accounts). The Profile Dialog handoff notes apply. | S2 |
| 8d | **CHIT.** <ul><li>`ChitDialog` on `?chit`, with Earn;</li><li>`LeaderboardDialog` on `?hof`, `AchievementsDialog`, `AchievementToast`, `StreakInsuranceDialog`;</li><li>`PuzzleDialog` and `DailyPuzzleCard`;</li><li>the rail's CHIT claim.</li></ul> | S2 |
| 8e | **Diamond.** `DiamondDialog` on `?diamond`, also opened from the join gate. Move its body into `DiamondContent` (a library change, ROUTES decision 5) for the page in 9a. | S2 |

## Phase 9: pages with no new design

Track B. ROUTES decision 5.

| Id | Workstream | Depends on |
|---|---|---|
| 9a | **The legal pages and `/diamond`.** Learn's extra doc pages (library), `/terms`, `/privacy`, `/guidelines`, and `/csea-reporting` with its report form. `/diamond` from `DiamondContent`. | 8e |
| 9b | **Landing's loose ends.** Featured communities (from Explore's hot list), the Android APK link. | 8a |

## Phase 10: guest and narrow passes

Last. These touch everything, so split them by area when we get there.

| Id | Workstream | Track |
|---|---|---|
| 10a | **Guest pass.** Explore and public chats read-only, the composer's Sign in prompt, the routes ROUTES.md marks "sign in". | A for chats and the composer, B for the rest |
| 10b | **Narrow pass (< 768px).** One column at a time, Back in the conversation header, `--vh`, the shell's minimum width. Stop falling back to the old UI below 768px (`selectLayout`). | split by area |

## Loose ends (any time, small, either track)

Good fillers between bigger pieces. Each is its own small PR.

- **Chat list** (track A, GAPS "Chat list, first cut"):
  - avatars instead of swatches;
  - the typing line, presence, unread mentions;
  - the thread count;
  - server-side search for users and groups outside the list.
- **Conversation** (track A, GAPS "Conversation, first cut"):
  - a DM's last-seen line;
  - go to first mention, the sticky date;
  - the event kinds that show nothing yet.
- **Activity** (track B): tips on the message, poll votes' tab.
- **Settings** (track B): accent and font size onto the tokens (GAPS).
- **Router's known issues** (ROUTES.md): the legacy `/:chatId` catch-all, `landingPagePaths`,
  unused route kinds.
- **Native and operator hooks** (GAPS "Wiring"): not needed while native builds keep the old
  UI.

## Suggested start

| | Track A, chat core | Track B, workspaces and dialogs |
|---|---|---|
| First | S0, then 5a (message kinds, one PR per kind) | S1, S2, S3 |
| Next | 4c threads, once S1 lands; 5b actions | 4a panels, 4b Manage, 4d `ChatPicker` |
| Then | 5c composer, then wire 5d's builders | 6 wallet (6a → 6b / 6c / 6d), 5d builders |
| Then | 7 calls (after the 7a decision) | 8 (8a → 8b, 8c, 8d, 8e), then 9 |
| Last | 10, split by area | 10, split by area |

A starts on 5a because it needs nothing from B. B starts with the foundations both tracks wait on.
