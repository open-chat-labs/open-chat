# Gaps

Props we had to invent, data the UI expects that the app doesn't have, and library changes the
design export needs. Each entry says where it came up.

## Design / library

- **Accent setting**: done. The accent picked on Landing's theme controls is kept in this browser
  (`web/accent.ts`) and `App.svelte` puts it on `<html>`. The in-app control is Profile's (8c).
- **Font size setting**: the app's font size setting (`fontSize` store) isn't mapped onto the
  library's `--text-*` tokens yet (L4). Profile's control writes it (8c): the design's four sizes
  are the store's steps 1 to 4 (`logic/profile/appearance.ts`), and a stored 0 shows as Small and
  stays until another size is picked. The store's fifth step has no size in the design.
- **Shell breakpoints vs layout tokens**: the shell's breakpoints and widths (Fix Brief - App
  Shell Layout: 768 / 1200 / 1476 / 1876 / 2476px, chat list `clamp(350px, 30cqw, 550px)`, right
  column 375 / 425 / 500px) don't match the library's layout tokens (`--bp-*` 1280–2500px,
  `--panel-info-*` 325–450px, `--panel-list-*`). The shell follows the brief (`shell/layout.ts`
  and Shell's container queries). The tokens should be brought in line, or the brief corrected.
- **Shell minimum width**: the brief gives the shell a 900px minimum and the island an 825px one
  up to a 1255px shell, but at 900px the island has only 806px (900 − 2 × 12 padding − 60 rail −
  10 gap). The shell's minimum is 919px instead, so the two agree; a smaller window scrolls the
  shell (both ways, below 919 × 720px) rather than the page. Confirm against the prototype.
- **Nav rail's local pick** (by hand): `NavRail` keeps the item a click picked until the host's
  `activeIndex` changes; it now also lets it go when `items` change, as the app shows Favourites
  only with favourites, which moves the items after it.
- **Rail remembered** (by hand): `NavRail` tells the host when the user expands or collapses it
  (`onExpandedChange`), so the app keeps that across visits where the rail pushes the layout
  (`shell/railState.svelte.ts`); floating, it starts collapsed. The host also says whether the
  rail floats (`floating`), rather than the rail measuring its animating slot, and the collapse
  toggle works with Enter and Space.
- **Nav rail width**: the tokens said `--rail-collapsed: 76px` / `--rail-expanded: 282px`, while
  `NavRail` drew 60px / 283px. The tokens now match what the rail draws and `NavRail` reads them,
  as does the shell's rail slot. Confirm 60px against the prototype. Floating over the island
  (below 1876px) the brief has the expanded rail at 320px: a new token, `--rail-floating`, which
  the shell gives NavRail as `--rail-expanded` while it floats.
- **Shell's backdrop and floating rail shadow**: the brief gives the right column modal's backdrop
  as `rgba(0,0,0,.55)` and the floating rail's shadow as `24px 0 48px rgba(0,0,0,.45)`, one
  value for both modes. The shell uses the theme's `--scrim` (`rgba(5,5,8,.62)` dark,
  `rgba(24,20,30,.36)` light) and `--shadow-panel` (`0 8px 24px`, .28 dark, .1 light), so the
  theme stays in one place. If the prototype has the brief's values, the tokens should change.
- **Not found page**: the design has none. `RouteScreen` shows an `EmptyState` with the existing
  page's copy ("Page not found", untranslated as it is today) and a Home button.
- **Messages have no ids**: `GroupMessage`, `ChatBubble` and `MessageGroup`'s callbacks are
  index-based, and `ThreadList` threads carry closures. `GroupMessage` now takes an optional `id`
  (by hand, phase 3b): `MessageGroup` keys its rows by it and writes it to `data-msg`. The
  callbacks are still by index.
- **Message text** (by hand, phase 3b): `ChatBubble` shows its `text` as plain text, so markdown,
  links, mentions, custom emoji and spoilers were lost. It now takes a `body` snippet shown in its
  place; the app renders the old UI's `Markdown` there. A lone emoji stays the bubble's own (large).
