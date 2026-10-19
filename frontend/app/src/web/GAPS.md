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
- **Nav rail width**: the tokens said `--rail-collapsed: 76px` / `--rail-expanded: 282px`, while
  `NavRail` drew 60px / 283px. The tokens now match what the rail draws and `NavRail` reads them,
  as does the shell's rail slot. Confirm 60px against the prototype.
- **Not found page**: the design has none. `RouteScreen` shows an `EmptyState` with the existing
  page's copy ("Page not found", untranslated as it is today) and a Home button.
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
- **Sign-in, added by hand** (to go back to the design export): `AuthDialog` got `methods` (for
  `?auth=` and browsers without WebAuthn), a wallet step for Ethereum / Solana (`wallets`; the old
  UI asks which wallet), the emailed link's code on "Check your inbox", and `kind: 'link'`, the
  page the link opens, which asks for that code. Also `email` and `referrer` (prefilled),
  `onCancelEmailLink`, a failure `reason` a host call can reject with, and a failed resend shown on
  "Check your inbox". Landing and Learn got `signedIn` (Open app in place of Sign in / Create
  account), and their `PageAuth` an `onClose` for the person closing the dialog. Also
  `passkeySignup` (Create account off without a passkey on offer) and `wallets` loaded when their
  method is picked. None of these were designed.
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
- **Sign-in**: no promise that settles on sign-in, so `features/auth/signIn.ts` watches
  `identityStateStore`. Not carried over from the old sign-in yet:
  - the guidelines shown in a popup at sign-up (`AuthDialog` links to `/terms`, a placeholder
    until the legal pages exist);
  - the onboarding dialog's language picker and Logout link (closing sign-up logs out instead);
  - wallets the browser announces (EIP-6963 extensions) in the Ethereum list, and the Solana
    adapters' own icons (Phantom has none here);
  - joining the group or community a guest picked once they've signed in (`postLoginJoin` in
    `Home.svelte`), for the guest pass (phase 10).
- **Learn content**: the existing pages' content (roadmap, blog, whitepaper, FAQ) has to move
  into Learn's content shape (markdown docs, JSON roadmap and FAQ). The FAQ answers are HTML
  (links, tables), which Learn renders as plain text. The architecture page is no longer a doc:
  it frames the interactive canister map served beside the app (`CanisterMapFrame.svelte`), with
  `?section=<canister>` selecting a canister.
- **Landing's featured communities**: none are passed yet, so the section shows only its heading
  and Browse link. The old landing page had no such list; explore's hot communities could feed it.
- **Android APK link**: Landing's `apkHref` has no URL in the app, so that choice isn't a link.

### Wiring

- **Native apps**: this tree doesn't register the native event listeners or signal `svelteReady`,
  so native builds leave it out whatever `OC_WEB_LAYOUT` says (`webLayoutFlag` in
  `rollup.extras.mjs`, read by both the rollup and the vite builds). The Android app also takes the
  web build over the air, so `selectLayout` keeps the native apps off it at runtime too.
- **Viewport height**: the existing trees keep `--vh` in step with the visual viewport
  (`calculateHeight`) for mobile browsers. Not needed until the narrow layouts come in.
- **Platform operator / moderator console hooks** (`window.platformOperator`,
  `window.platformModerator`) are only installed by the existing App trees.
