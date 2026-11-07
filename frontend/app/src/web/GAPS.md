# Gaps

Props we had to invent, data the UI expects that the app doesn't have, and library changes the
design export needs. Each entry says where it came up.

## Design / library

- **Accent setting**: done. The accent picked on Landing's theme controls is kept in this browser
  (`theme/accent.ts`) and `App.svelte` puts it on `<html>`. The in-app control is Profile's (8c).
- **Font size setting**: the app's font size setting (`fontSize` store) isn't mapped onto the
  library's `--text-*` tokens yet (L4). Profile's control writes it (8c): the design's four sizes
  are the store's steps 1 to 4 (`logic/profile/appearance.ts`), and a stored 0 shows as Small and
  stays until another size is picked. The store's fifth step has no size in the design.
- **Native platform tokens** (native N1, #10364): the library has the native layer
  (`[data-platform="native"]`: native light surfaces, `--hero-base`, `--tint-row`, `--tint-pill`;
  `--safe-*`, `--scroll-end` and `--text-scale` on `:root`; `[data-always-dark]` for calls;
  EXPORT-LOG 2026-11-04), and `textScaleOf` (`logic/profile/appearance.ts`) gives `--text-scale`
  from the font size setting and the platform's font scale. N3 (#10366) put them on the native
  root, `<html>`: `data-platform="native"`, `data-mode` and `data-accent` from the same stored mode
  and accent the web uses, `--text-scale` (removed when the tree goes), and `viewport-fit=cover`
  (main.ts). Left:
  - The platform font scale needs a native bridge (iOS dynamic type's content size category,
    Android's `Configuration.fontScale`, read again when it changes); until then the native tree
    passes 1, as mobile web does.
  - Status-bar glyphs: light on the call screen and the minimised call (N14), following the
    theme elsewhere, through the Tauri plugin.
  - For the design: the prototype's Appearance setting is "Chat text size" (Small / Default /
    Large) and only resizes messages (`--text-xs` / `--text-sm` / `--text-base` in the
    conversation: 9 / 10.5 / 12.5, 10 / 11.5 / 13.5 and 11.5 / 13 / 15.5px), while the brief and the
    issue ask for an interface size wired to dynamic type. N1 scales every `--text-*` size by the
    app's four steps (0.875–1.25) times the platform's scale, kept within 0.75–2; N12 settles
    which one the setting is. The light theme's `--tint-row` / `--tint-pill` (black at 5% / 8%) are
    ours: the export only has the dark values (as fallbacks), and its light theme had no
    `--hero-base` either. The prototype pads the bottom by a fixed 34px on iOS (the home
    indicator) and 12px on Android; `--safe-bottom` is the device's inset alone, so N2's bars
    pad by `--bar-end`, the safe area but at least 12px. The prototype's top padding (iOS 54px,
    Android 4px) is `--safe-top` alone, on both.