- **One message per group** (by hand, phase 3b): the conversation uses the old UI's list, which
  renders one row per event, so each message is a `MessageGroup` of its own. `avatarSpace` keeps
  the avatar's space under a run's first message and `endsRun` gives only the run's last message
  the last-in-group shape. The design composes whole runs in one group.
- **Voice messages**: `VoiceMessage` draws a fixed waveform and has no `levels` prop, though every
  OpenChat voice note has one.
- **GIFs**: `MessageComposer` shows placeholder GIF tiles (`GIF_WORDS`) and has no results prop;
  only `onGif(query)` goes out. The app searches KLIPY today.
- **Proposals**: `ProposalMessage` isn't in the `GroupMessage` union, so `MessageGroup` can't
  render proposal chats. When it can, a vote that comes back `neuron_votes_failed` should list each
  neuron with its reason, as the old UI does.
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
  account), and their `PageAuth` an `onOpen` and an `onClose` for the dialog opening and the person closing it. Also
  `passkeySignup` (Create account off without a passkey on offer) and `wallets` loaded when their
  method is picked. None of these were designed.
- **Learn, added by hand** (to go back to the design export): content text may use a markdown
  subset (links, bold, inline code, an image paragraph in a post: `inlineMarkdown.ts`), rendered
  as elements; FAQ answers split into paragraphs on blank lines and keep line breaks, an untitled
  FAQ group has no heading, and questions can carry an `id`. A doc's sections can be nested
  (`depth`), numbered 01, 2.1, 3.4.1, with a contents list whose sub-sections open as the reader
  reaches them, or by hand, and which scrolls on its own. `section` and `question` deep link
  into a doc and the FAQs, and `architecture` puts the host's own content on that tab, filling the screen between the header and the footer (the canister map, full width and height). Landing's section links scroll smoothly.
- **`ActivityPanel` back button** (by hand, phase 3d): opened over a chat or a wallet page
  (`?panel=activity`, ROUTES.md decision 7), the panel has a back button beside its title
  (`onBack`) that returns the left column to the middle's own panel. The design has none. Its
  empty All tab also gets its own words ("No activity yet") instead of the Payments tab's.
- **Activity feed, first cut** (`features/activity`, phase 3d): items read as the old feed's,
  with a colour swatch in place of the person's avatar and the reactions on the message but not
  its tips. The old feed marked everything read as soon as it loaded; this one follows the
  design: an item is read once it's opened, or with "Mark all read" (the feed's read-up-to time,
  so opening one marks the older ones too). Poll votes show under All only (the design's tabs are
  mentions and payments). The chat's name comes from `ActivityScreen.chatName`, a copy of the old
  `getChatName` still to extract.
- **`DialogShell` opens animated** (by hand, S2): it fades its veil in and lifts its card in
  (`oc-veil-in`, `oc-dlg-in`) as the hand-built dialogs do; the export's had no animation, so
  the dialog host's placeholders, the rules dialog and `ChatPicker` popped in. Closing has none
  still: the shell unmounts when its host closes it.
- **`ProfileDialog`, by hand** (8c, to go back to the design export): `sections`, the sections
  its nav offers (a host that has built only some); the cover and photo edit buttons only with
  `onCoverEdit` / `onPhotoEdit`; `engagement` counts as numbers; `memberSince` from `joined` in the
  host's locale; a chats & calls toggle the host didn't take goes back.
