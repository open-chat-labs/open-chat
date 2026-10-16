# Gaps

Props we had to invent, data the UI expects that the app doesn't have, and library changes the
design export needs. Each entry says where it came up.

## Design / library

- **Accent setting**: the design has four accents (`data-accent`), the app has no setting for it.
  `App.svelte` uses the default (pink).
- **Font size setting**: the app's font size setting (`fontSize` store) isn't mapped onto the
  library's `--text-*` tokens yet.
- **Shell breakpoints vs layout tokens**: the brief's shell breakpoints (§3: 768 / 1200 / 1476 /
  1876px, right column 375 / 425 / 500px) don't match the library's layout tokens (`--bp-*`
  1280–2500px, `--panel-info-*` 325–450px, `--panel-list-*`). The shell follows the brief
  (`shell/layout.ts`), which the build brief makes the acceptance check. The tokens should be
  brought in line, or the brief corrected.
- **Right column widths**: the brief says 375 / 425 / 500px "as width grows" without the widths
  where it grows. `shell/layout.ts` uses 425px from 1876px and 500px from 2500px; confirm against
  the prototype.
- **Nav rail width**: `NavRail` is 60px collapsed and 283px expanded, while the tokens say
  `--rail-collapsed: 76px` and `--rail-expanded: 282px`. The shell's rail slot uses the
  component's 60px.
- **Messages have no ids**: `GroupMessage`, `ChatBubble` and `MessageGroup`'s callbacks are
  index-based, and `ThreadList` threads carry closures. Adapters keep an index → event map per
  render. A `key`/`id` on messages would be simpler (also for keyed `{#each}`).
- **Voice messages**: `VoiceMessage` draws a fixed waveform and has no `levels` prop, though every
  OpenChat voice note has one.
- **GIFs**: `MessageComposer` shows placeholder GIF tiles (`GIF_WORDS`) and has no results prop;
  only `onGif(query)` goes out. The app searches Giphy today.
- **Proposals**: `ProposalMessage` isn't in the `GroupMessage` union, so `MessageGroup` can't
  render proposal chats.
- **Thread replies**: `ThreadPanel` renders replies with no react / menu / reply / edit handlers.
- **Composer banner**: `ComposerBar` takes `bannerAction` as a label but doesn't pass a handler
  through to `Banner`.
- **Calls**: `CallPanel` / `VideoTile` render `MediaStream`s. The app uses Daily's prebuilt
  iframe, which doesn't expose them; it needs Daily's call-object mode (phase 7 decision).
- **Built-in fallbacks** that should come from the app: CHIT milestone tiers (`ChitDialog`),
  Diamond limits and feature matrix (`DiamondDialog`), storage caps and about URLs
  (`ProfileDialog`), the language list (`CreateGroupDialog`), the token colour map
  (`AccessGates`).
- **Types not exported** from `src/features/index.ts` that adapters need: `WalletActivity`,
  `Recipient`, `SwapRequest`/`SwapQuote`, `ExploreCommunity`, `Achievement`, `DailyPuzzle`,
  `ChatSettings`, `SigninMethod` and others. Deep imports work meanwhile.
- **Address validation**: `WalletSettingsDialog` has its own ICP address regex, which differs
  from `lib/networks.ts`.
- **Swatches**: the design's colour/cover swatches for groups, communities and avatars have no
  OpenChat equivalent (it has uploaded avatars and banners). Adapters pass images and pick a
  swatch from the id.

## App

### Data the design shows that the backend doesn't have

- **Wallet**:
  - no 24h price change and no price history (only the current USD rate);
  - transaction history only for tokens with an index canister, one token at a time. There's no
    all-tokens activity, swaps aren't told apart from transfers, there's no chat context, and
    BTC/EVM/SOL-side transfers aren't shown;
  - saved recipients have no id, token, "last sent" or edit;
  - no native ETH deposit address;
  - swaps quote across several DEXes, while the design says ICPSwap only.
- **Explore**:
  - one server ranking, so no featured vs popular lists and no sort by active or newest;
  - results have no created date, activity metric or channel list.
- **Activity**:
  - read state is a single timestamp, so per-item "mark read" can only move the high-water mark;
  - seven message-only kinds (`poll_vote` and `p2p_swap_accepted` have no design type);
  - no paging.
- **Chats**:
  - typing reaches peers only for the selected chat (WebRTC), so the chat list rarely shows it;
  - read receipts exist only in DMs;
  - there's no cross-chat message search;
  - the unread marker is implicit (the window anchor).
- **Presence**: a polled last-online time, with no status for yourself.
- **Community stats**: counters only; there's no 12-week series for `GroupStats`.
- **Sign-in**: no promise that settles on sign-in, so adapters watch `identityStateStore`. The
  ETH/SOL wallet connection UI lives in the old components.
- **Learn content**: the existing pages' content (roadmap, blog, whitepaper, architecture, FAQ)
  has to move into Learn's content shape (markdown docs, JSON roadmap and FAQ).

### Wiring

- **Native apps**: this tree doesn't register the native event listeners or signal `svelteReady`,
  so native builds leave it out whatever `OC_WEB_LAYOUT` says (`webLayoutFlag` in
  `rollup.extras.mjs`, read by both the rollup and the vite builds). The Android app also takes the
  web build over the air, so `selectLayout` keeps the native apps off it at runtime too.
- **Viewport height**: the existing trees keep `--vh` in step with the visual viewport
  (`calculateHeight`) for mobile browsers. Not needed until the narrow layouts come in.
- **Platform operator / moderator console hooks** (`window.platformOperator`,
  `window.platformModerator`) are only installed by the existing App trees.