- **Native shell kit** (native N2, #10365; `@openchat/ui/src/native`, EXPORT-LOG 2026-11-05). N3
  (#10366) put `data-os` on the native root (the app's platform, else the user agent's) and built
  the shell on it (`src/native/README.md`). Left:
  - Haptics: done. The native root installs the Tauri plugin's new `haptic` command (Android's
    keyboard-tap feedback, iOS's light impact) in the apps, and nothing on mobile web
    (`native/haptics.ts`). A shell built before the command rejects it, which means no haptics,
    so a bundle taken over the air still runs on it: no major version bump needed for this alone.
    Check the feel on both platforms.
  - Android's system back closes an open sheet or menu first (`shell/overlays.svelte.ts`: a screen
    registers its sheet's or menu's close with `useOverlay` while it's open). In a phone's browser,
    Back is the browser's history: an open sheet doesn't take a history entry, so Back leaves the
    screen with it rather than closing it first.
- **Native app tree** (native N3, #10366; `src/native`). Built: the entry behind
  `OC_NATIVE_LAYOUT=v4`, the five tabs with their own push stacks, the push motion, Android's back,
  the cold start's parked intents, and placeholders for every screen. Left, or decided against the
  prototype:
  - **The tab bar shows only on a tab's root** (decided 2026-11-06, as the prototype has it; the
    Design Notes and the issue only said it hides inside a conversation): every pushed screen has
    the whole window (`showsTabBar`, `router/locations.ts`). A tab's stack is still kept, for a link
    from another tab or a deep link to land in.
  - **Local pushes**: screens without a URL on the web (details, members, settings pages, builders)
    need `TabStacks` to push without changing the URL, as the web opens a local dialog. With the
    first screen that needs it (N6, N9 or N12).
  - **iOS edge swipe back** (notes §2): not built; the chevron is the only Back on iOS for now.
  - **Swiping between tabs** (asked for in review, #10421; the design has no swipe between tabs):
    on a tab's root, a sideways drag follows the finger with the neighbouring tab beside it, and
    switches past 30% of the width or on a flick faster than 0.45px/ms over 24px (the Communities
    strip's flick speed); otherwise it springs back (240ms). Past the first or last tab it
    rubber-bands, a quarter of the pull up to 56px. It's decided after 10px, sideways only if
    further across than up or down; drags starting 16px from the sides are left to the system
    (iOS's edge swipe), and so are ones starting in something that scrolls sideways, an input, or
    `[data-tab-swipe="off"]`. Touch and pen only. A tab not opened yet shows its empty surface
    while it's dragged in (its root mounts when it's switched to). With reduced motion the screen
    doesn't follow; letting go past the threshold switches. Confirm with design.
  - **Switching tabs** (a tap, a swipe, a link to another tab): only the old screen and the new
    one move (320ms, `--ease-out`), the new one in from the inline end when it's further along the
    bar, from the start when it's before; none with reduced motion. The Design Notes say nothing
    about it; the prototype slid the whole row of tabs past, through the ones in between.
  - **Another tab's pushed screens** are unmounted while the tab isn't showing (as the prototype):
    the stack comes back, its view state (scroll) doesn't. Tab roots stay mounted once opened.
  - **"Switch to desktop site / mobile site"**: `selectLayout` reads the stored choice
    (`configKeys.layoutOverride`), but no screen sets it yet (N12, and the web's settings). Nor does
    a resize offer a reload into the other layout.
  - **Outside the tabs**: done (N4). Signed out, every URL but a marketing page is the signed-out
    start (no guest mode, notes §3.1), the URL kept for after sign-in; a session from before shows a
    spinner while it loads, so Welcome doesn't flash (`startEntry`). The marketing pages (Landing,
    Learn, the terms and privacy policy) open on the website in the default browser (`openOnWeb`):
    Welcome's links do, and the app sent to one opens it there and steps back (the start or the
    chats when it was the first page), as a deep link to one already did.
  - **Signed out, the shell's events**: done (N4). The Android app queues its events until
    `svelteReady`, which both trees send only once someone is signed in (`setupNativeApp`). What a
    signed-out screen needs is the screen's own: the window insets (`followWindowInsets`, sent at
    once, and `get_window_insets` for the current ones) and, since N4, the system back, which skips
    the queue too (`triggerBackPressed`): sent at once to whoever listens and dropped when no one
    does, so a press is never replayed on whatever shows after sign-in (components_mobile, which
    listens only once signed in, used to get every press made on its sign-in screens then). The
    intents stay queued until sign-in: deep links, notification taps, shares, calls and token
    refreshes. A bundle taken over the air by a shell from before this still queues back until
    sign-in, and replays it then (in the native tree, on Chats' root, which leaves the app): the
    native tree should only ship (N15) with a shell that has it.
  - **Shares from other apps**: a Direct Share to a chat goes into that chat's draft, as in
    components_mobile; a share for no chat in particular needs the chat picker
    (components_mobile's goes through `pendingShareStore` to its SlidingModals), which the native
    tree doesn't have yet, so it says so in a toast (`native.shareUnavailable`) and drops the share;
    a `/share` link shows the Chats root. The picker comes with N5a or N5d.
  - **The Android app's system bars**: done. Its WebView doesn't report `env(safe-area-inset-*)`
    reliably, so the native root follows the shell's window-inset event into `--safe-top` /
    `--safe-bottom` (`native/systemBars.ts`, through components_mobile's `androidInterfaceSizes`).
    The keyboard's height, which the same event carries, is N5c's.
  - **Cold starts**: what the shell parks (an answered call, a deep link, a notification tap) is in
    `utils/native/coldStart.svelte.ts`, shared by both trees; a cold start opens one of them (a
    call, else a deep link, else a tap), the others dropped. The native router reads its reactive
    `pending`, so one that lands after it first looked is opened when it lands. components_mobile
    keeps its rule: it takes one when its chat list shows, untracked, so taking it never runs its
    effect again into the default chat.
  - An app store build has no Wallet tab (`disableWalletFeature`), but a `/wallet` link still opens
    its stack, with no tab selected.
  - The tab bar's Chats count is the unmuted unread DMs and groups; the design doesn't say whether
    favourites or mentions count (N5a).
- **Native sign in and onboarding** (native N4, #10367; `src/native/features/start`). Built: Welcome
  (the lockup, the Appearance | language pill, the headline, the proof cards, Create account / I
  already have an account, the terms), Pick a username (the live check, the recovery email, the
  inviter card or the referrer row, Continue), the referrer sheet (search, Scan their QR code,
  Paste their invite link, the confirm step), Welcome back (passkey, Link with existing account) and
  Link to your account (CodeTiles, Paste, Link this phone), on the client's operations: `signIn`
  (a passkey, or a linking code: `{ kind: "linking_code" }`, new), `signUp` through the shared form
  (`logic/auth/signUpForm`), the shared referrer (`logic/auth/signUp`, `referrerPicker`). Left, or
  decided against the prototype:
  - **Recovery phrase**: the backend has none (no phrase is made at sign-up, and nothing signs in
    with one), so there's no Recover account screen, no "Recover with phrase" on Welcome back, no
    Recovery phrase screen (reveal, copy, "I've written it down"). The design needs the backend
    first; the prototype fakes it.
  - **Getting started card** (new accounts, top of Chats): not built. It goes on the Chats root
    (N5a), and its last step, backing up the recovery phrase, waits for the phrase.
  - **A photo on Pick a username**: the avatar (the name's initial until a photo) is a button with
    the camera badge; it opens the OS image picker, then a round crop in a sheet
    (`AvatarCropSheet`, the shared `utils/imageCrop` and `svelte-easy-crop`, as src/web's
    `ImageCropDialog`), and the photo shows in the circle. With a photo, the avatar opens a menu:
    Choose another photo, Remove photo. The photo goes with the sign-up (`SignUpForm.avatar`), and
    the client's `signUp` uploads it once the account is made (`setUserAvatar`), without holding the
    sign-up up; a failed upload is logged and leaves the account without a photo.
    TODO(design): the native design has no crop step (the sheet, its "Drag to move it, pinch to
    zoom" hint) nor the photo's menu; confirm with design.
    The cropper itself is still rough around the edges (found testing on Android, 2026-11-06):
    `svelte-easy-crop` in a sheet as it comes, with no native look or feel of its own. A design pass
    on the crop step, then a native cropper to match.
  - **The passkey prompt** comes on Continue (the client's `signUp` makes the passkey, named after
    the username), not on Welcome's Create account as the issue reads it.
  - **Appearance**: the design's menu (`AppearanceMenu`, under the pill at the trailing edge): Theme
    rows (Light / Dark / System, a check on the one picked) and four Accent swatches, live, the menu
    staying open. Not the kit's `AnchoredMenu`, which takes rows only. It writes the stored theme
    and accent the whole app uses, so You → Appearance (N12) shows the same; System follows the
    OS live, and stays the default (the prototype starts on Dark). Its rows and swatches are
    `menuitemradio`s in two groups, valid inside a `menu` (the brief has radiogroups of radios). Its
    shadow is the kit's menu one (`--shadow-menu`, 0 12px 36px at .55) rather than the
    prototype's 0 16px 40px at .35, which no token has.
  - **After sign-in**: the apps' system notifications prompt is the push setup's
    (`setupNativeApp` after sign-in, as in components_mobile; check iOS asks too); mobile web
    asks for none. Then the URL the person was on, "/" going to Chats.
  - **The referrer's chat**: "you'll start in a chat with them" is the app opening a DM with the
    referrer after the sign-up; the backend makes no chat for a referral. Confirm with design.
  - **An invite link opened in the apps while signed out** waits for sign-in with the other
    intents, so its `ref` isn't there for the inviter card; mobile web takes it from the URL
    (`captureReferralCode`). The shell would have to hand over a pending link's `ref` before
    sign-in.
  - **Mobile web**: the start's screens are a stack of their own, not history entries, so the
    browser's Back leaves the start rather than going back a screen. Signing in there is a passkey
    or a linking code only, as in the apps; an Internet Identity, email or wallet account signs in
    from Landing (/home), whose sign-in is the web's AuthDialog. A linking code there makes the
    browser's passkey (new in the client, alongside the native app's): try it with a real code.
  - **Terms and Privacy** open outside the app in the apps (landing paths); on mobile web they're
    the web's pages, which are a placeholder there too (ROUTES.md decision 5).
  - **Small phones** are taken as no taller than 700px (the notes' 375 × 667): the proof cards at
    78% and a 32px headline, a 104px avatar on Pick a username.
  - **The proof cards' text** is fixed sample copy, translated, with the vote's question on one
    line, so the community card in front leaves the vote's numbers showing in every language.
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
  callbacks are still by index (the app has one message per group, so each row's handlers close
  over its message).
- **Message menu, hover bar and swipes** (by hand, 5b): `GroupMessage.menu` says whether a message
  has a menu (by default all but a deleted one; the app gives one to a deleted message it can
  reveal or undelete, and none in a read-only chat). The hover bar shows the quick reactions and
  the 🙂 only with `onReact` / `onReactPicker`, and Reply / Edit only with `onReply` / `onEdit`
  (they did nothing without). `GroupMessage.swipeLeft` puts the app's say on a left swipe (the
  mobile app's `messageSwipeAction`: right replies, left edits your own or forwards someone
  else's), where the design's own text messages swiped right to edit. The bar's position still
  assumes its full width (`BAR_W`).
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
  only `onGif(query)` goes out. The app searches KLIPY today. Still so at 5c (2026-11-05), so the
  composer has no GIF tab yet: it needs results (with a preview URL and size each, and more as the
  list scrolls) and a pick handing one back. The old `GiphySelector`s' KLIPY search (paging, the
  dedupe, the 500ms / 3-character wait, the last-page fix `c1a618b9bf`) moves to a client method
  then, and a pick stages the GIF as the draft's attachment with the text as its caption (the
  mobile app's way; the composer's media tray already shows a staged GIF).
- **Proposals**: `ProposalMessage` isn't in the `GroupMessage` union, so `MessageGroup` can't
  render proposal chats. When it can, a vote that comes back `neuron_votes_failed` should list each
  neuron with its reason, as the old UI does.
- **Prizes** (`features/conversation`, 5a): a prize shows as `PrizeMessage`. `PrizeMessage` takes
  `canClaim` and passes the click to `onClaim` by hand: the design offers Claim to everyone and
  gives no click, which `claimPrize` refuses. Claim shows only where `prizeView` (`@client`, shared
  with the old trees) offers it: not the sender's, not in a DM, not while previewing or lapsed, not
  once claimed, ended or all taken, not to a reader who misses a requirement. A prize carries no
  amount, so a win says "You won". There's no spinner while a claim is on its way (the old trees'
  `claimsStore`), and `PrizeMessage`'s confetti fires on the click, before the claim lands. How long
  it has left is worked out when the row is made and doesn't count down. A prize still being sent
  (`prize_content_initial`) shows as the card it will be, with "Sending prize…" where Claim would
  go (a failed one stays a text bubble, which shows the failure); one in a ledger the registry
  doesn't carry stays a text bubble. No
  reactions, quote or thread yet.
- **Thread replies**: `ThreadPanel` renders replies with no react / menu / reply / edit handlers.
- **Composer banner** (by hand, 8b): `ComposerBar` takes `onBannerAction`, passed to `Banner`'s
  `actionHandler` with `bannerAction` as its label (it had the label but no handler). Nothing in
  the app uses it yet.
- **Composer "+" menu and media tray** (by hand, 5c, to take back to the design export):
  `MessageComposer` (and `ComposerBar`) take `attachKinds`, what the "+" menu offers (all by
  default, no "+" with none): the app offers "Photo or video", "File" and the builders it has
  (5d), each only where the chat lets the reader send what it makes. The media tray's "add more" tile shows
  only with `onAddMedia`: the app sends one photo or video a message (`AttachmentContent` holds
  one), so it gives none. The design's tray takes up to 10, which the backend has no message for.
- **Composer voice format and limit** (by hand, 5c, to take back to the design export):
  `MessageComposer` (and `ComposerBar`) take `voiceMimeType`, what the recorder records in where
  the browser can (the app's mp4, which iOS plays, over the browser's own webm), and
  `voiceMaxBytes`: with it the audio comes in 200ms slices and the take stops for review once it
  holds that much, saying so ("Recording stopped at the size limit."). Without them it records
  as before. `onVoiceActive` tells the host when a take starts and when it's over (sent,
  deleted, or the composer gone), so it holds back attachments meanwhile.
- **The "+" builders, by hand** (5d, to take back to the design export):
  - `SendCryptoDialog` takes `to`, the member picked to start with (the one being replied to),
    where the design starts with no one picked.
  - `PrizeBuilderDialog` takes `pricing` (the host's fees and minimum for an amount among its
    winners: the design priced `fee x (winners + 1)`, with no 5% and no approval fee, and its hint
    then says "Fees of … are added on top", `feesAdded`), `defaults` (what a new prize starts
    from: the settings last used) and `restrictions` (those offered: the app leaves out
    "Authenticated", which the backend no longer has).
  - `SwapOfferDialog` takes `depositFees` (the design priced two fees, with no approval fee), and
    its "locks … incl. 2 fees" lines now say "incl. fees" (`hint`, `locks`). It has no review
    step: the app confirms in a `DialogShell` of its own.
  - To look into (5d testing): the swap offer's UI, from `SwapOfferDialog` to the confirmation it
    hands over to before the offer is attached, could be nicer. The confirmation in particular is a
    plain `DialogShell` of the app's own (the design has no review step), and the two don't read
    as one flow yet. A design pass on both.
  - Not done by hand, for the design export: `MemeFighterDialog` builds memes from templates
    the app doesn't have (the app keeps the Meme Fighter maker's frame); none of the payment
    dialogs has an external wallet picker (the old `SourceWalletSelector`, and the approval fee
    it shows); the dialogs' amounts are `number`s, so a balance past 2^53 units shows rounded
    (what's attached is read from the typed text); their tokens are told apart by symbol.
- **Composer mention list** (by hand, 5c, to take back to the design export, which has no mention
  picker): `MessageComposer` (and `ComposerBar`) take `onMentionQuery` (the "@word" at the caret as
  it changes, `mentionQuery.ts`, spec'd) and `mentions` (`ComposerMention`: the host's candidates
  for it), listed over the text box as a listbox the text box drives (`aria-activedescendant`):
  ↑ ↓, Enter or Tab, Esc, a click; a pick puts "@handle " in place of the word.
- **Calls**: `CallPanel` / `VideoTile` render `MediaStream`s. The app uses Daily's prebuilt
  iframe, which doesn't expose them; it needs Daily's call-object mode (phase 7 decision).
  The call's menu must cope with its chat going away while the menu is open: the legacy desktop
  tree's mobile-width call menu (`MenuIcon`) mounts its items in their own root and read `chat`
  after the call ended (Rollbar #32132).
- **Built-in fallbacks** that should come from the app: Diamond limits and feature matrix (`DiamondDialog`), storage caps and about URLs
  (`ProfileDialog`), the language list (`CreateGroupDialog`), the token colour map
  (`AccessGates`).
- **Types not exported** from `src/features/index.ts` that adapters need: `WalletActivity`,
  `Recipient`, `SwapRequest`/`SwapQuote`, `ExploreCommunity`, `Achievement`, `DailyPuzzle`,
  `ChatSettings`, `SigninMethod` and others. Deep imports work meanwhile.
- **Address validation**: `WalletSettingsDialog` has its own address regexes (BTC, ETH, XRP,
  ICP), which differ from `lib/networks.ts` and know no Solana. The app doesn't use its recipients
  section (only reachable through `section`): saved recipients are `WalletRecipients`, which takes
  the host's say on an address (`checkAddress`, by hand: the old address book's rules, so Solana and
  ICRC subaccount forms save and XRP doesn't).
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
- **Scrollbars, by hand**: `global.css` styles every scrollbar as the design's docs do (thin, a
  grey thumb, no track). The export only styled them in its docs.
- **Designs needed** (to ask for in the next export):
  - **Log out confirmation**: `ProfileDialog`'s own confirmation (the avatar, name and handle, "log
    out of … ?", Cancel / Log out) is a placeholder card that needs a proper design, including its
    busy and failed states.
  - **Buying with CHIT**: the dialog that asks to pay CHIT for a premium item, such as the custom
    profile background (50,000 CHIT, `PremiumItem`), and also the emoji packs. It needs the item,
    its price against the user's balance, Pay / Cancel and the paying state, and what to show when
    the balance is too low (today: "Keep collecting!" with Pay disabled), e.g. how to earn more.
    The new UI shows it as a `DialogShell` with the old UI's words for now
    (`features/profile/PremiumItemDialog.svelte`, `TODO(design)`).
  - **Token price card**: the card a cashtag in a message opens (`$CHAT`, or a coin OpenChat
    doesn't list such as `$ADA`, `<cash-tag>`): the token's logo (coins have none), name, price now,
    its change over 7 days and a chart of its last 7 days' prices (from the price service,
    `getPriceHistory`) which shows the price at any time when hovered, dragged along or moved
    through with the arrow keys, its high and low marked, and gridlines at round prices
    (`features/cashtag/PriceChart.svelte`, from `logic/priceChart`), with loading and no-history
    states, and where the prices are from ("Price data by ICPSwap" or "by CoinGecko", linked). Its
    symbol is under its name unless it's the same. The new UI shows it as a `DialogShell` laid out like the
    old UI's card (`features/cashtag/TokenDialogScreen.svelte`, `TODO(design)`). The chip itself is
    the shared `<cash-tag>` web component, coloured from the text it's in, with a coin's credit as
    its tooltip.
  - **Price chart message**: a chart a bot such as ChartBot posts (`price_chart_content`): its
    title, each token's latest price and change (a symbol opens that token's price card), the same
    chart as the price card, with several tokens' lines in `PRICE_CHART_COLOURS`, and where its
    prices are from, linked. The library has no bubble for it, so the new UI shows its title as
    text (`contentText`); the old UI's is `PriceChartContent.svelte`, and the chart itself is
    `features/cashtag/PriceChart.svelte`. On a phone the chart has to shrink to fit the bubble: the
    mobile tree's was a fixed 22rem, wider than the bubble, so its end was cut off.
  - **MiniApp message**: a bot's card for a game, or another app, it hosts (`mini_app_content`): its
    image, in the user's theme (`miniAppImageSrc`), markdown text, the bot's app, players (avatars
    and names, "2 of 4 playing", whose turn it is), how many are watching, the result once finished,
    as markdown with links turned off so that
    `@UserId` shows a user's name as it is now, and Join / Leave buttons, from
    `miniAppCardView`, which shows the MiniApp service's live card (`miniAppCardsStore`, followed with
    `client.followMiniApp` once the card's in view) or else the one stored in the chat. Join and leave
    go through `logic/miniApp/miniAppActions.svelte.ts`. The app (the bot's endpoint + `/app`, from
    `utils/miniApp.ts`) is shown in the card, in a sandboxed frame with a bar naming the app's host and
    a full screen button (about 30px across, as a smaller one was hard to hit on a phone's card;
    going full screen and back puts focus in the app, or a game's keys press OpenChat's buttons),
    while the card's on screen (`logic/miniApp/miniAppFrame.svelte.ts`), for a player or, if the
    game allows spectators, anyone, who's then watching it;
    `logic/miniApp/miniAppHost.svelte.ts` relays between the app and the service, and says when the
    app, drawn unseen until then, is shown in place of its image (`revealed`). The library
    has no bubble for it, so the new UI shows its text (`contentText`) without the rest; the old
    UI's are `MiniAppContent.svelte` and `MiniAppFrame.svelte`.
- **`ProfileDialog`, by hand** (8c, to go back to the design export): `sections`, the sections
  its nav offers (a host that has built only some); the cover and photo edit buttons only with
  `onCoverEdit` / `onPhotoEdit`; `engagement` counts as numbers; `memberSince` from `joined` in the
  host's locale; a chats & calls toggle the host didn't take goes back; the cover and photo edit
  buttons keep their surface on hover (the design's hover tint alone let the image show through);
  `qrCode`, the invite's QR code drawn by the host (the dialog's own needs a global `qrcode`
  library); the storage section's "report a problem" row only with `onReportIssue`; the storage
  meter only with an allowance above 0; `aboutPages`, the About pages the host has; an empty
  communities section says so; "Just linked" only for a sign-in method linked in the dialog, in
  place of the host's `used` (which would say the day it was linked), and no empty "last used"
  line; the delete flow's CHIT step for a user who has never earned any says they haven't
  discovered it yet; a host step in the sign-in "add" form that rejects with `{ reason }` shows
  that reason in place of the generic one (linking a method says why it couldn't, e.g. the
  sign-in provider limit), and one that rejects with `{ cancelled: true }` says nothing (closing
  the confirming sign-in); Diamond opens from it without its exit (`DialogFlow.handOff`), so the
  backdrop stays while the next dialog animates in (`DialogScreen` keeps it); the CHIT claim day
  does nothing without `onChit` (the app's `onChit` opens the CHIT dialog);
  `puzzleSetting`, so a host without a daily puzzle setting leaves it out; "Ways to earn more"
  only with `onEarn`; `onClaim`, the calendar's Claim made in place with a "Claiming…" state; a
  day before `joined` isn't a missed one; `onCopyUserId` (`CopyButton`'s `onPress`), so the app
  can say the user id isn't a wallet address before it's copied, in `ConfirmDialog` (no design
  for it: `TODO(design)`).
- **`ProfileDialog` against the app** (8c):
  - the CHIT settings (`disableChit` and the others) are kept in each origin's browser storage,
    as the old UI keeps them, so turning CHIT off in the old UI doesn't reach the new one on
    another origin;
  - the profile fields save one at a time, and any failure shows as "couldn't save": the reason
    the backend gave (`ProfileFieldErrors`, e.g. "display name too short") isn't shown;
  - the username is checked against looser rules than the app's (3 characters and up, where
    `isUsernameValid` wants 5), so a name the app can't take says "taken";
  - no read-only state for a suspended user: an edit fails to save instead;
  - the account's Status row always says Online;
  - a community name the backend turns down shows "couldn't save your name", not why (too short,
    invalid …: `memberDisplayNameResult` has the reason);
  - the invite section's list of what inviting earns (`inviteRewards`) stays empty: the app has
    no such data to show;
  - the storage section's "report a problem" isn't offered: the app has nowhere to send a report;
  - About has no metrics link: the app has no metrics page;
  - CHIT: the claim calendar (since 8e its own dialog, `ClaimHistoryDialog` on `?chit=calendar`,
    opened from the CHIT section's "Claim history" and the CHIT dialog) shows the daily claims
    (and insured or reinstated days), not the old
    calendar's every CHIT event (achievements, referrals, puzzles, premium items); a day is the
    user's own (the backend counts a streak in the user's time zone), not the UTC day the dialog
    describes, and a claim's streak day is worked out from the days before it, so it loads the
    whole history; the backend doesn't say which zone each claim was made in (its
    `utc_offset_updates` aren't exposed): insured and reinstated days are known exactly, and so
    is the claim before a run of insured days (the day before them); any other claim is placed in
    this browser's zone, then kept before the one after it and after the one before it (the
    older moving back where two collide), so a user who claimed for a while from another zone can
    see some of those claims a day off (low priority, display only: the exact fix is for
    `chit_events` to give each claim's day, which the backend can work out from its offsets); the
    backend can count one claim on two days after a move east (it claims in the old zone, then in
    the new one), which the calendar shows as it counts it (a backend issue, older than the new
    UI); a claim support reinstates for an older day shows once the dialog is opened again, as a
    reload reads from two days before the newest event it has (low priority: rare, and it
    corrects itself); no daily puzzle setting (the app has none to show or hide the puzzle, or to
    remind of it: 8d), no "Ways to earn more" (the achievements dialog is 8d), and the calendar's
    `today` is the user's date too, not UTC's; the old profile's streak
    insurance summary has no place here (8d's `StreakInsuranceDialog`);
  - sign-in methods: linking a passkey or an Internet Identity confirms it with the sign-in dialog
    (signing in again, no design), offering only the way this session signed in; the dialog's
    checklist has no step for it, so "Confirm with your …" waits while that dialog is up; the
    dialog has no place for Ethereum, Solana or NFID, so those aren't listed; unlinking that
    fails says it couldn't, not why (`unlinkIdentityFailure` has the reason); email links by a
    typed code in the design, by a link the app polls in the app, so the email step isn't
    offered;
  - deleting the account: the third step's "stay for the CHIT" (`onChitBribe`) does nothing more
    than staying; signing in again is the sign-in dialog (no design, as Forgot PIN's);
  - the cover's edit button is passed `isDiamond`, but the app's rule is a premium item: a
    custom profile background costs 50,000 CHIT once, for anyone (`PremiumItem`), so the
    dialog's Diamond hint doesn't apply;
  - no design for cropping a picked avatar or cover, nor for paying CHIT for the premium item:
    both are `DialogShell`s (`features/profile/ImageCropDialog`, `PremiumItemDialog`,
    `TODO(design)`). The cover is cropped at desktop's 600×800 (`utils/imageCrop.ts`); the
    mobile app saves it at 600×300;
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
  The wallet's Send uses this prompt too, not its own PIN step (`WalletSend`'s `hostPin`, 6b): the
  client asks only when a PIN is set, and checks it itself.

- **User card** (4a, `features/user`): `UserDialog` has no badges, so the old card's Diamond,
  streak and CHIT-earned badges (`userBadges`) don't show; CHIT earned is one of its facts
  instead, left out when the viewer has turned CHIT off. Also missing from the old card: the
  member's role in the chat (`WithRole`), the "last online" wording (only the online dot shows),
  and a way to your own profile from your own card (the old card's Settings button; `?profile`
  is 8c's). The bio is Markdown, as in the old cards: `UserDialog` takes `aboutContent` and
  `DetailSection` `children` (by hand).
- **Sender click** (4a, by hand): `MessageGroup` takes `onSenderClick`, so a sender's avatar or
  name opens their card, as in the old UI. The design doesn't show them as clickable.
- **Suspend and unsuspend** (4a, by hand): platform moderators suspend or unsuspend a user from
  their card. `UserDialog` takes `moderatorAction` (a label and a callback) and shows it in its
  footer as a second danger action; the design has no place for it (`TODO(design)`). Suspending
  opens a plain dialog on `DialogShell` with the old modal's words and a reason
  (`SuspendUserDialog`, `TODO(design)`).
- **Gates editor** (4a, `features/access/gates.adapter.ts`, for 4b and 8b): `AccessGates` takes
  `types` (by hand), and the app doesn't offer the unique-person gate (suspended) or the
  credential gate. A credential gate already set still shows and saves unchanged, but adding one
  wants a credential picker from the design. Also:
  - a community's "referred by a member" gate (and any NFT gate) has no row type: it isn't shown,
    and saving keeps it, as the old editors' hidden unique-person gate is kept;
  - payment and balance gates share one token list, so balance gates offer only the tokens a
    payment gate can take (ICRC-2, or a nervous system's ledger); the old balance editor offered
    every token. A balance gate already set on another token still shows, by its ledger id;
  - the old editors allow at most 10 gates; `AccessGates` has no limit;
  - a gate on a token the app doesn't know shows no amount (its decimals are unknown), and saves
    unchanged unless edited.

- **Group panel** (4a, `features/group`): `GroupPanel` in the right column for groups, channels
  and communities, with members (what the viewer may do to each comes from the app: `actions`, by
  hand), lapsed and blocked users, pinned messages, rules, gates and user groups. Still missing:
  - editing: settings, invite, delete, permissions, gates and user groups open 4b's dialogs, so
    those entries are off until 4b (`detailsPermissions` is ready for them);
  - mute: the app has no mute durations, so the panel's "8 hours" and "1 week" mute until
    unmuted. A community mutes all its channels, and can't unmute them all from here (as in the
    old menus);
  - the Video call tile does nothing until 7b, and Favourite isn't wired;
  - `?usergroup=` opens the user groups view, not the one group (`viewRequest` can't name one);
  - the owner and admin counts are of the members held, which for a large chat is its first page.
  - by hand: the cover's × calls `onClose` (it had no handler), and shows as a back arrow
    (`back`) when there's an earlier panel to return to.
  - the conversation header's pin icon (shown when the chat has pinned messages) opens the
    pinned view; the old one also marked unread pins with a dot, and the header's extra icons have
    no accessible label (`ConversationHeader` takes none).

- **DM panel** (4a, `features/dm`): `DmPanel` in the right column for a DM. Changes apply at once
  (the old desktop panel had a Save button); turning disappearing messages on starts at a week.
  By hand: `chit` is optional (left out when the viewer turned CHIT off), `aboutContent` renders
  the bio as Markdown, and `DmChatSettings` hides read receipts without a handler, since OpenChat
  has no read receipts setting. Not wired yet: the panel's ⋯ menu (no items), calls (7b), and the
  old panel's durations other than the six `DmChatSettings` offers (a TTL set elsewhere shows as
  its own length, "2 hours", and saves unchanged).

- **Leave, delete, archive and block** (4b part 1): the conversation header, the chat-list rows,
  the community header and GroupPanel open `LeaveGroupDialog` / `DeleteGroupDialog` through the
  dialog host, and the client's `leaveOrDelete` does the rest. The menus are the app's, passed as
  `menuItems` (the library's defaults offered Delete for the OpenChat bot, Leave to everyone, and
  no Unblock, delete community or mute all):
  - by hand: `DeleteGroupDialog` takes the noun `chat` and `typeToConfirm`, so deleting a DM asks
    without the name being typed (the library had no confirm for a DM).
  - by hand: `ChatRow` stops a click on its menu reaching the row. It also opened the chat, which
    closed the dialog the item had just opened and un-archived a chat as it was archived.
  - after deleting or leaving the open chat, the client clears the right panel, but a wide
    screen's column stays open and shows the chat the list opens next (with nothing in
    `rightPanelHistory` it shows the selected chat's details, S1).
  - a channel's header now offers mute and @everyone mute, as the old menu did (the library's
    channel menu had neither).
  - GroupPanel's menu shows Leave to everyone; the app opens the dialog only for someone who can
    leave, so for anyone else the item does nothing.
  - not offered: freeze and unfreeze (platform moderators, no dialog), suspend, report, and the
    desktop row's swipe-to-remove (Remove chat is a row menu item instead).
  - the row menus offer every item with a dialog (pin, archive, leave or delete, remove) on every
    kind of row, by Julian's choice; the design gives DM and group rows only favourite, mute and
    mark read.
  - the community header's Invite and new channel items, and the conversation header's Invite,
    Convert, Import and webhook items, come with 4b's later parts.

- **Manage** (4b rework 1, the design's Modal model): `ManageDialog`, one dialog per group,
  channel or community with a nav down the side (`features/group/ManageDialogScreen.svelte`,
  `logic/groupOrCommunity/manage.svelte.ts`). It holds Overview (or About), Members, Invite &
  share, User groups, Rules, Permissions and Access gates. Members and User groups are
  GroupPanel's own views, embedded (`GroupPanelView`). Overview, Rules, Permissions and Gates are one settings
  form, so moving between them keeps the draft; leaving the form or closing with unsaved edits
  asks "Discard changes?".
  - by hand: `ManageDialog` is new in the library. The design has it only in the App prototype
    (`_manageVals`), with no exported component.
  - Bots: GroupPanel's bots view, its bots part: the installed bots (a group's, or a channel's
    community's) and, for someone who may manage them (`canManageBots`), up to 20 to add
    (`exploreBots`). Either opens `BotDialog` (`BotDialogScreen`): details, install, change
    permissions or remove, saved through `BotInstall` as the old installer did.
  - by hand: `BotDialog` takes the host's permission list (`permissions`): the bot's own
    permissions with the app's words, under "Command permissions" / "Autonomous permissions" ·
    Chat / Community / Message. What's granted is exactly what's toggled on (`grantedFromDialog`);
    nothing is mapped onto the dialog's built-in eleven. Its summary sentence lists the app's
    labels.
  - a new install starts with every permission off, as the design has it (the old installer
    started with everything the bot asked for on), so Install straight away grants nothing.
  - the new UI has no way to register a bot (the old mobile UI's Explore → Register a bot does),
    and no command picker in the composer to run one.
  - the bots to add are the first 20 the directory offers (GroupPanel's search filters those);
    with none installed and none to add, the page has no empty-state text for the owner.
  - Webhooks (a group's or channel's owner, `canManageWebhooks`): GroupPanel's bots view, its
    webhooks part, lists them; Register and a webhook's row open `WebhookDialog`
    (`WebhookDialogScreen`), saving through `saveWebhook` (only the name or avatar that changed,
    `webhookChanges`). A new webhook opens straight away in edit mode to show its URL, which holds
    its secret.
  - by hand: `WebhookDialog` has Delete webhook in edit mode, with a confirm step, as the old
    pages had remove; the design has no way to remove one.
  - a webhook's colour isn't stored: without a photo it gets its id's colour.
  - no Stats page: the design's `GroupStats` shows the last 30 days, a 12-week series and the top
    senders, and the backend keeps only all-time counters (`metrics`). Showing those as the last
    30 days would mislead, so it waits on the data (see Community stats).
  - Convert to community and Import into community (a group's owner, under Advanced) open
    `ConvertToCommunityDialog` / `ImportToCommunityDialog` over Manage, then the community, as the
    old pages did. Import lists the communities you own; with none it says so and doesn't open.
  - a community's Channels page lists the channels you're in (the community's summary holds
    no others), each opening that channel's Manage with a back arrow to Channels. Manage reads the
    open chat, so a channel that isn't open is opened first.
  - New channel (Channels, and the community menu's New channel / Add embedded channel) opens
    `CreateGroupDialog` in channel mode, not the design's bare `NewChannelDialog`, by Julian's
    choice: it has what editing a channel has (photo, switches, members, gates, rules,
    permissions). The result becomes the channel the same way an edit does (`candidateFromCreate`
    → `candidateFromSettings`), and the new channel opens. Community members picked are added to
    it (`createGroup`'s `toAdd`), and people from outside the community invited.
  - an embedded channel starts public (the dialog's default) while its hint says channels are
    private by default.
  - by hand: channel names aren't slugged (the design lowercased them and turned spaces into
    hyphens; the backend has no such rule). A name is 3 to 40 characters.
  - choosing public or private isn't checked against what the community lets you create; the
    backend refuses one you can't, with the generic "couldn't create" message.
  - the right column shows GroupPanel's quick panel for a group or channel (cog for someone who
    can edit, info otherwise); its views open Manage, except pinned messages. A community has no
    panel: its header, its menu's Members / Invite / Edit community, and a channel's community
    link open Manage. A panel asked for members (?everyone, ?usergroup=) or a community's details
    opens Manage instead.
  - the quick panel's "Online now" has no presence data yet (see Presence).
  - a DM's name, the header menu's Chat settings and DmPanel's View profile open the other
    person's card with the design's Profile / This chat tabs (`dmTab`): This chat has the DM's
    mute, favourite and disappearing messages (no read receipts, see above).
  - which pages show follows the app's permission rules (`detailsPermissions`), not the
    prototype's roles: someone who can't edit gets About and read-only Rules and Gates, and no
    Permissions; Invite & share shows with `canOpenInvite`, and User groups with
    `canManageUserGroups` (as the design, which offers them to managers only).
  - Manage opens from a group's or channel's name (with the design's chevron and hint), the
    header menu's first item ("Manage group", or "Group details" without edit rights), the quick
    panel's cog, and the community header and its menu.
  - the header menu follows the design's (`_chatMenu`) but has no Share to chat (the picker is
    built, 4d, but this item isn't wired to it yet) and no Report (no report flow yet); a DM keeps Delete chat, which the design leaves out.
    The community menu has no Stats or Add a bot until those pages land, and no longer mutes every channel (the community's About page does).
  - a channel's Manage has no back arrow to its community yet (the community has no Channels
    page).
  - the frame below 768px is the desktop frame at full screen with a narrower nav; the design has
    no narrow layout for it.
  - the nav's subtitle and the About page say "1 members": the app's `memberCount` has no plural.
  - a member's read-only Rules page still shows the editor's character counter and hint.
  - Invite & share's page title says "Invite and share" (InviteDialog's own string).

- **Create a group or community** (4b): `CreateGroupDialog` (`features/group/CreateGroupDialogScreen.svelte`)
  from the chat list header's Create new group and the rail's Create community. The result is read
  as an edit is (`candidateFromCreate`, `candidateCommunityFromCreate`), created through
  `UpdateGroupState` / `UpdateCommunityState`, and then opened.
  - a community needs Diamond: without it the rail opens the Diamond dialog. A guest is sent to
    sign in (from the rail or Explore), and creating carries on once signed in, wherever they
    are: AppScreen resumes it (`postLoginCreateCommunity`, as the old desktop Explore and mobile
    Home did).
  - by hand: `CreateGroupDialog`'s community defaults are all admin (the app's and the backend's),
    and a community shows no message permissions or Messages / Threads tabs.
  - by hand: the form is locked (inert, dimmed) while the create is in flight.
  - the invite list starts empty: people are found by searching (no frequent contacts).
  - Explore's create (8a) opens it too (`openCommunityCreation`, shared with the rail).
  - a community's language is one of the app's (`supportedLanguages`, by the app's code, the
    codes the old editors and Explore's filter use); the dialog's own list (`ja`, `zh`, `pt` …)
    isn't offered, so a new community can always be found by its language.
  - a failed community create (e.g. the 10-community limit) says only "Sorry we were unable to
    create your community", and that toast showed twice in one headless run though the app shows
    it once.

- **Group and channel settings** (4b part 2a): GroupPanel's Settings opens Manage on its settings
  pages: `GroupSettingsDialog`, embedded, on `UpdateGroupState` (`features/group/ManageSettings.svelte`,
  through `settings.adapter.ts`). Someone who can't edit the chat gets its About page instead
  (`chatManageAccess`), from the same menu item, which reads "About the group" for them.
  - by hand: `GroupSettingsDialog` takes `readOnlySections`. Permissions, disappearing messages
    and Public are read-only to a non-owner, as in the old editors (`canChangeVisibility`).
    "Visible chat history" is always locked when editing, because the backend's update has no
    field for it. A read-only Permissions page keeps its General / Messages / Threads tabs.
  - a public group's "Start a call" isn't forced to admins. Old desktop did that and mobile
    doesn't; the backend doesn't require it, so this follows mobile.
  - a channel's settings still say "Group settings", "Group name" and "Group photo". The
    dialog's `noun` is only `group` or `community`.
  - a group made in the old UI counts several permissions as "changed from the defaults". The
    dialog's defaults aren't the app's (`defaultChatPermissions`).
  - by hand: GroupPanel offers Settings to everyone, as About for someone without edit rights.
  - the confirm for a verified group's rename and for a change of visibility is the app's
    (`DialogShell`, `TODO(design)`). Declining it keeps the edits, and the dialog says it
    couldn't save.
  - a picked avatar is cropped to its middle at 150×150, because the dialog has no crop step.
    The colour and cover swatches aren't stored, so they come back to their defaults.
  - the About page's rules link opens Manage's Rules page.
  - with edit rights, GroupPanel's menu also shows Convert, Import and the new channel items.
    They do nothing until parts 4 and 5.

- **Community settings** (4b part 2b): the same dialog, with `noun: "community"`, on
  `UpdateCommunityState`. It opens from GroupPanel's Settings and from the community header's Edit
  community. `communityManageAccess` makes permissions and Public read-only to a non-owner, and
  gives the About page to someone who can't edit.
  - by hand: in community mode the dialog leaves out what a community doesn't have: the
    message-related general permissions (delete, pin, react, @everyone, calls), the Messages and
    Threads tabs, the history and disappearing switches and their About facts, and the
    moderator and nobody roles.
  - a picked banner is cropped to its middle at 600×300.
  - the community About page's Mute mutes every channel and can't unmute (as in the old menus).
    Tapping it while muted says "That didn't go through" when it can't, not why. It has no
    Favourite, because a community can't be a favourite.
  - the primary language isn't in the dialog, and is kept as it was.
  - removing an avatar or banner in the dialog saves nothing. `groupChanges` and
    `communityChanges` turn a removed image into "no change", because the client has no way to
    send a removal. Groups have the same gap.
  - community mode still says "Group settings", "Group photo", "Group name", "Public group" and
    "Enable rules for the group". The dialog's community words are only for the cover and the
    permissions.
  - GroupPanel's community Permissions summary counts changes against the group defaults,
    message permissions included, so it reads far more than the dialog's badge.
  - Esc while the dialog's role picker is open closes Manage, not the picker (with unsaved edits,
    it asks first).

- **Invite** (4b part 3a): Manage's Invite & share page (`InviteDialog`, embedded, on
  `MemberManagement`, `features/group/ManageInvite.svelte`) opens from GroupPanel's invite and
  share buttons, the conversation header's Invite and the community header's Invite.
  - by hand: `InviteDialog` takes `onSearch`. Invite searches the community's members and then
    everyone (`searchUsersForInvite`), and Add searches the community (`searchCommunityMembersToAdd`),
    as both old trees did.
  - the dialog says how many invites went or failed. The app adds its own toast only for a
    partial add ("group.addMembersPartialSuccess") and a failure's reason.
  - nobody is listed before you search; the old pages listed nobody either.
  - resetting the link doesn't ask first; the old pages did ("invite.confirmReset").
  - no QR code, and invited-but-not-joined people aren't listed.
  - it opens for a private channel too (its Add tab) and for any member of a public chat (to
    share its link), as the old header menu did (`canOpenInvite`).
  - a failed invite or add shows two toasts: the dialog's "That didn't go through" and the app's
    reason.
  - the Add tab shows an empty "<community> members" heading until you search, because the app
    passes no members up front.
  - a public chat's link shows a switch locked on, and the warning that access gates are skipped
    for people joining by link. Switching a private link on takes a few seconds with nothing
    shown meanwhile.
- **Chat picker** (4d #10115, `features/share`): `ChatPicker`, listing the chats the user can send
  text in (`shareTargets` in `@client`, which both old pickers now use too), in the old pickers'
  sections (favourites, direct chats, groups, each community's channels), searched by name or
  @username, the open chat left out. A DM's line is its last seen, a group's its description or
  size. Faces are the chat list's swatches (`swatchFor`), not uploaded avatars (see Swatches).
  - `/share?title&text&url` opens it over the default page (`?share`): picking a chat opens it with
    the shared text, after the user's message, in its draft, as the old trees do. Nothing is sent.
  - Invite & share's "Share to chat" (in Manage) sends the link (and the message) to the chosen
    chat at once and stays on the page. A group's or channel's link isn't offered to itself; a
    community's goes to any chat, its open channel included. Backing out of the chat's rules or the PIN sends nothing
    and says nothing; the picker stays open.
  - by hand: `ChatPicker` takes `filter` (the host's search), `emptyLabel`, and each chat's `sub`
    and `group` (the sections); `InviteDialog` takes `filterChats`, and its `onShareToChat` may
    resolve `false`; `Avatar` exports `AVATAR_GRADIENTS` for the picker's faces.
  - forwarding a message uses it too (5b, `ForwardDialogScreen`), one chat at a time;
  - not yet: Receive's "Share to chat" (6b, with `SharePicker`), a daily puzzle
    result (#10236). The picker has no recent chats order (the design's "Recent chats"): sections
    are sorted by name, as the old pickers did.

- **User groups** (4b part 3b): `UserGroupDialog` creates, edits and deletes a community's user
  groups from GroupPanel's user group views, for someone who may manage them
  (`canManageUserGroups`). The client sends an edit's members added and removed
  (`saveUserGroup`), as both old editors did.
  - the dialog lets a name be 1 to 40 characters, but the backend takes 3 to 25 (the old editors
    stopped you). A name outside that fails with "unable to create/update the user group".
  - spaces in the name are saved as underscores, as the old editors did, but the dialog shows
    the spaces until it's saved.
  - a failed save shows the dialog's "Couldn't save the user group" and the app's reason (name
    taken, the member limit) as a toast.
  - a member whose user hasn't loaded shows their id until it does.
  - `?usergroup=` still opens the list of user groups, not the one group.
  - by hand: `MemberRow` stops a click on its ⋮, action button or icon reaching the row. The
    user group row's ⋮ opened the group instead of its Edit / Delete menu.

- **Design pass 6** (2026-11-03, with the native export): ported by hand (EXPORT-LOG). In the app:
  a forwarded latest message puts the forward icon before a chat row's preview
  (`latestForwarded`), the chat list's second section is "Chats", the composer's typing line is a
  strip resting on it (two names: "A and B are typing"), sign-up takes a pasted invite link
  (`resolveReferrer`: its `ref` is the referrer's user id; bots and suspended users, whose referral the sign-up refuses, are neither found nor searched for, `canRefer`) and says "Invited by" for the link's
  referrer, and Swap shows only the best quote. Not yet:
  - `NavRail` pins take a `menu` (right-click, Shift+F10), but the rail adapter gives the
    community pins none: the community menu's actions live in the chat list header for now.
  - `ChatPicker`'s multi-select (forward to several chats; the old trees forwarded to one, as 5b
    does), `ChatListPanel`'s grouped search
    (people and messages need search in the app), the design's `MediaViewer` (replacing
    `features/conversation/MediaViewer.svelte`) and `PuzzleDialog`'s screen layout (native) are
    separate pieces of work.
  - `AccessGates` no longer offers credential gates (retired by the design; one already set still
    shows) and has no NFT gate. The app doesn't pass `types` (`OFFERED_GATE_TYPES` is unused), so
    unique-person gates are still offered though suspended.
  - the design's typing line in the conversation header is left out (not used).
  - a saved recipient's token lock should win over the host's `sendToken` (design order: lock,
    then the network's token); the app sets no locks, so it doesn't show.
- **`CommunityPreviewBar`** (8b, ported by hand from the design's 2026-11-04 export, source hash
  `61a2b9f0`): replaces the composer while previewing. By hand on top of the design (to take back
  to it): `avatarUrl` (the community's avatar over the gradient, as `ExploreCommunities`), `busy`
  (a join on its way: a spinner in Join, which takes no clicks; the design has no in-progress
  state) and `joinDisabled` (a locked gate: Join greyed). The app also uses it for a group or a
  channel of a joined community (the design only has a community's): the group's name, "Join
  group" / "Join channel" (`joinGroup`), and the app's own hints ("Join to send messages.", and
  for a gated one "Joining has N requirements …", `access.previewHint` / `access.previewGatedHint`),
  since the bar's copy speaks of channels. A lapsed member gets "Re-join …" (`access.lapsed.rejoin`)
  with "Membership lapsed" as the hint and no Back, under the design's "You're previewing {name}"
  title; a locked one "Locked" (`access.lockedGate`) with Join disabled and `access.lockedGateInfo`
  as the hint. Both need the design's say.
- **`JoinGateDialog`, by hand** (8b, to take back to the design export): a gate's `id`, handed
  back with its payment in `onJoin`'s `paid` (so the app approves the gate's own `bigint` amount and
  knows which branch of an "any" gate was paid; added only when the gate has one, so the export's
  own spec is unchanged); `lifetime: false` on a diamond gate (any Diamond membership: "Diamond
  member", met for any member, "Get Diamond"); and kind `other` (`label`, `detail`, `met`, `icon`), a
  requirement the app checked itself, for the gates the dialog has no row for: CHIT earned, a
  credential, locked, referred by a member, an NFT, and a payment or balance on a ledger the
  registry doesn't carry. `Gate` moved to the module script so the app can import it. Not asked for
  (no design yet):
  - a credential gate can't be verified in the dialog (the old desktop's Internet Identity
    popup, `verifyAccessGate`): it shows as an unmet requirement, so a chat that needs one can't be
    joined from `src/web` yet;
  - no level indicator: a gated channel in a gated community shows the community's requirements,
    then the channel's, in a dialog each, both titled "Join community" and named by the level's
    `collectionName`;
  - amounts are `number`s (display only: the app approves the gates' own `bigint`s), tokens are
    picked by symbol (two ledgers with one symbol would share a balance), and the owner / treasury
    split is shown as `amount × ownerShare` in floats (the app's split is `paymentGateSplit`);
  - a balance gate on the ledger of a payment in the same gate doesn't count the payment against
    the balance (the old evaluators did, `balanceAfterCurrentCommitments`);
  - the neuron confirmation is one toggle: an "any" gate with two neuron branches can't say which
    one was meant (the app confirms the first);
  - the Lifetime Diamond pitch ("60 CHAT, once") is the library's own copy;
  - nothing says which gates the backend found unmet (the old `AccessGateCheckFailed`): the app
    toasts "Access gate not met".
- **`ExploreCommunities`, by hand** (8a, to take back to the design export): a community's
  `avatarUrl` and `coverUrl` (images over the swatches, as `NavRail`'s pins); `languageOptions`
  as `{ code, label }` (the filter picks by code, shows the label and the code's flag; the app's
  old codes `cn`, `jp`, `iw` have flags); `initialQuery` / `initialLanguages` (the URL's
  `?q=&lang=`, or the saved filter, on opening; an initial text shows the results passed, not
  "Searching…"); `initialScroll` / `onScroll` (the scroll position kept across visits); `failed`
  (a page the component asked for couldn't be loaded: an error with Retry in place of the page
  before it, or Retry on Load more, with the component left as it was; no design for it).
  Not asked for (no design yet):
  - the sorts (Most members / Most active / Newest) are hidden (`showSort={false}`): there's one
    ranking (see Explore under the data the backend doesn't have). #10405 adds a sort to
    `explore_communities`; then the screen shows them and asks again on a change (today a change
    of sort would be answered from the results held, `exploreQueryAnswered`).
  - no place for a community's moderation flags (the old cards labelled adult and offensive
    ones, `serialiseFlags` in both old `CommunityCard`s); when the design has one, it moves to
    `@client`, returning `ResourceKey`s.
  - no offline state of its own: with nothing loaded and the app offline, the screen shows the
    library's offline `EmptyState` (Retry) in the component's place, as the old Explores did. A
    first page the screen asks for itself that fails (on opening, after the viewer's flags
    change, for a URL changed from outside) shows the error one (the offline one when offline),
    and Retry asks for it again. One the component asks for (typing, a language, a sort) fails
    inside it (`failed`, by hand), so it isn't torn down mid-interaction.
  - no scroll-to-top button (both old Explores had one).

## App

### Data the design shows that the backend doesn't have

- **Wallet**:
  - no 24h price change. A 7-day price history comes from the price service
    (`getPriceHistory`, hourly) where there is one (`OC_PRICE_SERVICE_URL`);
  - transaction history only for tokens with an index canister, one token at a time. There's no
    all-tokens activity, swaps aren't told apart from transfers, there's no chat context, and
    BTC/EVM/SOL-side transfers aren't shown;
  - saved recipients have no id, token lock or "last sent", and an edit only renames (the canister
    keys a saved address by its account);
  - no native ETH deposit address.
- **Explore**:
  - one server ranking, so no featured vs popular lists and no sort by members, activity or
    newest (#10405; the sorts are hidden until then): the component cuts Featured and Popular
    from the page it has (the biggest public communities not joined);
  - results have no created date, activity metric or channel list (the big cards' channel line is
    empty).
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
- **CHIT** (8d): no place on the leaderboards for the user below the top 10 (`ChitDialog`'s
  `boardRank` / `boardScore`, `LeaderboardDialog`'s `you`), so the trophy says "Leaderboard" and
  the dialog shows the user's place only on a board they're on. Today's claim amount, the
  milestones and what each achievement pays are the backend's tables mirrored in `@client`
  (`dailyChitAmount`, `CHIT_STREAK_MILESTONES` from `chit_for_streak`; `achievementReward` from
  `Achievement::chit_reward`), so a change there needs one here too.
- **Sign-in**: not carried over from the old sign-in yet:
  - the old form's prompt when a referral code is turned down ("proceed" without it, or cancel
    and sign out): the form says why, and signing up again goes ahead without the code (the
    client won't send it again); closing signs out;
  - the guidelines shown in a popup at sign-up (`AuthDialog` links to `/terms`, a placeholder
    until the legal pages exist);
  - the onboarding dialog's language picker and Logout link (closing sign-up logs out instead);
  - the Solana adapters' own icons (Phantom has none here).
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
- **Landing's featured communities**: no API returns a featured or hot list as such, so after
  the OpenChat community Landing shows the top of Explore's one ranking (see "Landing" under
  Wiring).

### Wiring

- **Wallet** (6a #10120, `features/wallet`, the design's changes of 2026-10-27): `WalletPanel` on
  the left and `WalletMain` in the middle, on `/wallet` and `/wallet/:ledger`, over the wallet's
  catalogue (`cryptoTokensSorted`: every token it can receive, or holds). The panel lists what you
  own, folds what's under the wallet's minimum value into "small balances", and ends with
  Supported tokens (the token picker); with nothing owned, its card is empty, the first few
  supported tokens are listed under "View all", and the middle is the welcome. Any token has a
  page, at zero if you don't hold it. The token page's history is the token's index canister's,
  a page at a time (`TransactionHistoryState`); a row opens the transaction on the token's
  explorer. Copy ledger ID from either kebab copies through `WalletMain` (`panelRequests`). The
  logic is shared with the old wallets (`logic/wallet`: `walletTotal`, `tokenActions`,
  `accountTransactions`). Not yet:
  - All activity merges the first page of each token held that has an index canister (one call
    per token the first time, `WalletHistories`): no Load older across tokens (a token's page
    has it), and a token held at zero, or whose history fails to load, isn't in it. The
    histories are kept for the session (`walletHistories`): coming back costs no calls, and a
    token's first page is fetched again only when its balance has changed. Not kept across
    reloads (the agent has no cache for them).
  - Receive (6b) is built: `/wallet/receive?token=<ledger>`, the token's networks and address from
    `ReceiveAccount` (shared with the old AccountInfos), its QR (`core/QRCode`), Share to chat and
    the balance refreshed every 10 s while it's open. Receive offers the wallet's catalogue only: no
    extra receivable tokens (`receivable`). Network names are the app's (Bitcoin, Solana, Internet
    Computer, oneSec's chains), without the design's "~10 min" times.
  - Send (6b) is built: `/wallet/send?token=<ledger>`. To a person, a transfer in their DM
    (`sendInDirectChat`, shared with mobile's Send to user), offered only for users already DM'd
    (mobile's rule: `contacts`, and the search looks among them, `searchContacts`); to an
    address, a withdrawal over the ledger,
    or for BTC over Bitcoin's own network (the ckBTC minter's fee sent on top, so what arrives is
    what was typed). The amount and fee are worked out in ledger units (`logic/wallet/walletSend`),
    the PIN is the client's prompt. Not yet:
    - SOL to a Solana address and oneSec's EVM chains: the library's Send knows neither, so those
      addresses are refused (`checkAddress`); the old wallets send them (`WithdrawForm`).
    - Saved (`onPickSaved`) and Scan QR (`onScanQr`) open the app's own dialogs, which the design
      doesn't have (`TODO(design)`): `SavedAddressPicker` (the saved addresses the token can reach,
      as the old Send offers them) on `DialogShell` and `MemberRow`, and `QrScanDialog` around
      `core/QRScanner` (every tree's scanner). By hand: `onPickSaved` gets the token's id.
    - saving a new address after a send: the design has no screen for it.
    - the message on a send to an address: the design offers a note to self; nothing keeps it.
    - the ckBTC minter's fee is its estimate for any amount, asked each time Send opens while BTC
      is held (again 10 s after a failure); a send under the minter's minimum stops with a toast
      before anything is sent.
    - the design's "ckBTC on ICP" route to a Bitcoin address can't reach it (the ledger only sends
      to IC accounts), so the host offers only Bitcoin's own (`btcRoutes`, by hand).
    - a transfer to a person under ten fees (the old in-chat transfer's minimum) is refused with a
      toast after Confirm, not flagged on the form: `WalletSend` has no minimum. An address has
      none, as in the old Send.
    - no pending row after a send: the client doesn't return the transaction's id.
  - Recipients (6d) are built: `/wallet/recipients` from the panel's ⋯ menu, the address book as
    `namedAccountsStore` holds it (the client's save and delete keep it). The old address book's
    rules (`logic/wallet/addressBook`, shared with both old trees): only an address
    `addressNetwork` recognises, never a MultiUser user id's account nor one already saved, and a
    name not taken (ignoring case, as the canister keeps it: trimmed, at most 25 characters). An
    edit only renames; removing deletes by name. A recipient's Send opens on BTC for a Bitcoin
    address, ckSOL for a Solana one (which Send can't reach yet), else ICP. By hand in the library:
    `checkAddress`, `checkName`, `editAddress`, `tokenLocks`, `lastSent`, `maxNameLength`, and a
    recipient's `networkName` and `sendToken`.
  - Settings (6d) are built: the panel's ⋯ menu opens `WalletSettingsDialog` (a local dialog,
    `wallet_settings`). The token list is `WalletSettingsForm`'s copy of the stored config (shared
    with both old trees), saved when the dialog closes and only if it changed. The PIN goes through
    `PinNumberForm`. Not yet:
    - "I've forgotten my PIN": the dialog has no such step. A transfer's PIN prompt has it (S3).
    - the hand-picked list offers the tokens with a balance only (the dialog's own rule); the old
      settings offer the whole catalogue.
    - switching to hand-picked starts from the tokens the minimum showed (the dialog's toggle and
      "take over"), or the default tokens when it showed none; the old settings always start from
      the default tokens.
  - Swap (6c) is built: `/wallet/swap?token=<ledger>`, from the token page, the menus and the
    balance card. `SwapForm` (shared with both old trees) drives it: every DEX is asked and the best
    quote shown, with how many were checked ("ICPSwap · of 2 checked", `dexesChecked`, as the
    design's pass 6 has it); the swap's steps; and the location check (a restricted location gets a
    notice and no quote; a check that fails counts as restricted). Pay offers held, swappable
    tokens and Get only those a DEX has a pool for with it (`canPayWith` / `canSwapTo`, by ledger).
    The slippage chosen is honoured: the minimum output is the quote less it (`swapMinimumOut`).
    By hand in the library: `payable`, `targets`, `onPay`, `restricted`, a value warning to
    confirm, exact amount text, and a dismissed PIN prompt going back to the quote. Not yet:
    - no countdown: the client's quotes have no expiry (`expiresAt` is optional); the minimum
      output protects a quote that's gone stale.
    - no fees or price impact rows: the client doesn't know them.
    - the local replica has no DEXes or swappable tokens, so Swap there finds nothing to buy.
  - the total is what the panel lists (Your tokens and small balances); the old wallets' total is
    `walletTokensSorted`'s (in automatic mode, the default tokens plus those worth the minimum).
  - the display currency is kept on this device (`walletCurrency`, a local storage store), shared
    by the panel and the settings dialog; neither old tree stores it.
  - no 24h change (see the data gaps below).
  - by hand: `WalletToken` gains `id` (the ledger: callbacks, the selection and activity use it,
    as two ledgers can share a symbol), `actions` and `logo`; `WalletPanel` takes `rates`, and its
    manual `settings.tokens` are ids; `WalletMain` takes `history`, `onMoreHistory`,
    `onRetryHistory`, `onActivity`, `allActivityNote` and `flows`, and `WalletActivity` gains
    `token`, `party` and kind `own`; `TokenAvatar` and `PageHeader` take a logo (a broken one falls back to the mark); `TokenPicker` options carry an id; `TransactionRow` has kind `own`; `PageHeader`'s price pill is larger than the design's. `WalletReceive` takes the host's `networks` (address, failed, note and the token arriving, per network) with `network` / `onNetwork`, shows the token's logo and picks its token by id. `WalletSend` picks its token by id and
    names it in the request (`token`), with the amount as exact text (`amountText`, `max`), the
    user fee (`WalletToken.userFee`), `hostPin` and `checkAddress`; an ICRC-1 account with a
    subaccount is an IC address. Swap still picks its token by symbol (6c).

- **Explore** (8a #10127, `features/explore`): `ExploreCommunities`, full width, on `/communities`
  and `/welcome`. The component asks for pages and the client searches through the step both old
  Explores now share (`searchCommunities` beside `communitySearchState`): an empty text is sent as
  none, the page after the last one held for Load more, no community twice, only the latest
  search's answer kept, the viewer's moderation flags on every request. The query is in the URL
  (`/communities?q=&lang=`, written as it changes, replacing the entry); the languages picked are
  saved on this device as the old filters saved them (`toggleCommunityFilterLanguage`), and a URL
  without `lang` opens on them. The results and the scroll position are kept across visits:
  coming back to the same query shows them at once, and Explore searches again only with none
  held or for another query (or when the viewer's flags change). A community joined opens; one
  not joined opens as a preview, whose cancel comes back to Explore with its query
  (`client.setCommunityPreviewOrigin`, mobile's way; the preview's Join and Back are 8b's, see
  "Join gate"). Create community: the create dialog, the Diamond upgrade, or a guest's sign-in, after
  which creating carries on (AppScreen). Writing the query to the URL (`replaceQuery`) leaves any
  dialog over Explore open. Results set outside the search step (a proposal's community finder)
  answer no Explore search (`CommunitySearchState.held`), so Explore searches again rather than
  show them; the mobile welcome page keeps its own (`topCommunities`). A guest gets the component's sign-in banner. Kept from the desktop
  tree: Load more (the library's own, 6 a page). By hand in the library: a sort or language change
  refreshes the list in place (dimmed rows, a spinner by the table's title) instead of emptying the page,
  a click or a key in the hero's search opens the search view, which stays open (emptied too, or with a
  click elsewhere) until Back or Esc (EXPORT-LOG 2026-11-04). Not carried over:
  - bots: the old mobile Explore's Communities / Bots switch, its bot cards and filters, and
    Register a bot (desktop lists bots elsewhere; see Bots).
  - `/welcome`'s own page (mobile's `WelcomePage`: three top communities and the OpenChat
    community): `/welcome` is Explore, as ROUTES.md has it.
  - mobile's sheet with the card and "View community" before opening one: a card opens it.
  - the old desktop's filters panel in the right column (`community_filters`): the language
    filter is the component's own menu.
  - a gated community's card says how many requirements it has, not which (the old cards' gate
    chips).
  - Back and forward don't step through searches (each replaces the entry), and Back from a
    community lands on Explore with the query it was opened from.

- **Join gate** (8b #10128, `features/join`, `logic/join`): a preview's composer is
  `CommunityPreviewBar` (`previewBar`), 12px below the messages as the composer is: the
  community's while the community is previewed (or lapsed), else the group's or channel's; guest,
  gated (with how many requirements the user doesn't meet yet, both levels', an "any" gate counting
  once, and none an invitation bypasses) or plain; Join, Back (to Explore or `/welcome` when the
  preview was opened from there, else the list). Join on a channel joins the channel, as the old
  footers did (the backend joins its community with it), even under the community's bar; a locked
  channel in a community that isn't locked joins the community alone. Join runs
  the shared flow (`logic/join/joinFlow`, the old `utils/preview.svelte.ts`, which both old trees
  now use too): a guest's join is recorded and opens sign-in, and replays once after it
  (`takePostLoginJoin`, AppScreen); gates the client can't check open `JoinGateDialog`, a level at
  a time; "Pay and join" approves the payments (asking for the PIN) and joins; "You joined …" on
  success (named as the bar named it), the failure's own message otherwise, "Access gate not met"
  for a backend gate check failure. The dialog stays open while the join doesn't go through (the
  PIN dismissed, the approval or the join failed, the backend's gate check), with a toast saying
  why, and "Pay and join" records the user's choice again (a payment approved for the failed try
  isn't approved, or its fee paid, again while the approval stands); a payment that would leave a balance the gate also
  asks for short is refused before anything is approved, and says so. `?autojoin` joins the same
  way once the preview has loaded. Desktop and mobile differed (A4): Back on a lapsed preview is hidden (desktop: a lapsed
  member is still a member), and cancelling a community preview goes back to where it was opened
  (mobile). Not carried over:
  - the platform moderator's Freeze / Unfreeze on a preview (desktop footer only);
  - the gate icons (desktop) and "Access gates enabled" (mobile) in the footer: the bar's gated
    state says how many requirements there are instead;
  - "Get Diamond" in the dialog closes it for the Diamond dialog (a dialog replaces another, never
    stacks), so after buying the user presses Join again; the design has Diamond over the join
    dialog, its row turning Met;
  - the design's preview mode around the bar (its rail entry for the previewed community, the
    reduced menus, the user's own messages hidden): not 8b's;
  - the Back from a channel preview of a joined community goes to the list, not to the next chat
    (the old desktop's `selectDefaultChat`; the router picks the list's default chat).
  - two joins at once on one canister and ledger (two channels of one gated community): the
    client's standing gate approval (`#standingGateApprovals`, which spares a retry the approval
    fee) can keep the wrong amount, as which approval the ledger applied last isn't known. Fix
    when parallel joins become possible: remember neither when two overlap, so the next try
    approves again. Not reachable from the UI yet.
- **Landing** (9b #10133, `features/marketing`): the Communities section shows four: the OpenChat
  community first (`getOpenChatCommunity`, as mobile's welcome page has it; production only, so
  elsewhere there's none), then the top of Explore's ranking without it (`pinFirst`). The ranking
  is `topCommunities` beside `searchCommunities`, which the mobile welcome page uses too: the
  first page with no search and no languages, and moderation flags 0 whoever is looking, so never
  an adult or offensive community. Explore's own results are left alone. The ranked cards are
  Explore's (`explore.adapter`, then `landingCommunities`), the OpenChat community's is made from
  its summary the same way (`pinnedLandingCommunity`). They're asked for once the identity has
  loaded (`chatsInitialisedStore`, signed out too: the worker has no agent before), so they come
  in after the page. Nothing shows until the ranking has loaded; a part that fails (the ranking
  or the OpenChat community) is retried on its own, after 2s, doubling, five times, and what
  loaded is kept. Meanwhile the ranking shows without the OpenChat community. A card opens the
  community's preview and, as it's followed, sets where the preview's cancel goes back to
  (`setCommunityPreviewOrigin`, the Landing path it was opened from), as Explore's cards do
  (`LandingCommunity.onOpen`, by hand in the library). The Android card's full build links the
  latest GitHub release and its Play Store build the public listing (`ANDROID_APK_URL`,
  `ANDROID_PLAY_STORE_URL` in `utils/urls.ts`, shared with the old beta card and the native app's
  upgrade banners). The listing is public, so the old beta card's testers' group and testing page
  steps are gone from it too: its Play Store choice links the listing. Neither card says the app
  is in beta any more ("out now, in two builds", "Available"; the library's `ui.landing.apps.sub`
  and `ui.landing.apps.available` by hand).
- **Diamond** (`?diamond`, `features/diamond`, 8e #10131): paid through the shared payment
  (`logic/diamond`, which both legacy `Payment.svelte`s use too), in CHAT or ICP at the backend's
  own prices (CHAT in production, ICP elsewhere, by default), auto-renew on, a timed member opening
  on the plans. By hand in the library: `DiamondContent` (the dialog's body, for the `/diamond`
  page in 9a), per-token prices (`tokenPrices`: only the backend's tokens, never USD-converted), the
  approval fee (`approvalFees`, counted in what a token can afford and shown on confirm), a top-up
  address per token (`depositAddresses`), `onUpgrade` resolving `false` (nothing bought, nothing to
  say: the PIN prompt dismissed, or a PIN failure, which is toasted with its own message), and Back
  handing off to the dialog it came from. Not yet:
  - paying from an external wallet (the old source wallet selector and its approval popup): only
    the OpenChat wallet pays (`DiamondPayment.pay` takes a `fromAccount` for when it can);
  - the limits and the feature table are the library's own (`DEFAULT_LIMITS`), as the old
    `Features.svelte`'s were written into it;
  - app store builds hide paying (`disableDiamondPaymentFeature`: no `onUpgrade`), with no
    "Explore Diamond" copy as the old mobile tree had.
- **The claim calendar, by hand** (8e, the design's changes of 2026-10-22, from its brief: no export
  of them yet): `ClaimCalendar` (the profile's calendar taken out of it, always six weeks with the
  months either side dimmed, a popover on tap as well as hover) in `ClaimHistoryDialog`, with the
  streak insurance under it; `ChitDialog`'s "View claim calendar" link (`onAction('calendar')`);
  `ProfileDialog`'s "Claim history" row (`onChitHistory`) where its calendar was; the `calendar`
  icon (the brief's `minus` waits until something uses it). The brief's calendar props (`streak`,
  `claimMinute`) are the design's demo data: the library's take the real claim history
  (`claimHistory`, `today`, `joined`). Its back arrow says which dialog it returns to ("Back to
  CHIT", "Back to profile").
- **Dialogs opened from dialogs, by hand** (the app's rule): a back arrow only for a dialog opened
  from another (`AchievementsDialog`, `LeaderboardDialog` and `StreakInsuranceDialog` drew one
  always), and one for `DialogShell` and `ProfileDialog` (`onBack`). The design has no rule for
  it.
- **`StreakInsuranceDialog`, by hand** (8d): a week of cells at a time, sliding along the ladder
  (30 in a row crushed the prices together); "Your cover is full" for "Covered for a full week",
  as cover caps at 30 days; Back with `onBack` hands off with no exit, so the backdrop stays;
  `cap` for the foot's "cover caps at"; `onBuy` resolving `false` is nothing bought by choice.
- **`ChitDialog`, by hand** (8d): the default milestone tiers keep their hand-spaced positions
  when a host passes them; a claim made in the dialog clears once the next claim opens; `onClaim`
  resolving `false` is nothing claimed (claimed already), and plays no claim.
- **`DailyPuzzleCard` and `ChitDialog`, by hand** (8d): the card takes a `title` (it always said
  "Today's puzzle · Bridges") and the items of its "⋯" menu (`menu`, no "⋯" with none), and
  `ChitDialog` passes them on (`puzzleTitle`, `puzzleMenu`); an `unavailable` state says there's
  no puzzle today, with no button or menu.
- **CHIT dialog** (`features/chit`, 8d): the streak, today's claim, the balance, the insurance
  summary, the settings (the profile's CHIT section), the leaderboard (`?hof`) and the ways to
  earn (`?chit=earn`, `AchievementsDialog`) and buying streak insurance (`?chit=insurance`,
  `StreakInsuranceDialog`), each in the CHIT dialog's place over the same backdrop, Back
  returning to it, as is today's puzzle (below). A claim that fails shows the dialog's own error, where the old modal toasted and
  closed; an already claimed day just moves the countdown on, as the old desktop modal does. A
  claim made bursts confetti from the claim area (`ChitDialog`'s, by hand, with the library's
  `Confetti`), where the old modal rained CHIT coins.
- **Streak insurance** (`StreakInsuranceDialog`): paid in CHAT as the old dialog pays it (the
  PIN first, if set, through the PIN prompt), what's sent worked out from the cover bought. The
  dialog prices a day by the cover held and the backend by the days bought, so the app offsets
  its prices by the days used (and passes `cap`, so "cover caps at" says 30). The PIN prompt given
  up leaves the dialog open with nothing said.
- **Daily puzzle** (`?chit=puzzle`, `?chit=puzzle:<gameId>`, `PuzzleDialogScreen`): the design's
  `PuzzleDialog` plays Bridges only, so it isn't used: the puzzle is a plain `DialogShell` frame
  (`TODO(design)`) around the app's own boards (`core/dailyPuzzle`), driven by the old screens'
  flow (`DailyPuzzleGame`), in the CHIT dialog's place over the same backdrop (`DialogScreen`
  gives the frame's lighter scrim the dialogs' veil while it takes over). The CHIT dialog's card
  shows the first puzzle not yet solved (the old modal listed every game's row); once all are
  solved it says so and opens the leaderboard; with no puzzle today it stays, saying so, where the
  old modal showed no row (and none while they're still loading). A game this build can't draw
  is left out, and a link to a game that's off today opens no puzzle. The rail's puzzle dot shows
  while one is still to play. Not yet:
  - sharing a result (the old "Share" button) and the result card in a chat
    (`DailyResultContent`), which wait on the message kinds (#10236);
  - the card's reminder and hide (its "⋯" menu has only "How to play", `?chit=howto`): the old UI
    has neither.
- **Leaderboard** (`?hof`): this month's, last month's and all time's top 10, as the old hall of
  fame shows them, with its Invaders game behind the joystick (8f: the old game, now
  `core/invaders`, for both trees), where the device can play it (a keyboard, or iOS, which steers
  by tilting); it now starts again after a game ends, keeps the final score on screen, and fits
  its waves to the field (fewer rows on a short one, a phone on its side).
- **Ways to earn** (`AchievementsDialog`): the old "Learn to earn" list (`achievementList`). The
  dialog's groups and its "next up" bands are the app's (`chit.adapter.ts`: each achievement
  given a group; quick up to 1,000 CHIT, middling up to 3,000, big above), not anything the old
  UI had; no achievement has an icon of its own (the old UI had none).
- **Achievement toast** (`AchievementToast`, for the client's `chitEarned`): only with the popup
  setting on (`chitPopup`) and CHIT on, as the old earned popup; one toast for each achievement,
  in turn, with the CHIT it paid (the old popup listed them all in one, with the total), and the
  longest streak gets the flame icon, where the old popup shook the page and played longer. A
  batch is marked seen as it comes, as the old popup did, so with the popup off it isn't.
- **App events** (`features/app/AppEventDialogs.svelte`): the not-found, no-access and
  not-available dialogs are a `DialogShell` with the old UI's words (no design: `TODO(design)`);
  "Page not found" was never translated. Suspending a user (`suspendUser`, platform moderators
  only) opens `SuspendUserDialog` (see "Suspend and unsuspend").
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
  link previews, translations and tips (phase 5) aren't wired; the message menu, reactions and
  swipes are 5b's ("Message actions"). Events other than messages show as a centred line in the old UI's words, names in bold
  (`logic/conversation/timelineEventText`, shared with the old trees; no design for them:
  `TODO(design)`), and "N messages deleted" expands them. The old lines' date and time under each
  event isn't shown yet (it's duplicated in both old `NonMessageEvent`s, to extract). The header has no back button (`ConversationHeader` has
  none; narrow layouts don't show the shell yet), no last-seen line for a DM, and its menu does
  favourite, mute and copy link only: the rest open dialogs (phase 4), and calls are phase 7. The
  old list's go-to-mention button and sticky date aren't carried over; it keeps go-to-latest.
  Own messages show no name (the design's "You" would be the lower-case app string).
- **Media messages** (`features/conversation`, 5a): images, memes, GIFs and videos show as
  `MediaMessage` tiles. They have no reactions, quote, thread or edited mark yet (`MediaMessage`
  takes none). In low bandwidth an image shows its thumbnail and a GIF an empty tile until the
  first click, which loads it in the bubble; the old trees put a "load image" button on it, which
  `MediaMessage` hasn't got. Unlike the old trees, the reader's own image is held too while it's
  still sending. A click on a shown one opens `MediaViewer`, the mobile app's full-screen
  viewer (pan and zoom from `core/zoom`, shared with `ZoomedImage`; no design for it:
  `TODO(design)`). It has none of the old desktop viewer's arrows between a chat's images. A
  failed send shows the tile's own failed state, with no retry yet.
- **Voice bubble and hover bar, by hand** (2026-11-06, EXPORT-LOG): a sent voice message has the
  sent bubble's colours and the received shape (bubbles are all left-aligned; `mirror` is for
  right-aligned layouts), which the design export didn't have; and a message's hover bar comes
  in front of the message before it (`MessageGroup` `.raised`); a playing voice message's button
  sends out a fading halo. To take back to the design.
- **Voice and file messages** (`features/conversation`, 5a): a voice message plays through the
  screen's `VoicePlayer` (one audio element, so one at a time), with the recording's waveform
  (`VoiceMessage` takes `levels` by hand: the design's bars are made up). Unlike the mobile app,
  the next voice message doesn't play when one ends, and the speed is one for the whole chat. A
  voice message's caption isn't shown and a failed one shows no failed state (`VoiceMessage` has
  neither). Neither shows a sent or delivered tick (`VoiceMessage` and `FileMessage` take no
  status). A file shows its name, size and type and downloads under its own name. Neither has
  reactions, a quote, a thread or an edited mark yet.
- **Link previews** (`features/conversation`, 5a): a text message's previews show as cards under
  its text (`ChatBubble` takes `previews` by hand, a `LinkCard` each, the card the design's
  `LinkPreview` has). The design's `LinkPreview` is a message kind of its own, with plain text and
  no edit, quote, thread or reactions, so it isn't used; with previews the bubble takes its shape
  instead (320px, cards flush, the time under them). A card links only to an http(s) URL
  (`ogPreviewCard` in `@client`, shared with the old trees). The sender removes one with the X on
  its card, after a confirm (`ConfirmDialog`, no design for it: `TODO(design)`). A link to
  another OpenChat message (`messagePreviews`) shows no preview: nothing in the library renders a
  quoted message. A Twitch link shows its card, not the click-to-play player the old trees show
  (`TwitchPlayer`, from `extractTwitchEmbeds`, `twitchPlayersAndCards`, `twitchPlayerParent`,
  `twitchPlayerUrl` and `twitchPoster` in `@client`): `ChatBubble` takes cards only. The player's
  URL starts playing as it loads, so a player here must load only on its poster's click, and back
  to the poster when hidden, with `allow="autoplay; fullscreen"` on its iframe, as the old trees do.
  Nothing may lie over it, not even an invisible layer clicks pass through (the old trees'
  `ChitEarned` was one), or Twitch won't start it.
- **Transfers** (`features/conversation`, 5a): a transfer shows as `TransferMessage`, with the
  token's logo as its mark. `TransferMessage` takes `direction` and `recipient` by hand: the design
  signs it by the bubble's side, which shows a transfer between two other people in a group as the
  reader's own receipt. Outside a DM it says who got it ("to Bob") unless that's the reader. "View
  transaction" opens the ledger's explorer. The caption is plain text (no markdown), the card
  shows no sent or delivered tick (`TransferMessage` takes no status), and it has no reactions,
  quote or thread yet. A failed transfer, or one in a ledger the registry
  doesn't carry, stays a text bubble. The dollar value is worked out when the row is made (and
  again once the exchange rates first load); it doesn't follow the rates' later refreshes.
- **Polls** (`features/conversation`, 5a): a poll shows as `PollMessage` and votes through
  `registerPollVote` (`pollVoteChange` in `@client` turns the card's choices into one vote, and
  refuses one the poll can't take). `PollMessage` takes `readonly` and `showResults` by hand: the
  design locks a poll only once it's closed or voted, and shows results only after a vote. A
  public poll shows no voters' avatars and has no "View votes" list yet (the old mobile
  `PollPublicVotes`). How long it has left is worked out when the row is made (3d, 5h, 12m), and
  doesn't count down. No tick, reactions, quote or thread yet, and polls in threads aren't wired.
  The library's `PollBuilderDialog` still offers "lock votes" with multiple choice, which the
  backend ignores: the poll is sent with `allowsVoteChange` (`newPollContent`, 5d), as the old
  builders send it, so a multiple-choice poll's votes can always change whatever was picked.
- **Swap offers** (`features/conversation`, 5a): a swap offer shows as `SwapOffer`, read from the
  reader's side. `SwapOffer` takes `pending` and `cancelled` states by hand (the design had only
  open, done and expired). Its sender can Cancel and anyone else Accept, only while it's open
  (`swapActions` in `@client`); a non-Diamond reader's Accept opens the Diamond dialog. Both ask
  first in `ConfirmDialog` (no design for it: `TODO(design)`), the accept with what it costs
  (`swapAcceptCost`, shared with the old accept modals) and held back when the OpenChat wallet
  can't cover it. The accept pays from the OpenChat wallet only: the old modals' external wallet
  (an approval popup) and a MultiUser user's own wallet aren't offered yet. The old trees' details
  view (the escrow transfers, `P2PSwapProgress`) and who took it aren't shown. The offer's message
  shows as plain text under the card (`SwapOffer` takes `caption` and `canAct` by hand: no action
  while previewing). An offer still being sent (`p2p_swap_content_initial`) shows as the card it
  will be, with "Sending offer…" where the action would go (`sending`, by hand; a failed one stays
  a text bubble, which shows the failure). Time left is worked out when the row is made. No tick, reactions, quote or thread yet, and swaps in threads aren't
  wired.
- **Relayed messages** (`features/conversation`): a message a bridge bot relayed from Telegram or
  Discord shows as the bot's (`conversation.adapter.ts` picks the side by `msg.sender`), and so
  does a reply quoting one (by `senderId`). The old trees show it as the OpenChat user who linked
  the account, with their name, avatar and badges (`linkedAuthor` in `@client`), or as the
  account's own profile if no one has; so do their reply quotes, which carry the quoted message's
  `senderContext`, and pinned messages. The message itself shows the platform's logo over the
  sender's avatar, and no bot badge. One from the viewer's own
  linked account looks like their own message (`shouldShowAsMe`), though editing and deleting it
  still go by the sender, the bot, and blocking or reporting its author is hidden. No relayed
  message offers a private reply, which would go to the bot. The client marks the viewer's own
  read (`isOwnMessage`), so that part needs nothing here.
- **Composer, first cut** (`features/conversation/Composer.svelte`, phase 3c): text first; files,
  media, voice and the @mention picker came with 5c, the "+" menu's builders with 5d (below).
  GIFs are still to come (`MessageComposer` hides the GIF tab without its handler). There's no rich-text
  editor (the old one showed
  markdown as it was typed). The old desktop entry's link-count note ("Link previews are hidden
  for messages with more than 5 links", `excessiveLinksNote`) isn't carried over: it can't show
  any more, since `extractEnabledLinks` stops at the 3 links that get previews
  (`MAX_LINK_PREVIEWS`) so it never counts past 5, and nothing hides a message's previews past 5
  links; the first 3 get them. To drop from the desktop entry too, or to word again (say, "only
  the first 3 links get previews") if the design wants one. In a bot DM, what's typed goes to the bot as its direct-message command,
  but there's no `/` command selector, and a bot that takes no direct messages gets the
  composer's error instead of the old warning. A bot's private (ephemeral) reply isn't shown:
  nothing here subscribes to `ephemeralMessage`, so it's dropped. The old trees show it above the
  composer for a minute, or until it's closed, paused while the app is hidden. A chat's rules are asked for in a plain dialog
  (`RulesDialog`, the old modal's words; no design for it), and the throttle countdown shows as the
  composer's banner. Enter follows the app's Enter-to-send setting (`enterSends`). A preview
  shows `CommunityPreviewBar` (8b, "Join gate"). A chat that takes photos or files but no text
  shows "This chat is read-only" (`entryBlock` asks for the text permission), where the old
  entries let the reader attach one and greyed the text out (`sendTextDisabled`).
- **Files and media in the composer** (5c): the "+" menu's "Photo or video" (the device's picker,
  `image/*,video/*`, the mobile app's) and "File" (anything), each offered where the chat lets the
  reader send it (`pickableAttachments`); a file pasted into the text box; a file dropped anywhere
  on the conversation (an overlay while it's held over it, the old `DropTarget`'s words; no design
  for it: `TODO(design)`). One a message, as in the old trees (`AttachmentContent` holds one).
  Each goes through `attachFile` (the client, used by the old trees' pickers, drop and paste too):
  attached to the chat it was picked in even if the reader moves on while a video is prepared,
  refused with the permission it needs where it can't be sent there (`attachRefusal`; from the
  file's type, before a video is transcoded, `filePermission`), a failure
  saying why (over the size limit, else `attachFileFailed`, where the old trees showed the raw
  error). A video's preparation shows over the composer (`videoProcessingPercent`). A photo,
  video or GIF is staged in the composer's media tray, a file or audio clip as a chip with its
  size (`composerAttachment`; its × removes it), and the text becomes its caption. Not in a bot
  DM, which takes text only; not during an edit, which changes only the text (the old entries hid
  their pickers; the edited message's own content isn't shown as an attachment either,
  `draftAttachment`); not while a voice message is recorded or reviewed, since sending it posts
  the draft (`canAttachNow`; the composer says when, `onVoiceActive`). A file dropped where
  nothing can be attached is refused, never left to the browser to open in the app's place. What
  the "+" menu and the mic offer follows the reader's permissions as they change
  (`messagePermissionsForSelectedChatStore`), and the voice limit a Diamond membership bought
  meanwhile (`maxMediaSizes($isDiamondStore)`). The "+" builders' payments are staged too (5d,
  below). Not yet: a puzzle result isn't staged, and the composer doesn't send it; the mobile
  app's native recent-media strip waits for the narrow pass.
- **Voice messages in the composer** (5c): the composer's own recorder (record, then review: play
  back, seek, delete or send), where the old trees' mic staged the clip as an attachment to send
  with a caption: here it goes straight out (`sendVoiceMessage`: the client makes the audio
  content, waveform and length, with `audioContent`, which both old recorders now use, and sends
  it as `sendMessage` does, replying to the draft's reply), and a take that isn't sent stays to
  send again. The mic shows as the old entries' did (`canRecordVoice`): where audio may be sent,
  the browser records in `audioRecordingMimeType`'s format (mp4, which every device plays, else
  webm), the reader hasn't turned the microphone down (`microphoneDenied`, which both old
  recorders now use), not in a bot DM, and only while nothing is typed or attached. A take stops at
  the size limit (`maxMediaSizes($isDiamondStore).audio`, following a Diamond membership bought meanwhile) and says so, where the old trees toasted `maxAudioSize`.
  The microphone is let go on leaving the chat (the composer is keyed per chat).
- **The @mention picker** (5c): an "@word" typed at the caret lists who can be mentioned for it
  over the text box (`mentionCandidates`, `@client`, which both old pickers now use: never the
  reader, @everyone first, then the community's user groups, then members, each by the shortest
  name; at most 200), with their avatar, name and @username; a chat that holds only some of its
  members is searched for those it doesn't hold once two characters are typed (`MemberFinder`,
  which both old pickers use too). ↑ ↓ move, Enter or Tab picks, Esc closes it for that word, a
  click picks. A pick puts "@username " in the text, which the client mentions on sending (its
  typed mentions), where the old editor held a mention node. So a user group whose name has
  characters other than letters, digits and "_" (a "-", say) isn't mentioned when picked or typed:
  the client's typed mentions stop at them. Bots come after the members, as in the old pickers,
  whose comparator was inconsistent (a bot against a user compared "after" both ways). The list has no
  design (`TODO(design)`): it's drawn as the composer's other popups.
- **Composer, not yet** (5c, left for later pieces of it):
  - bot commands: the old trees' `/` selector (the commands the reader's role, the chat's
    permissions and the bot's granted permissions allow, `restrictByBot` / `restrictByChat` /
    `hasPermissionForCommand` in both `CommandSelector`s, to move to `@client`), the arguments'
    dialog (`CommandInstanceBuilder` and `CommandArg`: text, numbers, choices, a user, a date), the
    failure toasts (`bots.failed`, `bots.tooManyRequests`) and a bot's ephemeral reply (above);
    in a bot DM, a bot that takes no direct messages gets the composer's "couldn't send", not the
    old `bots.direct.warning`. The design has none of it;
  - GIFs (the library's results, above);
  - the emoji autocomplete (`:smile`) both old editors had (`EmojiAutocompleter`).
- **The "+" builders** (5d, `features/builders`): each a local dialog the composer's "+" menu
  opens (`build` in the conversation), offered where the chat lets the reader send what it makes
  (`composerBuilders`, `@src/logic/composer`), not in a bot DM, and not the payments in the
  app-store builds (`composerBuildersOff`: `disableSendCryptoFeature`, `disableP2PSwapFeature`,
  `disableCreatePrizeFeature`), as in the mobile app.
  - **Payments** (a transfer, a prize, a swap offer) are attached to the chat's draft, the mobile
    app's way, and taken when the message is sent with its caption (`sendMessage`, which asks
    for the PIN then): an approval isn't spent on a draft the user drops. Every builder is offered
    only while something can be attached (`canAttachNow`: not during an edit or a voice take), the
    ones that send too, since one sent mid-edit would reply to the edited message's reply. The
    composer stages each as its chip (`composerTransfer` …), whose Edit opens its builder again
    on it, and × drops it. One whose token has left the registry has no chip: its send is refused
    (`attachmentToSend`) rather than the caption going without it. They pay from the OpenChat wallet only: the old
    builders' external wallet picker (`SourceWalletSelector`, and the approval at send) has no
    design and isn't offered. A draft that does carry an external wallet (`fromWallet`) is never
    sent from here without that wallet's approval: the composer says it couldn't send
    (`externalWalletPayment`, `@client`, which the mobile entry now uses to ask for it). With no
    token held, a builder lists none, where the old ones offered to top up.
  - **Poll** (`PollBuilderDialog`, `poll_builder`): published from the dialog, as both old
    builders did, through `sendContent` (the client: settles once the poll shows in the chat,
    replying to the draft's reply, which it clears, and leaving the rest of the draft, its text
    and any payment staged; a refusal keeps the dialog open with its error). The poll is
    made by `newPollContent` (`@client`, which both old builders now use too): the question and
    up to 10 answers of up to 75 characters (the mobile app's; the old desktop builder kept its
    own 50), unique ignoring case (`pollAnswers`), the vote kind from its settings
    (`newPollVotes`), the end stamped as it's sent. The design's "Poll sent · Undo" toast isn't
    shown: a sent poll can't be taken back. As in the old trees, sending it clears the chat's
    draft (`sendMessageWithContent`), while the composer's text box keeps what it showed.
  - **Send crypto** (`SendCryptoDialog`, `send_crypto`): the tokens held, the one last sent first
    (else ICP, as the old builders start), each costing the transfer's fee and its approval's,
    at least 10 transfer fees (`builderTokens`). In a DM it goes to the other user; in a group the
    one being replied to is picked to start with (`SendCryptoDialog`'s `to`, by hand), else the
    user picks from the chat's members, never themselves or a bot (`CryptoTransferForm`, shared
    with both old builders, invariant 5). What was typed is read with `validateTokenInput`
    (`attachTyped`: exactly the typed amount, in a token the registry carries, within the
    balance less the fees) and refused with a toast where the library's own check let through
    what the app's doesn't (`builders.paymentRefused`). The members offered are those the chat
    holds (a big group or channel holds some), with no avatar: `SendCryptoDialog` draws an
    initial. The library tells tokens apart by symbol, so of two sharing one only the first is
    offered.
  - **Prize** (`PrizeBuilderDialog`, `prize_builder`; not in a DM): the tokens held, the one last
    sent first. It costs what both old builders charged (`prizeCosts`, `@client`, which they now
    use: the fund's transfer and its approval, a transfer fee per winner and OpenChat's 5%), at
    least 100 transfer fees a winner, within the balance less those (`prizeMaximum`), shown
    through the dialog's `pricing` (by hand). 1 to 1000 winners. The fund is split by
    `newPrizeContent` (`@client`, from both old builders: equal or random shares adding up to the
    fund exactly, rounding to the first, none below the transfer fee), its end stamped when it's
    attached, as the mobile app stamps it (the old desktop builder sent at once). The split,
    duration and restrictions start from the last prize's (`PrizeForm`, `logic/prize`, which both
    old builders now use: `openchat_prize_config`, read however a tree wrote it, `parsePrizeConfig`
    — the mobile builder's remembered duration was a bigint written as a string, which then ran
    into the end date's digits). Unique-person gating stays off; "Authenticated" isn't offered
    (`restrictions`, by hand: a prize can't require signing in again since #10425). Durations:
    the dialog's 1h to 90d (the mobile app's range), where the old desktop builder offered 1h,
    1d, 1w (it now starts at a day for another). With no token held the dialog lists none and
    can't attach (`TODO(design)`).
  - **Swap offer** (`SwapOfferDialog`, `swap_offer`): for Diamond members; anyone else picking it
    gets the Diamond dialog (`swapOfferStep`, `@client`, which both old builders now use). Any
    token can be asked for, one held offered. It costs the deposit's two transfer fees and the
    approval's (`swapOfferCosts`, `@client`, both old builders' too), through the dialog's
    `depositFees` (by hand; the design priced two fees), at least 10 fees, within the balance
    less those, open for at most 90 days (`swapOfferExpiry`, `P2P_SWAP_MAX_EXPIRY_DAYS`). As in
    the mobile app it's confirmed before it's attached, with the old builders' words
    (`swapOfferConfirmation`: what it takes from the wallet, fees and all): the confirmation
    (`DialogShell`, `TODO(design)`: the design has no review step) takes the builder's place over
    the same backdrop, its back arrow returning to the offer as it was filled in, × or the
    backdrop closing both (`SwapOfferForm`, `logic/wallet`, which reads what was typed with
    `validateTokenInput`). Then it's attached (`newSwapOfferContent`).
  - **Meme Fighter** (`meme_fighter`): the Meme Fighter maker in a frame, as both old builders
    have it (`startMemeMaker`: only the maker's origin, from its own frame, is listened to),
    styled with the theme's surface, ink and accent (`memeMakerStyle`); the meme made is shown,
    to send or to start again from, and sent from the dialog (`sendContent`) at the size it shows
    at (`memeFighterContent`, which both old builders now use). The library's
    `MemeFighterDialog` isn't used: it renders a PNG from host `templates`, which the app doesn't
    have (the maker has its own), and hands back an image to stage in the media tray, where a
    Meme Fighter meme is sent by its URL. The frame sits in a `DialogShell` (`TODO(design)`: the
    design has no frame for the maker).
  - Not yet: paying from an external wallet (above); a thread's composer offers no builders
    (threads aren't wired); the design's "Poll sent · Undo" toast.
- **Replies and edits in the composer** (5b): the chat's draft holds the message replied to or
  edited (`setReplyingTo`, `setEditing`, as in the old trees), and the composer shows it above the
  text (`composerContext`): who wrote it and its text, an edit starting from the message's text
  as the old entries started it (`editStartText`, logic/composer, which both old entries now
  call: each `@UserId(…)` / `@UserGroup(…)` as the `@name` typed, the link-disabled marker taken
  out, a caption for a captioned message; 5c). Its X drops a reply, or ends an edit; a click on it goes to the message when it's in this chat (a
  private reply quotes another chat's: no jump, where the old UI opened that chat). An edit is
  saved with `editMessage` (failure toast `errorEditingMessage`). Ending an edit, saved or
  cancelled, puts back what the user was writing before it (`endEditing`, kept by `setEditing`;
  the old trees dropped the whole draft, and now get it back too), also when the chat was left
  mid-edit: the composer then mounts with that text to go back to (`composerStartText`;
  `MessageComposer` takes `text` so mounted in edit mode, by hand). Not yet: a media reply's
  thumbnail (`thumb`).
- **Message actions** (`features/conversation`, 5b): every message's menu (`MessageActions`:
  right-click, the hover bar's ⋯, Shift+F10, a long press on touch), its hover bar's quick
  reactions (the app's `quickReactions`), the emoji picker, the reaction chips (under every
  kind of message: `ReactionChips`, by hand, EXPORT-LOG 2026-11-06), swipes, desktop's double-click to edit or reply
  (the "double-click to reply" setting) and Retry on a failed message. What a message offers is
  the old trees' (`messageMenu` in `@client`, which both old menus now read): no menu on an inert
  message unless it can be revealed, in a read-only chat or on an ephemeral message. Done here:
  reply and edit (the composer's strip), copy, copy link, share (where the browser can), translate
  / untranslate (Diamond, else the upgrade), pin / unpin, cancel a reminder, block the sender,
  delete (asking first, with "don't show me this again", `confirmMessageDeletion`; a failed
  message only goes from this device), reveal, undelete, retry (`retrySendMessage`), forward (the
  chat picker, `ForwardDialogScreen`: the message goes out as the chosen chat opens, as in the old
  trees, through `messageToForwardStore`; a note written in the picker waits in that chat's draft,
  where the old pickers had no note) and reply privately (`replyPrivately`: the sender's DM, made
  if missing, with the reply set), report (`ReportMessageDialogScreen`: a reason from
  `REPORT_REASONS`, child sexual content with its warning, the client sending `csam` for it
  alone; delete it too where the reader can delete others' messages) and remind
  (`ReminderDialogScreen`: the old desktop dialog's presets, `reminderTime`, or the browser's date
  and time field for a custom time, and a note; no design for either: `TODO(design)`, the reasons
  and presets as `DurationChips`). Each runs in `features/conversation/messageMenu.ts`. Not yet:
  - tip (`TODO(phase 5, 5b)`): the old trees' `TipBuilder` (a token, $0.01 / $0.10 / $1 steps
    or a custom amount, the fee, paying from an external wallet with its approval, the PIN; not in
    the native apps, `disableTipsFeature`) has its logic in `logic/tip/TipForm`, but the design has
    no tip dialog, and the menu doesn't offer Tip yet (`messageMenu`'s `tipRecipient` is left
    out). The tips a message got (5a) aren't shown either;
  - the thread's items (reply in thread, follow / unfollow) wait for the thread (4c), and a
    proposal's collapse for proposals;
  - the mobile app's "download media" (native save) is left to the narrow pass;
  - the library's `EmojiPicker` has a fixed set of about 56 emoji: no search over all of them,
    no custom emoji (`@CE(code)`, which the old pickers offered) and no skin tones. A custom
    emoji someone else reacted with shows as its code on the chip, and it can't be picked;
  - every reaction added counts towards the quick reactions (the library's picker keeps no
    favourites of its own, where the old trees' picker counted its picks);
  - the delete confirm and the "don't show again" toggle have no design (`TODO(design)`);
  - a link preview is removed with its card's X (5a), not from the menu.
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
- **Bot builder**: no screen yet. When it's built, its owner picker offers `botOwnerCandidates`
  (you, then the users you have direct chats with), as both old `AutoBotBuilder`s do.