- **`ProfileDialog` against the app** (8c):
  - the profile fields save one at a time, and any failure shows as "couldn't save": the reason
    the backend gave (`ProfileFieldErrors`, e.g. "display name too short") isn't shown;
  - the username is checked against looser rules than the app's (3 characters and up, where
    `isUsernameValid` wants 5), so a name the app can't take says "taken";
  - no read-only state for a suspended user: an edit fails to save instead;
  - the account's Status row always says Online;
  - the notifications toggle has no disabled state for permission refused in the browser, and
    shows where notifications aren't supported;
  - the restricted-content toggles show in every build (the mobile app hides them in app-store
    builds, which don't run this tree yet);
  - no rows for: the language, translation edit mode, named light and dark themes, the user id's
    and voting hotkey's "don't send tokens here" warning, the crash log, Diamond's expiry and
    extend, referred users, Discord / Telegram accounts.
- **Swatches**: the design's colour/cover swatches for groups, communities and avatars have no
  OpenChat equivalent (it has uploaded avatars and banners). Adapters pass images and pick a
  swatch from the id.
- **PIN prompt** (S3, `features/pin`): the library's only PIN entry is inside `WalletSend`, so the
  prompt the client opens for every other transfer (tips, prizes, the "+" builders, swaps, gates)
  is a plain dialog on `DialogShell` with one masked field (`PinDialog`, `TODO(design)`), the old
  modal's words. It wants a standalone PIN dialog, or `WalletSend`'s six boxes as a component,
  from the design export. As in the old UIs, a wrong PIN shows on the screen that started the
  transfer (`pinNumberErrorMessageStore`), not in the prompt. "I've forgotten my pin" signs in
  again through `AuthDialog` (its subtitle says why; a failure after an emailed link was followed
  shows there too, as `AuthDialog` has no error prop once it's stopped waiting) and then asks for
  the new PIN in another plain dialog (`NewPinDialog`). Neither has a design.

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
- **Sign-in**: not carried over from the old sign-in yet:
  - the old form's prompt when a referral code is turned down ("proceed" without it, or cancel
    and sign out): the form says why, and signing up again goes ahead without the code (the
    client won't send it again); closing signs out;
  - the guidelines shown in a popup at sign-up (`AuthDialog` links to `/terms`, a placeholder
    until the legal pages exist);
  - the onboarding dialog's language picker and Logout link (closing sign-up logs out instead);
  - the Solana adapters' own icons (Phantom has none here);
  - joining the group or community a guest picked once they've signed in (`postLoginJoin` in
    `Home.svelte`), for the guest pass (phase 10).
- **Learn content** (`features/marketing/learn`): converted from the existing pages, verbatim
  (their typos included), with what Learn's shapes can't hold dropped or flattened:
  - **Whitepaper**: the old page's outline (2.1, 3.4.1 …) comes from its section ids, which
    `?section=` links keep using. Only the token allocation chart has a figure (its data from the old
    page's embedded Google Sheets chart); the voting power, attack scenario and supply charts
    are gone, and the text around them still refers to them. The two configuration tables are
    lists of "label: value". A list followed by more text is "•" paragraphs, to keep the order.
  - **Roadmap**: newest first (the old page ran oldest first, then "Future"); a detail's
    subheadings and its lists are kept apart (Learn's paragraphs, then points), and nested lists
    are flattened.
  - **FAQs**: one untitled group in the old order; the answers' HTML is converted when they're
    read (links kept, lists and table rows as lines, italics dropped), and the translation
    answer keeps its screenshot.
  - **Blog**: screenshots keep their desktop version (the mobile ones are dropped) and stack where
    the old posts set two side by side; the access gate expiry post's YouTube explainer and the
    video calls post's sequence diagram are gone, though their text still mentions them.
    Subheadings are bold paragraphs, list items "•" paragraphs, and italics plain. The
    translations post shows "2 Mar 2024", as the old blog did (its date is written as 31 Feb).
- **Landing's featured communities**: none are passed yet, so the section shows only its heading
  and Browse link. The old landing page had no such list; explore's hot communities could feed it.
- **Android APK link**: Landing's `apkHref` isn't passed yet, so that choice isn't a link. The
  old landing page links GitHub releases (`MobileBeta.svelte`), which 9b can pass.

### Wiring

- **App events** (`features/app/AppEventDialogs.svelte`): the not-found, no-access and
  not-available dialogs are a `DialogShell` with the old UI's words (no design: `TODO(design)`);
  "Page not found" was never translated. Suspending a user (`suspendUser`, platform moderators
  only) opens nothing yet.
- **Toasts**: the app's toast (`toastStore`, e.g. "Failed to un-archive chat") shows as the
  library's `UndoToast` without its action (`shell/Toasts.svelte`). The design has no failure tone
  for a toast, so a failure looks like any other message.
- **Chat list, first cut** (`features/chats`, phase 3a): not yet carried over from the old row:
  avatars (swatches stand in: Swatches), the typing line, online presence, unread mentions, the
  thread count, archive / delete in the row menu, and server-side search (users and groups outside
  the list). The preview line and the search are the old row's and list's
  (`logic/chats/latestMessagePreview`, `chatMatchesSearch`). The community header's menu only marks all read; its other items open
  dialogs later phases build.
- **Conversation, first cut** (`features/conversation`, phase 3b): reading only (the composer is
  3c). Every message kind shows as a text bubble with its text (the rich kinds are phase 5), and
  link previews, translations, tips, the message menu, reactions and swipes (phase 5) aren't
  wired. Events other than messages show as a centred line in the old UI's words, names in bold
  (`logic/conversation/timelineEventText`, shared with the old trees; no design for them:
  `TODO(design)`), and "N messages deleted" expands them. The old lines' date and time under each
  event isn't shown yet (it's duplicated in both old `NonMessageEvent`s, to extract). The header has no back button (`ConversationHeader` has
  none; narrow layouts don't show the shell yet), no last-seen line for a DM, and its menu does
  favourite, mute and copy link only: the rest open dialogs (phase 4), and calls are phase 7. The
  old list's go-to-mention button and sticky date aren't carried over; it keeps go-to-latest.
  Own messages show no name (the design's "You" would be the lower-case app string).
- **Composer, first cut** (`features/conversation/Composer.svelte`, phase 3c): text only.
  Attachments, GIFs, voice, replies, edits and the "+" menu are phase 5 (`MessageComposer` hides
  "+" and the GIF tab without their handlers). There's no @mention picker (typed @usernames are
  still sent as mentions), no rich-text editor (the old one showed markdown as it was typed) and
  no link-count warning. In a bot DM, what's typed goes to the bot as its direct-message command,
  but there's no `/` command selector, and a bot that takes no direct messages gets the
  composer's error instead of the old warning. A chat's rules are asked for in a plain dialog
  (`RulesDialog`, the old modal's words; no design for it), and the throttle countdown shows as the
  composer's banner. Enter follows the app's Enter-to-send setting (`enterSends`). A preview
  shows "This chat is read-only" where the old footer had Join and Leave (the join gate is
  phase 8).
- **Composer draft and input** (by hand, phase 3c): `MessageComposer` kept its draft to itself.
  It now takes `text` (the draft to start from) and `onInput` (the draft as it changes), so the
  app keeps a draft per chat and tells the others someone is typing.
- **Composer focus** (by hand): `MessageComposer` takes `autofocus`, so the composer's text box
  takes focus when a chat is opened, on screens 992px and wider that aren't touch-only
  (`focusEntryOnOpen`, as the old entry), unless a dialog is open. When the thread lands (4c), its
  composer should take focus as the thread opens too.

- **Native apps**: this tree doesn't register the native event listeners or signal `svelteReady`,
  so native builds leave it out whatever `OC_WEB_LAYOUT` says (`webLayoutFlag` in
  `rollup.extras.mjs`, read by both the rollup and the vite builds). The Android app also takes the
  web build over the air, so `selectLayout` keeps the native apps off it at runtime too.
- **Viewport height**: the existing trees keep `--vh` in step with the visual viewport
  (`calculateHeight`) for mobile browsers. Not needed until the narrow layouts come in.
- **Platform operator / moderator console hooks** (`window.platformOperator`,
  `window.platformModerator`) are only installed by the existing App trees.
- **Right column host** (`features/app/DetailsColumn.svelte`, S1): every panel is a placeholder
  until 4a (details, members, pinned, invites, proposal filters) and 4c (the thread) fill
  `rightScreens`; the user profile, explore's filters and the call participants entries wait on
  8c, 8a and 7b. With nothing in `rightPanelHistory` the column shows the selected chat's details
  (the old docked panel showed nothing), and a new panel opens a closed column. Not carried over:
  dragging the column wider (the old panel's `Resizable`; the design's widths are fixed) and the
  halloween theme's cobweb. A thread's placeholder lists its whole root message.
