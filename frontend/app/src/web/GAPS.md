# Gaps

Props we had to invent, data the UI expects that the app doesn't have, and library changes the
design export needs. Each entry says where it came up.

## Design / library

- **Accent setting**: done. The accent picked on Landing's theme controls or in Profile (8c) is
  kept in this browser (`theme/accent.ts`) and `App.svelte` puts it on `<html>`.
- **Font size setting** (L4, #10139): done. The app's font size setting (`fontScaleStore`) scales
  the library's `--text-*` tokens: `App.svelte` sets `--text-scale` on `<html>` from it
  (`textScaleOf`, `logic/profile/appearance.ts`, the native tree's, with no platform scale on the
  web), 0.75 to 1.25 by the old trees' factors (`fontScaleFactor`, `@client`), so the default
  (step 2) leaves the design's sizes exactly as they are. Profile's control writes it (8c): the
  design's four sizes are the store's steps 1 to 4, and a stored 0 shows as Small and stays until
  another size is picked, still scaling by its own 0.75 (no one's size moves on its own). The
  store's fifth step has no size in the design. The steps scale by the old trees' factors, not the
  design's sample (0.92 / 1 / 1.1 / 1.2), so a setting means the same in every tree. The chat list
  rows' preview and typing lines were moved onto `--text-md` (the same 12.5px) and Profile's sample
  bubbles onto `--text-base`, by hand (EXPORT-LOG 2026-11-23), so the list and the sample follow it
  too. Left: text whose size is a px value in the library (a `font-size` or the `font` shorthand)
  rather than a `--text-*` token stays as designed, at any setting (the tokens cover most text,
  the chat list and the messages included). In `lib/components`: `RequirementChip`,
  `MessageActions`, `QuickAmountChips`, `SwapOffer`, `MessageGroup`, `PrizeMessage`, `EmojiPicker`,
  `MessageComposer` (its menus' and strips' text; the text being written, in the rich-text editor,
  follows `--text-base`, #10576), `ComposerBar`, `LinkPreview`, `LinkCard`, `Pill`,
  `Tooltip`, `StepIndicator`, `ProposalMessage`, `MediaMessage`, `TransferMessage`, `FileMessage`,
  `PollMessage`, `CallEvent`, `DetailRow`, `ChatPicker`, `CopyButton`, `ProgressTimeline`,
  `ListSectionLabel`, `SortableInputList`, `AmountCard`, `UndoToast`; and 26 of the app components
  in `features/components` (Profile's own labels, the wallet's, the call's, the builders' …; find
  them with `grep -rlE "font(-size)?: ?[^;]*[0-9.]+px" openchat-ui/src/features`). Each is a
  library change with no new design: a px size that matches a token moves onto it, and one that
  doesn't follows the setting through the library's `text-size($px)` (`lib/styles/_mixins.scss`,
  its px times `--text-scale`, as the native kit's `NativeMenu` and `SettingsSegmented` use it).
  The only design question is whether a given element should scale at all (a fixed-size chip or
  icon label, say).
- **Offline** (#10564): done, TODO(design) (the web plan has no offline indicator). While the
  client's `offlineStore` says the app is offline, the library's `OfflineStrip` (the native
  shell's too: the offline Banner's tone and icon) runs full width across the top of the window,
  above the whole app, saying so and that what shows may be out of date (`offlineBanner`), its text
  wrapping to a second line on a narrow window. The app moves down under it rather than going under
  it: its height goes on the root as `--offline-strip` and Shell's frame starts below it, so it
  covers nothing (decided 2026-11-21: a banner floating at the top had covered the open
  conversation's header). It opens and closes over 0.2s with the app (none with reduced motion).
  The layout switch's banner and a ringing call's card sit under it; dialogs and their veils may
  cover it. No action or dismiss: it goes once the connection is back (`shell/OfflineBanner`, in
  `AppScreen`, so the marketing pages have none). It shows after 1.5s offline (at once when the
  app starts offline) and goes 0.5s after the connection is back (`logic/network/offlineIndicator`,
  shared with the native strip). Confirm with design.
- **Sending offline** (#10591, web and native): done, TODO(design). A message sent without a
  connection waits, rather than failing: it shows as sending (the library's `sending` status,
  with no Retry; its menu offers Delete and Copy, not Retry) and goes by itself once the app is
  back online, each chat's (and thread's) oldest first. The client queues it (`OfflineSendQueue`,
  `localUpdates.addQueuedMessage`; only with `queueOfflineSends`, which only the new trees'
  `createOpenChatClient` turns on, `NEW_UI_BEHAVIOUR`: the old trees still fail it, with Retry).
  No connectivity is the agent's `offline` answer, anything thrown while the app is offline, or a
  request that got no response (`isTransportError`); a backend's answer, a rejection or a timeout
  while online fails it, with Retry, as before (`sendFailureCause`). One whose sends get no
  response three times in a row while the app says it's online shows failed, with Retry
  (`staysQueued`); one sent again that the backend already has (the IC had taken it before the
  connection went) counts as delivered, with no failure shown; one whose
  chat has gone once the chats are in shows failed. A new message in a chat with queued ones
  waits behind them, so they go in the order written. Queued messages are kept on
  the device with the failed ones (marked `queued`, no cache version bump) and go on start-up
  once online. Text, replies, forwards and attachments (photos, videos, files, voice: uploaded as
  part of the send) queue; what the network builds or signs (a crypto transfer, a prize, a P2P
  swap offer) and polls don't: offline, they aren't posted at all, the draft keeps them and the
  composer says it couldn't send (a transfer's dialog says the device is offline, `offlineError`).
  Left: no "waiting for connection" wording of its own (it looks like any message sending; design
  may want a clock); a queued message can't be edited; its mentions and the rules accepted for it
  are kept in memory only, so after a reload it goes without mentions, and one in a chat whose
  rules need accepting shows failed, with Retry, rather than asking out of the blue (unless the user
  agreed to those rules as they joined, "Agree and join", which is kept on the device: it goes with
  that agreement); a picture in
  one shows broken while it's sent again (the failed message's object URL is revoked, as a Retry's
  always has been).
  - **The chat list** (2026-11-22, web and native): a row shows the user's latest message there
    that the backend doesn't have yet when it's newer than the chat's latest, "You: …", with the
    sending clock (on its way, or queued) or a red failed mark (`ChatRow`'s `previewIcon`, by
    hand, EXPORT-LOG 2026-11-22); its time and the list's order follow it
    (`logic/chats/unsentMessages`). Not in the old trees, whose rows show the latest confirmed
    message. TODO(design): the failed mark (no "Not delivered" words in the row), and whether a
    thread's unsent reply should show too (it doesn't, as a row shows no thread replies).
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
  - Status-bar glyphs: light on the call screen (N14, `setDarkScreenUp`), following the theme
    elsewhere, through the Tauri plugin. The minimised call doesn't change them.
  - For the design: the prototype's Appearance setting is "Chat text size" (Small / Default /
    Large) and only resizes messages (`--text-xs` / `--text-sm` / `--text-base` in the
    conversation: 9 / 10.5 / 12.5, 10 / 11.5 / 13.5 and 11.5 / 13 / 15.5px), while the brief and the
    issue ask for an interface size wired to dynamic type. N1 scales every `--text-*` size by the
    app's four steps (0.875–1.25) times the platform's scale, kept within 0.75–2; N12 settled
    it as the interface size ("Native You tab", below). The light theme's `--tint-row` / `--tint-pill` (black at 5% / 8%) are
    ours: the export only has the dark values (as fallbacks), and its light theme had no
    `--hero-base` either. The prototype pads the bottom by a fixed 34px on iOS (the home
    indicator) and 12px on Android; `--safe-bottom` is the device's inset alone, so N2's bars
    pad by `--bar-end`, the safe area but at least 12px. The prototype's top padding (iOS 54px,
    Android 4px) is `--safe-top` alone, on both.
- **Native shell kit** (native N2, #10365; `@openchat/ui/src/native`, EXPORT-LOG 2026-11-05). N3
  (#10366) put `data-os` on the native root (the app's platform, else the user agent's) and built
  the shell on it (`src/native/README.md`). Left:
  - Haptics: done. The native root installs the Tauri plugin's new `haptic` command (Android's
    keyboard-tap feedback, iOS's light impact; with `style: "medium"`, N5d's message menu,
    Android's long-press feedback and iOS's medium impact) in the apps, and nothing on mobile web
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
  - **A push moves what's under it a little, as iOS's** (decided 2026-11-07, in place of
    2026-11-06's "nothing under it moves"; the Design Notes' §3.1 Transitions also had the bar go
    down): the pushed screen slides in from the inline end over the screen under it, which moves
    28% of the way out to the other side, a tab's root and its tab bar together as one (the bar
    doesn't go down); Back slides the top one off as the one under it comes back. A push takes
    .34s, Back .24s, both screens together on `--ease-out` (`Shell`, `motion.ts`). A screen pushed
    over another works the same; the signed-out start's stack too. Mirrored in RTL; nothing moves
    with reduced motion.
  - **Local pushes**: done (N5a). A screen without a URL on the web (New chat, New group, CHIT for
    now; details, settings pages and builders to come) is pushed with `context.push`
    (`TabStacks.push`, a `LocalScreen`): it shows at the URL of the screen under it, Back (the
    header's, or Android's) takes it off, tapping the tab takes them all off, and the URL moving on
    replaces it, as picking someone in New chat opens the chat in its place. A browser's own Back
    is the history, which a local screen doesn't add to: it leaves the screen under it too.
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
    start (no guest mode, notes §3.1), the URL kept for after sign-in; a session from before shows
    the app's background while it loads, so Welcome doesn't flash (`startEntry`), and a spinner
    fading in only if that takes over a second (`Spinner`'s `delay`, at the user's request; the web's
    start-up gate, `appGate`, does the same; by hand, EXPORT-LOG 2026-11-21), or an error with Retry
    at once if that load fails (`identityLoadFailedStore`, #10562). The marketing pages (Landing,
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
    a `/share` link shows the Chats root. N5d's forward sheet picks several chats and doesn't
    open them, so it isn't that picker; its rows (`forward.adapter`, on the shared
    `chatsToShareTo` and `shareTargetsInSections`) are what a share sheet would list.
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
  - An app store build has no Wallet tab (`disableWalletFeature`), and a wallet URL (`/wallet`, a
    token's page, a flow) opens the Chats tab, as an unknown page does (`locations.ts`' `wallet`;
    N10a). The wallet's screens aren't in a store build's bundle (`screens.ts`).
  - **Android's system back** comes from whichever of two callbacks on the activity takes it
    (`shell/systemBack.ts`): Tauri's own (its `back-button` event), which otherwise took the
    WebView back through its history, so a screen pushed without a URL (a settings page) went back
    to the URL before it, often another tab (found testing N12), or MainActivity's
    (`back-pressed`). The shell listens to both; one press sends one.
  - **Screens' chunks** are preloaded while the shell is idle and kept (`screenModules`); the shell
    goes to a screen only once its chunk is in, so there's no spinner in the middle of the screen
    (README.md: native screens render at once and fill in what's still coming).
  - The tab bar's Chats count is the unmuted unread DMs and groups, as the web's rail and
    components_mobile count them (decided in N5a): a favourite DM or group is in it, a favourite
    channel isn't (it counts on its community), and neither are mentions on their own. The design
    doesn't say; confirm with design.
  - **The full-screen ring prompt** (#10482): on Android 14+ without the full-screen-intent
    grant, `components_mobile` explains once per launch why a locked phone gets a heads-up instead
    of the full-screen ring, and opens the settings toggle (`utils/native/fullScreenIntent.ts`
    decides when, `FullScreenIntentPrompt.svelte` asks). This tree doesn't mount it yet.
  - **Offline** (#10564): done, TODO(design) (the native plan has no offline indicator). While the
    client's `offlineStore` says the app is offline (the browser's offline event, or the worker
    finding the connection unusable), a slim strip across the top of the window, under the status
    bar, says so and that what shows may be out of date (`offlineBanner`): the library's offline
    Banner's tone and icon as a strip of at least 28px (the library's `OfflineStrip`, the web's too), whose text wraps to
    a second line rather than lose its end, with no action, as the app reconnects by itself. The
    shell moves its screens down under it: its height goes on the root as `--offline-strip`, which
    the stage adds to `--safe-top`, so it covers neither a header, the tab bar, a composer nor the
    toasts, which is why it isn't components_mobile's `OfflineFooter` at the bottom. It opens and
    closes over 0.2s with the screens coming down and back up with it (none with reduced motion);
    a conversation keeps its newest message where it was. The call's overlays outside the shell
    keep clear of it too (the minimised call's top, the ring card). Sheets and menus, portalled to
    `<body>`, can still reach up over it (they're over everything while they're open). It shows after
    1.5s offline (at once when the app starts offline) and goes 0.5s after the connection is back,
    so a blip doesn't flash it (`logic/network/offlineIndicator`, shared with the web's banner).
    Only in the tabs: the signed-out start has none. Confirm with design: the strip, its words, and
    whether sends and other actions should say they wait for the connection.
  - **Over-the-air updates** (#10566): not built, needs design. The native apps will take updates
    of the web bundle that don't go through the app stores; while one downloads or applies, the
    user needs a progress bar, then what happens next (restart now, or it applies on the next
    launch), and a failed one. Needs the update mechanism (how updates are delivered and applied,
    what progress events the shell sends) and the design (the bar, and the downloading, ready to
    restart and failed states).
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
- **Native Chats tab** (native N5a, #10368; `src/native/features/chats`). Built: the title row
  (CHIT with its claimable dot, the kebab: New group, Mark all as read), the search, the filter
  (All / Direct / Groups / Unread, kept as `chatListFilterStore` with components_mobile), the list
  (`VirtualList`, pinned first, favourite / muted / pinned icons, the forward icon, live calls),
  the row long-press menu, the FAB and New chat. It lists its own scope (`chatsInScope`), so it
  stays right while another tab's route sets another scope (it's dragged into view by the swipe
  between tabs). The rows' previews show mentions as the `@names` typed (`typedMentions`, the
  rows shared with the web's chat list), and so does the forward sheet's preview of the message.
  The rows' previews (and a chat's latest message in the search) render their markdown, as the
  web's chat list's do (see the web's "Chat list").
  Left, or decided against the prototype:
  - **Message search**: the backend has no search across chats, and a chat's own search
    (`searchChat`) returns message indexes without their text, so the search has Chats, People and
    Public groups ("Search chats, people and groups"). Messages, and a result opening the chat in
    search mode on it, need that search (the web's grouped search needs it too, `ChatListPanel`
    pass 6).
  - **Search's People and Public groups** come from the client's `searchChatList(term, { groups:
    true })`, as the web's chat list search (`chatListSearchResults` into `TermSearch`, each kind
    showing as it arrives), less what's a chat already (`outsideList`, over the list's chats and
    `allServerChatsStore`, less those waiting to be left or deleted; `foundResults` in
    `chats.adapter`). People are the people found (the user and anyone they have a DM with left
    out), then the bots that take direct chats, a bot's line its description: up to 10 of each
    (`CHAT_LIST_SEARCH_MAX`, as the web's and the old mobile search's), so Show all reaches at
    most 10 people. Until 2026-11-23 they were `searchUsers`' alone, up to 20. components_mobile's search also listed public groups and the
    design's has none; **native lists them too, the user's decision of 2026-11-23**: a third
    section, Public groups, after Chats and People (first 3, Show all, as the others), each row
    the group's swatch (the search's rows show no pictures), its name and its member count
    (`native.explore.members`). A group the user is in or previewing is under Chats instead.
    Tapping one opens its page (`/chats/group/:id`, the same as `/group/:id`), its preview with
    Join. Store builds: `searchGroups` asks the group index for no Adult or Offensive groups
    (`appStoreBuild`), as on the web and the old mobile search.
  - **Finding a public group** (2026-11-23, the user's decision): the search's Public groups
    section above finds them. TODO(design): how that section should look (the design's search has
    none; it's built from the other sections' rows), and whether Explore, which lists communities
    only, should list groups too.
  - **Mute for 1 hour / 8 hours / 1 week**: the backend mutes until unmuted, so the menu has Mute /
    Unmute, as the web's row.
  - **Mark as unread**: the backend can't, so the menu offers Mark as read only when something is
    unread.
  - **Leave group / Delete chat with Undo** (notes §1: destructive actions show Undo, no confirm):
    the backend can't undo either, so the chat leaves the list at once and the leave or delete is
    sent once the Undo toast has gone (5s, `PendingRemovals`); Undo sends nothing. One still
    waiting when the screen goes is sent then; the app being killed in those 5s drops it. A group
    owner who can't leave hears so when it's sent.
  - **Archive with Undo**: archived at once; Undo un-archives. Archived chats aren't in the list
    (the design has no archive view); search finds them.
  - **Pin, Mute, Mark all as read** confirm with a toast, as the prototype does.
  - **New group** and **CHIT** push placeholders until N7 and N11 build them. When N7 builds
    Create group, its Settings card's Disappearing messages is a `TimedToggle` row (clock icon,
    switch, the same 8 lengths as the details; native plan 11 of 2026-11-10), not a dropdown row:
    the details' `DisappearingRow` words (`valueLabel`, `subtitle`) and `ChatDisappearing`'s start
    at a day apply there too. CHIT is a local push
    (as the prototype's); N11 decides whether `?chit` (the web's) maps onto it.
  - **The Getting started card** (notes §3.1, top of Chats for new accounts) isn't built (N4's
    onboarding).
  - **Avatars** are the design's swatches, as on the web (Swatches, below); no online dot and no
    typing in rows (typing reaches peers only for the selected chat).
  - **A live call** says "Video call in progress": the client doesn't say whether a call is voice
    only.
  - **Favourites** (`/favourite`) are the Chats tab's root titled Favourites, with the same list;
    the design has no way there but a link.
  - **No swipe actions on rows** (notes §1): a sideways drag on a row is the swipe between tabs
    (rows don't scroll sideways), and moving more than 10px stops a long-press. The open search is
    `data-tab-swipe="off"`.
  - **By hand in the library** (EXPORT-LOG 2026-11-06, to take back to the design export):
    `ChatRow`'s `fav` heart (the Component Changes list it; our port had left it out),
    `--shadow-fab`, and `LongPressMenu`: the release of the press that opened it could end in a
    click on the veil, which closed it at once (seen with Chrome's touch emulation); the veil now
    closes it only for a press that started on it.
- **Native You tab** (native N12, #10380; `src/native/features/you`). Built: the You tab (the cover
  with Share and Edit, the avatar, the name with the Diamond pill, the CHIT card with today's claim,
  About with the user ID to copy and Member since, the Account and Settings lists, Sign out), Edit
  profile, Diamond, and the settings pages on the kit's rows: Appearance, Notifications, Chats,
  Communities, Storage, Bots, Account and CHIT's. On the shared logic the web's profile uses
  (`logic/profile`: the form and username check, appearance, notifications, community names, the
  photo and cover uploads; `logic/chit/dailyClaim`; `logic/premium`; `logic/auth`'s sign-in again
  and delete). Left, or decided against the prototype:
  - **Appearance** is the stored theme and accent Welcome's menu and the web use (`themeType`,
    `accentStore`), so the three always agree; System stays the default and follows the phone live
    in a browser and in the Android app, at a cold start and live (checked on the emulator, Android
    17, WebView 151, with `cmd uimode night`): the WebView takes `prefers-color-scheme` from the
    activity's theme's `android:isLightTheme` (targetSdk 33+), which `Theme.open_chat`'s DayNight
    parent inherits from the platform's `Theme.Material` / `Theme.Material.Light`, and with
    `configChanges="uiMode"` the theme is rebased and the WebView told on a change, so no shell
    change is needed. It once looked always light: Playwright's `connectOverCDP`, used to drive the
    emulator's WebView, emulates `prefers-color-scheme: light` while it's attached (a check has to
    call `page.emulateMedia({ colorScheme: null })`). iOS isn't checked yet.
  - **Text size**: decided as the interface size the Build Brief asks for, not the prototype's
    "Chat text size" (messages only, three sizes): the app's font size setting (`fontScaleStore`,
    the web profile's four sizes, Small / Default / Large / Larger), which scales every `--text-*`
    size through `--text-scale`, on top of the platform's font scale (which still needs its native
    bridge, above). Labelled "Text size", in a "Text" card. Confirm with design.
  - **Sign out** asks first (found testing, 2026-11-07; the prototype and components_mobile sign out
    at once), in the kit's `NativeAlert`, which waits while signing out. TODO(design): the
    confirmation isn't in the design; its words and look need a design pass.
  - **Copying the user ID** asks first (#10338: it's not a wallet address), in the kit's new
    `NativeAlert`. **Confirmations** are that alert (notes §1: "small alerts"), which the design
    doesn't draw. TODO(design): the warning (its words, the alert's look, whether copying the ID
    belongs on the You tab at all) needs design work.
  - **Share** opens the system share sheet in the apps (the WebViews have no Web Share API, so it
    only copied the link): tauri-plugin-oc's new `share` command (Android's chooser, iOS's
    `UIActivityViewController`), through every tree's `shareLink`. It needs a shell built with the
    command: an older one rejects it and the link is copied, as before (checked on an older shell).
    The share sheet opens on the Android emulator (Android's chooser, "Sharing link"); iOS's isn't
    checked yet.
  - **The CHIT card** shows the balance and the streak, and today's claim once the first sync is in
    (`dailyClaim`), with the confetti on a claim and a spinner in Claim's place while it's on its
    way; its head opens CHIT (N11, "Native CHIT"). The daily
    puzzle row (only when opted in) isn't there: the app has no opt-in (the web's profile hides its
    puzzle setting too); the puzzle is on the CHIT screen.
  - **Diamond** (the web's `?diamond`, here a URL over the You tab): the membership (Lifetime, until
    when, or none), what Diamond gives (the app's own `upgrade.*` list: the prototype's sample perks,
    10 GB and unlimited groups, aren't what Diamond gives), the invite link to share, and a pinned
    Upgrade to Diamond (Extend Diamond while one runs; none for lifetime). The You tab's row says
    Not a member without it. Buying or extending isn't built: it's paid from the wallet with the PIN
    (`payForDiamondMembership` asks for it whenever the user has one), which needs N10b's sheet, and
    the design has no purchase step (length, token, price, auto-renew: the prototype only shows a
    lifetime member). So the button says so in a small alert (NativeAlert as a notice) and points to
    oc.app on a computer; the shared payment (`logic/diamond`) is ready for the real step. An app
    store build has no Diamond payments (`disableDiamondPaymentFeature`), and no button.
    TODO(design): the purchase step.
  - **CHIT's settings** are at the web's URL (`?profile=chit`): CHIT on or off, achievement alerts,
    hiding the CHIT button once claimed. The design's daily puzzle choice (Hidden / Show / Show +
    remind) isn't a setting the app has.
  - **Edit profile**: the display name, the username (live check, as sign-up's), the bio (the app's
    2000 characters, not the prototype's 200), Save only when something changed (`ProfileForm`),
    back to the You tab with "Profile updated". The photo and the cover are each picked, cropped in
    the N4 crop sheet (now also a rectangle for the cover) and uploaded at once, outside Save, as on
    the web. The cover is a premium item, paid in CHIT before the first one (a sheet on
    `logic/premium`, as the web's dialog); it's saved as a banner (600 × 300, as components_mobile
    saves it), where the web saves 600 × 800: both show cropped to fit. TODO(design): no crop step and
    no premium payment in the native design; the CHIT buy sheet for the cover (what it costs, the
    balance, Pay, and "keep collecting" when there's too little) needs design work.
    The keyboard comes up over Save rather than pushing it up, and the field being typed in scrolls
    above it (`aboveKeyboard`, as Pick a username's), so Save is behind the keyboard while it's up.
  - **Notifications**: in a phone's browser, the master switch is web push's, as on the web (on asks
    for the permission, off stops offering them; a browser that blocks them says so). The apps'
    notifications are the phone's (FCM / APNs, registered on every sign-in), so there the switch is
    off and disabled with a note that the phone's settings turn them off, and the You tab's row
    shows no value (Off only when web push is blocked or switched off). Turning them off in the
    app (unregistering the device, and not registering it again at sign-in) would change the shared
    native setup (`utils/native/push_device.ts`); not done. The backend has no per-kind choices
    (direct chats, groups, communities, mentions only) nor lock-screen options (preview, sound), so
    those cards aren't here.
  - **Chats**: the settings the app has (as components_mobile's Chats & video calls): low bandwidth,
    hiding blocked users' messages, how calls start, the ringtone (a value menu; the one picked plays
    for 3s), and restricted content (not in an app store build, `disableRestrictedContent`). The
    design's read receipts, typing indicator, link previews, translation and auto-download aren't
    settings the app has. Enter sends and double-click to reply (the web's) don't apply to touch.
  - **Communities**: the user's communities, each with the name they go by there; a sheet sets it or
    goes back to the display name (`logic/profile/communityName`). The design's "Use my display name
    everywhere" switch isn't a setting the app has. Without a community, an empty state (the kit's
    `EmptyState`) with Explore communities. TODO(design): the page with no communities isn't in the
    design.
  - **Storage**: the backend storage used against the allowance, the browser's estimate of what the
    app keeps on the phone (`navigator.storage.estimate`, its share of the quota), and Clear cached
    data with Undo: it waits out the Undo toast (5s), then clears and restarts the app (every tree's
    `clearCacheAndRestart`). Leaving the page meanwhile doesn't stop it.
  - **Account**: the sign-in methods linked to the account (read only: linking and unlinking are on
    the website's profile for now; the design's rows open nothing yet either), Report an issue
    (OpenChat's bug report channel, `utils/support.ts`, shared with the old toasts' "report a bug";
    the channel opens in the Communities tab, N8a's), and Delete account: a pushed screen with the
    steps the design's profile has (the export's `ProfileDialog`; the native prototype only toasts
    "Deletion is a separate confirm screen in the real app"): the chats, the wallet and the CHIT,
    each offering to stay, then the last, which takes the @username typed out before signing in
    again in a sheet (`ReAuthentication`, new `cancelEmail` / `lastEmail`) with a passkey, Internet
    Identity, NFID or an emailed link, then `deleteAccount`. A wallet's sign-in (Ethereum, Solana)
    isn't offered there; such an account says to delete on the website. The design's CHIT step
    offers a bribe ("we could even throw in a few more CHIT… I love a good bribe, I'll stay"): the
    backend has nothing that gives CHIT for staying, so the words leave it out ("Okay, I'll keep my
    CHIT"). TODO(design): the steps as a native screen (the design draws them as the web profile's
    sub-dialog). A password manager may offer to save the typed username (NordPass did on the
    emulator).
  - **Recovery phrase**: not there (the backend has none, as in N4's entry above).
  - **Bots**: the connection details to copy, loaded as the page opens.
  - **"Switch to desktop site / mobile site"** (N3's entry above): still no screen sets it.
  - **Android's back** doesn't close a `SettingsValue`'s menu (the kit's row keeps its anchored menu
    to itself): it pops the page.
  - **Strings**: the settings' help texts are new (`native.you.*`), translated; the library's
    `ui.profileDialog.*` copy is English only.

- **Native conversation** (native N5b, #10369; `src/native/features/conversation`). Built: the
  header (back, the avatar, the name and its line: last online, a suspended account, or "Public ·
  5 members"; video and voice; the kebab), its menu (Search in chat, the details, Mute, Favourite,
  Leave / Block / Unblock / Delete with Undo), search in the chat,
  the messages on `core/ChatEventList` with the web's mapping (moved to `logic/conversation`,
  which both trees now use), sent ones on the right, no avatars in DMs, the swipes, the typing
  bubble and strip, call items and the media viewer. Left, or decided against the prototype:
  - **The composer** is N5c's ("Native composer", below), with the typing strip resting on it. A
    swipe sets the chat's draft (the reply, or the edit), which the composer shows, and the
    message is marked.
  - **A preview's join bar** (N8b PR 1, native/features/join): a channel not joined, a group or a
    community previewed shows the design's note over Join in the composer's place. Join joins what
    logic/join's `previewBar` targets: a channel of a community being previewed names the community
    ("Join community") and joins both. A locked chat and a lapse keep the old footers' words
    (Locked, Re-join). Ours: the design has no words for a group, so it's the channel's
    ("You're previewing Pixel Art. Join to send messages.", "Join group"); a guest gets "Sign in to
    join".
  - **The requirements sheet** (N8b PR 2, `JoinSheet`): "Review and join" asks the client, which
    answers with the requirements; the sheet shows them as the design's checklist, a level at a
    time (a gated channel in a gated community: the community's, then the channel's), over Join
    ("Pay 3.00 ICP and join"). It walks logic/access's `GateEvaluation` and records the choice with
    logic/join's `recordGateChoice`, as the web's dialog does, so what's approved is the gates' own
    amounts. Ours, where the design doesn't say: an "any" gate takes a requirement already met (paying
    nothing), else the first payment the wallet covers, with no picking between them (the web's
    dialog lets the user pick); the neuron row is a checkbox the user ticks; amounts are the old
    trees' (`formatTokens`: "3.00"); the note under Join is the old words for where a payment goes
    (`access.paymentDistributionMessage`). Left: "Get ICP" on a payment the wallet can't cover
    (TODO(design), once the wallet is native, N10); a requirement the backend finds unmet says
    "Access gate not met", not which one.
  - **Agree and join** (the user's decision, 2026-11-20): Join first reads the rules of what's
    joined (logic/join's `beginJoin`, the client's `rulesToAcceptBeforeJoining`: a group's or
    channel's own, and a channel's community's when the user hasn't accepted them, each if
    enabled) and, with any, opens the join sheet on them: the rules (Markdown, as the pre-send
    `RulesSheet`), Cancel and "Agree and join" (`agreeAndJoin`). Requirements to meet then take
    the rules' place in the same sheet; a join that doesn't go through leaves the rules up with a
    toast. The client keeps what was agreed to in the user's cache on the device, through a
    reload or a restart, and the first message there accepts it without asking (as the web's,
    below). TODO(design) (the user, 2026-11-23: a design gap): the design has no sheet for
    accepting a group's, community's or channel's rules, neither on joining nor before a send
    (the pre-send `RulesSheet`); ours borrows the pre-send sheet's look, with "Rules of {name}" and
    "Agree and join", and a channel's rules and its community's each under a heading. Wanted from
    design: the sheet (title, the rules' layout, long rules, the buttons), the same for the web's
    dialogs, and how the rules step and the join requirements follow each other. The sheet fits its content, so its
    height changes from the rules to the requirements. A community's preview joins the community:
    only its rules are asked for, and a channel's own are asked for before the first message in
    it, as before.
  - **A community's preview** (N8b PR 3, native/features/communities): `/community/x`, not joined
    (or lapsed), shows the design's preview at the Communities tab's root: the cover with Back and
    Share, the avatar, name, "Public · 1,284 members · English" and about, the Requirements card
    and the public channels (each opens the channel with the join bar), over Join. The card's rows
    are the requirements sheet's (`sheetRows`), all of them, met ones included, with the design's
    statuses (Met, On join, Not met, To do) and a note (all or any, and how often members are
    re-checked). Join is the join bar's (`JoinButton`): it joins the community alone. Ours: the top
    is the details screens' (`DetailsHead`: 88px avatar, 132px cover), not the design's 80px and
    170px. A preview is pushed over Explore (N8a), and Back goes there; at the tab's root (a link
    opened cold, a moment before the community is known) Back cancels it (`cancelPreview`). A
    member's page is N8a's ("Native Communities tab"). Left: a community the client can't find shows a spinner. The
    Requirements and Channels cards are shared with the community's details
    (`RequirementsCard`, `ChannelsCard`).
  - **Explore** (N8b PR 4, native/features/explore): the search, the language button (with a count
    once any are picked) and the picked languages as pills (Clear with more than one); browsing,
    Featured and the shelves, a shelf hidden under 3 communities, View all pushing its whole list;
    with no shelf left (a language with few communities), every community in one list; searching,
    the results. Pages come from the shared search (`communitySearchState`, the web's), filtered
    by the languages saved on this device (`communityFiltersStore`) and the viewer's moderation
    flags, one more as a list nears its end. The language sheet is Welcome's (`LanguageSheet`),
    with checkboxes and the design's Clear and "Show 2 languages". Ours, as the backend has one
    ranking, most members first (#10405): Featured is its top 3 communities the user isn't in,
    and Popular the rest; the design's Fastest growing, Most active and Recently added shelves
    wait for #10405, as do a row's metric (growth, messages, age), so a row shows its language
    instead. A shelf swipes only once it has a second full column; fewer rows are one column the
    screen's width (the design's peeking column read as cut off on a short shelf). Left: the
    language sheet has no per-language counts (the backend gives none); the
    search text isn't in the URL (the web's is).
  - **A message's long-press menu** (native N5d, #10371): built (`MessageActions`, the kit's
    `MessageLongPressMenu`). Left, or decided where the docs don't say (the prototype wasn't
    available):
    - **Its items**: the design's Reply, Forward, Copy, Info, Edit, Delete, Report, and between
      them the rest of what `messageMenu` offers that the native tree carries out: Reply
      privately, Translate / Untranslate, Pin / Unpin, Copy link, Share, Cancel reminder, Retry,
      Reveal, Undelete, and Block (a group's) after the divider; Reply in thread after Reply, and
      Follow / Unfollow thread after Edit (N8a). Not offered yet: a reminder (no native sheet for its time yet: the web has
      `ReminderDialogScreen`; when it comes, its toast says when with View to the OpenChat Bot's
      DM, as the web's does: `reminderSetText`, decided 2026-11-19. A message's pending-reminder
      marker and a list of pending reminders wait for the user's design round, as on the web:
      "Message actions" under App), tipping (the web's is `TipDialogScreen`, 5b; native passes no `tipRecipient` to `messageOffer` until it has a sheet for it, and never tips in a store build). Info isn't offered on what
      can't be acted on (deleted, blocked). The card is 240px with 48px rows, measured as it lays
      out. Past the notes' four placements round the message (ours): the whole card at the
      screen's bottom, over the message, the reactions above it (or at the screen's top); it
      scrolls (without a scrollbar) only when it can't be whole anywhere. What's under the veil
      (the composer, the header) is room: only 12px from the screen's top and bottom isn't, the
      safe areas counting towards it, so a message just above the composer gets the card above it
      and the reactions below it, over the composer. The reactions and the card line up with the
      bubble's own box (`data-oc-bubble`, else the first element that draws a box), not its text,
      when a wrapped bubble is as wide as its row.
    - **Reactions**: six quick ones, the user's most used first (the shared `quickReactions`
      store), then +, which opens a bottom sheet (notes §1: pickers are sheets; the design doesn't
      show where the + goes; 72% high, the kit's `BottomSheet`) with the composer's emoji panel's
      emoji (`ReactionPicker` on the panel's `EmojiGrid` and `EmojiSections`): Recent, every emoji
      by category with the category bar, and a search. Ours: no GIF tab or backspace, and the
      search is a plain field in the panel's style (`EmojiSearchField`): with its keyboard up the
      sheet sits on the keyboard, the results under the field (07's search strip is the keyboard
      slot's, not a sheet's). The reactions the user has are marked, and picking one takes it off. A reaction
      added goes to the front of Recent (the composer's: the same per-user list) and counts
      towards the quick ones (`toggleReaction`, as the bar's do); one taken off counts for
      neither.
    - **Text**: a message's text can't be selected, in the chat, the menu's copy of it or Message
      info (a long-press is the menu, which has Copy); should a selection have started in the
      message pressed anyway, it's cleared as the menu opens. The web's messages stay selectable.
    - **Delete** (and "delete for me") asks first while the "ask before deleting" setting
      (`confirmMessageDeletion`, on by default) is on: a `NativeAlert` with the web dialog's words
      ("Do you really want to delete this message?", Delete), the shared `messageAction`'s "ask".
      Then, or at once with the setting off, it shows deleted and its toast (waiting for the
      backend, then "Message deleted") offers Undo, which undeletes it (notes §1: destructive
      actions show Undo). The alert has the web dialog's "Don't show me this again", as a checkbox
      (`NativeAlert`'s `checkLabel`), which turns the setting off once the delete is confirmed
      (the web's toggle turns it off at once, Cancel or not). The native tree has no setting
      screen for it, so once off it stays off on that device. A failed message's Delete just
      removes it.
    - **A deleted message** (the design of 2026-11-19): its placeholder ("You deleted this
      message" / "This message was deleted", as the web's) has no swipes and no reactions, and a
      long-press menu only where `messageMenu` offers Reveal, with Reveal alone
      (`nativeMessageOffer`): a deletion of your own, within five minutes, or a moderator's
      deletion of someone else's message, which they can always reveal (the user's decision of
      2026-11-20, against the design's "no long-press menu"; a review of #10553 kept the
      moderator's, which gating on the sender had dropped). Any other has no menu. Revealed,
      it's only peeked at, as on the web (below, "Message kinds": revealed): its bin in the ticks'
      place, its long-press menu Copy, Undelete and Hide (no Info, no quick reactions, no swipes),
      its reactions read only. A tap toggles its popover (who deleted it and when, as the web's), and a press
      elsewhere closes it; a long-press doesn't. Your own delete's Undo, in its toast, also
      brings it back. The design's "deleting
      your own message leaves the placeholder, with a 'Message deleted' toast and Undo" was already
      so (the client marks it deleted at once, and your own deleted messages aren't folded into
      the "N messages deleted" line). On the Pinned messages screen a deleted pin's placeholder has
      no popover (`pinnedMessage`): a tap there goes to the pin.
    - **Words**: toasts for Copy ("Copied"), Copy link ("Link copied to clipboard"), Pin and Unpin
      (each with Undo: Pinned messages, below), Undelete, a delete and its Undo, a forward ("Forwarding to 2 chats…", then "Forwarded to 2
      chats") and a report; the web says nothing for Copy or Pin. Copy link and Share, like every
      action, come back from the shared `messageAction` as an outcome each tree shows its own way
      (the web's toasts are as they were). Translating without Diamond offers it in a `NativeAlert` (Get
      Diamond opens `?diamond` on the You tab) rather than the web's upgrade dialog. A private
      reply that can't make the DM says so in a toast (the web publishes `notFound`).
    - **Message info** (a local `message_info` screen): the message as the chat draws it, Sent,
      a DM's own message's Status (Sending, Sent, Read, Not sent), Forwarded, Edited, and who
      reacted with what. Groups' "Read by" / "Delivered to" and an edit history aren't kept by the
      backend, so they aren't shown; "Edited" says only that it was.
    - **Forward**: several chats at once, without opening them (the client's
      `forwardMessageToChats`), the note sent after the copy as a message of its own; the web
      opens the one chat picked and leaves the note in its draft. A chat whose rules the user
      hasn't accepted refuses the copy (it shows failed there, and the retry asks for the rules),
      as the client only knows the open chat's rules. @usernames typed in the note are mentioned
      where they're members of the chat it goes to (each is looked up there); a community's user
      groups and @everyone aren't known outside the open chat, so stay as typed. A forward that
      would take more sends than the send throttle allows in the minute (the copy, and the note,
      per chat: 10 a minute, 20 with Diamond) sends nothing and says so ("forward to fewer chats,
      or wait a moment"), rather than some chats getting it and the rest nothing. The sheet starts
      afresh each time it opens. The open chat isn't offered, as in every
      picker. DMs show their @username, not when they were last online (the web's picker loads it).
      While its search or note field has the keyboard, the sheet sits on it (the kit's
      `BottomSheet`'s `keyboard`, fed `softKeyboard.covering`: the conversation keeps the Android
      app's viewport resize off), as the reaction sheet does.
    - **Report** is a bottom sheet with the web dialog's words (the design has no report screen).
    - **Not checked in a browser**: removing a link's preview (the local replica's previews don't
      load) and the menu in RTL (spec'd only).
    - **One haptic**, medium, as the menu opens: `MessageActions` plays the kit's
      `haptic('medium')` (the plugin's `haptic` with `style: "medium"`: Android's `LONG_PRESS`
      feedback, iOS's `UIImpactFeedbackGenerator(style: .medium)`), once even if a press opens the
      menu twice (Android's own long-press, then the group's timer), and the chat's `MessageGroup`
      plays no vibration of its own (`pressVibration={false}`). A shell built before the style
      plays its light tap. Not checked on a device. The swipe's armed haptic is still
      `MessageGroup`'s `navigator.vibrate(10)`.
    - **The keyboard under the menu** (the user's decision, 2026-11-12): a long-press with the
      composer's keyboard up takes the keyboard down (Android's long-press takes the focus off the
      text box, and the menu takes it), but its space stays kept at its height, an empty panel
      (the keyboard-area panels' `--surface-1`, corners and line) under the veil, so the chat and
      the composer don't move under the menu's copy of the message (`KeyboardSlot`'s
      `holdForMenu`, `held`). Once the menu, and whatever it opened, has closed (`MessageActions`'
      `onSettled`), the text box is focused again and the keyboard comes back up into the space,
      which is let go once it's up (`afterMenu`): after Esc, back or a tap outside, a reaction (the
      bar's, or the emoji sheet's once it closes), Copy, Copy link, Pin / Unpin, Translate, Share, a
      delete (after its confirm, or Cancel), the forward and report sheets once they close, and
      Reply and Edit (which focus it themselves). Info (Message info pushed), a private reply (the
      DM opens), Get Diamond and another chat opening meanwhile (a notification) let the space go
      (`MessageActions`' `leave`); Back to the conversation then finds the keyboard down. The
      space stays held as the text box is focused again, even where the keyboard's "down" for the
      menu hasn't been reported yet (a menu closed at once), until the keyboard's back up; that
      focus isn't the reader's tap, so where the platform shows no keyboard for it, the space is
      let go after the slot's wait (2s), without asking again. Measured per frame on the emulator: the message's top stays where it was
      from the long-press until the keyboard is back. Only where the keyboard's height is reported
      (the Android app): in the iOS app and phones' browsers the platform lifts the page, so the
      chat still moves down as the menu opens there, and the keyboard isn't put back.
    - **No press feedback yet** (to do): holding a message shows nothing until the menu opens.
      The current mobile app scales the bubble while it's held (component-lib's `longpress`
      action, `animation: "scale"`, as `ChatMessage` uses it): halfway through the hold (300ms of
      600) the bubble scales down to 0.95 over a quarter of it (150ms, ease-out), and as the menu
      opens it scales back up to 1, a small bounce that says the press is taking. The native
      conversation should do the same on its bubbles over `MessageGroup`'s 500ms hold (a release
      or a move before then puts it back), with none under reduced motion.
  - **Pinned messages** (the native plan's 04 of 2026-11-10): built, the strip under the header,
    the Pinned messages screen (`pinned_messages`) and Pin / Unpin in a message's menu, on the
    shared `logic/pinned` loader. Left, or decided where the plan doesn't say:
    - **Not in DMs** (open question): the plan has anyone in a DM pin, but the backend has no pins
      in direct chats (pinning is the group and community canisters' `pin_message`; the user
      canister has none, and `pinMessage` takes a group's or channel's id), so a DM offers no Pin
      (`canPinMessages` is false for one) and shows no strip. It needs the backend first.
    - **The order** (TODO(design)): the strip goes newest first and the screen oldest first by
      the message, not by when it was pinned: the backend keeps the pin's time but sends only the
      pinned messages' indexes.
    - **"Pinned by"** under each pin isn't shown: the backend doesn't say who pinned a message (the
      timeline's "pinned a message" event does, but it's only there for what's loaded). It needs
      the backend to send it with the pins.
    - **Undo**: an unpin (the menu's, a pin button's, Unpin all's) isn't sent until its toast has
      gone (the shell's `PendingRemovals`, as a leave), so its Undo sends nothing; meanwhile the
      pins are gone from the strip and the screen, and the menu offers Pin again, which takes the
      unpin back as its Undo would (no toast, nothing sent). A pin shows at once; its toast waits
      for the backend, then offers Undo, which unpins it (an unpin of its own, so others may have
      seen it). Unpin all unpins every pin in the chat's pinned set, also those that didn't load
      (deleted, out of reach), and counts them so.
    - **Going to a pin** (the strip's tap, the screen's tap or Go to message) puts the message in
      the middle of the list (ChatEventList's `scrollToMessageIndex`, as the search does), not the
      upper third, and marks it in the accent for 1.8s. The strip moves on to the next older pin
      as it's tapped, round to the newest.
    - **Loading**: the conversation loads its pinned messages as it opens (the strip needs their
      authors and text), through the loader the web's group panel and the old pinned lists use,
      which marks new pins read; the Pinned messages screen shows the conversation's (through
      `jumpRequests`), not fetching them again. The loader loads again only as the pinned set
      changes, the chat's details arrive or the chat changes (its summary's `lastUpdated`, so an
      edit to a pin shows; the cache serves the pins that didn't change), not on every update to
      the details, and keeps the latest load's result (a slower, older one is dropped): the web's
      group panel and the old lists get both. A pin's date that arrives after its pin marks the
      loaded pins read without fetching them again. The strip shows its title
      until they're in; its line is "Author: first line" as the chat list previews a message
      (restricted content as such, the reader's translation), the author's name escaped
      (`escapeMarkdown`).
    - **The screen**: its list starts at the bottom (as a chat does), so a few pins sit at the
      bottom of an otherwise empty screen. Its bubbles are the chat's without their controls (a
      poll's vote, a photo's viewer): a tap goes to the message. The pin button sits on a bubble's
      open side (after a received one, before your own). Its empty state has the pin icon over the
      plan's words (ours: the plan has no picture). Unpin all is a danger item in ⋯, as is the
      alert's Unpin all.
    - **Group details** have no way to the pinned messages: the plan's 10 has none (the web's group
      panel does). Only the strip's list button opens them.
    - **The live call's strip** (to go with N14, plan 04) still shows, under the pinned strip.
    - Checked in a desktop browser at a phone's size against the local replica; not on a device.
  - **A message's thread** (N8a): the replies link under messages pushes the thread screen (its
    replies, composer and Follow); see "Native Communities tab" below.
  - **The details** (the header's title, the menu's details item): done (N6), the local
    `chat_details` screen ("Native details", below).
  - **Calls (N14, PRs 1 to 3):** the header's video and voice buttons start a call (one button
    starting a broadcast in a public chat). While a call the user isn't in is going on, both join
    it as its type and the one of its kind is green and pulses three times (plan 09, 2026-11-10),
    with no strip under the header; in the user's own call there, both go back to it. The live
    item has Join or Leave, an ended call Call back, and DM details' Call a voice call. The call
    screen (`features/call`): always dark, video up to 3 stacked with the user's camera floating at
    six spots, 4+ in a 2-column grid, voice as centred avatars; Mute, Camera (video only), Speaker
    (the Android app only: a browser can't switch between earpiece and loudspeaker) and Leave,
    hiding after 4s in video; a broadcast host's requests to speak as the library's
    `SpeakRequests` cards under the top bar. Minimised: a video tile or voice pill at six spots,
    clear of the header and the tab bar; on iOS always the pill, as the native screen has the
    media. A host's waiting requests are a count badge on it (the library's `Badge`), popping as
    one arrives; tapping it opens the cards (undesigned, decided 2026-11-19). While a call the user
    isn't in is going on, the scroll-to-the-latest button is green with a phone badge and pulses
    three times as it appears (plan 04), exactly while the header's button is live; it's the
    design's 40px round button now in both states, not the square `IconButton`. Android's Back minimises the call screen. A call started elsewhere rings in a phone's
    browser as a card under the status bar (`IncomingCall`; the apps ring with the system's own
    screen), and the host ending a broadcast or refusing a request to speak is a toast. Left:
    - Undesigned, built from the call screen's parts: the ringing card, the request cards and the
      minimised call's request badge.
    - PR 3 (needs a shell with it; an older one keeps the Speaker toggle and has no picture in
      picture): with headphones connected Speaker opens the output menu of what the Android shell
      lists (speaker, phone, a wired headset or a Bluetooth device, named where the call is
      transactional, Android 16 QPR2+);
      picture in picture for a joined video call in the Android app (12+ by itself, 8 to 11 on
      leaving), full bleed with no controls; flip camera on the user's own tile, which stops
      mirroring on a back camera. Phones' browsers have no picture in picture or output menu.
    - Not built: the design's Video button in a voice call (an audio call's room sends audio only,
      #9465).
    - Checked in a desktop browser with the native tree forced; not on a device.
  - **A swap offer's Accept / Cancel**: still no button in the native tree (`withHandlers`
    without `swap`). The kit has its alert now, but accepting asks for the wallet's PIN, whose
    sheet is N10b's: with a PIN set, the client's prompt would wait for a sheet that isn't there.
    It comes with N9 / N10b, on the web's start and settle (to move to `logic` then).
  - **A link preview's remove** (the X on the sender's own card): done in N5d, after a
    `NativeAlert` ("Remove preview?"), on the shared `logic/conversation/linkPreview`.
  - **The media viewer** is the app's (`core/MediaViewer`, moved from `src/web` and kept clear of
    the status bar), not the design's (sender, actions, swipe between items, chrome that fades);
    that waits for the design's `MediaViewer` to be ported to the library (Design pass 6, above),
    for both trees. A file's download is the web's (`saveFile`); the apps' save to Photos / Files
    needs a native bridge.
  - **Search in the chat** hides the composer while it's open (it has no use for it), and it's
    back when the search closes. It scrolls the match into the middle of the list (ChatEventList's
    `scrollToMessageIndex`, which isn't rewritten for it), not the upper third. It has no
    @mention picker (the old headers' "@name" still searches for a sender); typing pauses 300ms
    before it searches, as the old ones did; up and down stop at the ends (the old headers went
    round). It takes the chat's own search (`searchChat`), up to 200 matches, the weak ones dropped.
  - **Disappearing messages** are in the header's menu since the native plan's 04 and 10 of
    2026-11-10 (the decision of 2026-11-07 to leave them out is gone): Disappearing messages,
    after Favourite, opens a submenu of Off and the details' lengths (5 min … 30 days, and the
    chat's own where it's another), the current one ticked. It's one setting with the details'
    TimedToggle (N6, "Native details", below): both are a `logic/chats/chatDisappearing`
    `ChatDisappearing`, and it's offered to the same people (`canSetDisappearing`: either side of
    a DM, but not with a bot, a deleted user or someone blocked, `dmDisappearingAllowed`, as Mute
    isn't for a bot; in a group or channel, owners only, `canChangeDisappearing`). Picking the
    setting it already has sends nothing; a pick shows at once (the library's `Optimistic`), and
    goes back with a toast if it's refused ("Couldn't save that"). No toast when it's saved, and no Undo (the plan has neither):
    the timeline's "you set the disappearing message time" item says it. Off and on again go back
    to the length the chat last had, from here or the details (the review of 2026-11-10; below).
    Only a length in the submenu's ids (`disappearing:…`, `isDisappearingItem`) reaches the
    setting; any other id goes through the menu's own cases.
  - **Clear history** (the prototype's menu): the backend has none, so it's dropped from the menu
    (decided 2026-11-07); it comes back after cutover once the backend can (native PLAN, "After
    everything else").
  - **Opening a chat** shows its messages from the device's cache (CachePrimer keeps every chat's
    latest events there) as the screen slides in, as the old UI does; the screen's chunk is
    preloaded with the Chats tab's. The shell pushes a conversation once its first messages are
    in (`messagesIn`, up to 600ms): mounted before them, a longer chat slid in empty and stalled
    midway as its rows rendered (seen on the emulator with 37 messages). What still waits gets a small spinner at the top of the list,
    after 400ms: the chat being selected (a link opening a channel while its community loads), or
    its first messages coming from the backend when the cache has none. Older messages loading as
    the list is scrolled up show none: ChatEventList doesn't say when it's loading them, and it
    loads them well before the top is reached.
  - **Unread messages**: a chat with unread messages opens on the first of them, in the middle of
    the list, as the old app's (`OpenAtUnread`: the client loads them as it selects the chat,
    before the pushed screen's list is there to hear it), under an "Unread messages" divider. The
    divider goes once every message after it has been read: it lingers 3s, then fades and folds
    away (`FirstUnread.seen`), and isn't back that visit. Ours: the old app has no divider, the
    web's stays for the visit, and the design doesn't show one in a conversation.
  - **Going back** keeps the messages showing until the screen is gone (`HeldWhileLeaving`, and
    ChatEventList's `loadedRange`, which the conversation holds with them), as it does when
    another chat replaces it.
  - **Mute** is Mute / Unmute (no durations, as on Chats' rows).
  - **A channel being previewed** (not joined) offers Search in chat, Mute and Favourite, as the
    old app's menu does, but its search finds nothing ("No results": the backend searches for
    members), and it opens at its latest messages with no unread divider (nothing has been read).
    TODO(design): the preview's menu and search, with the join bar (N8b).
  - **A DM whose chat isn't in the list yet** (found testing: a deleted DM the other user had
    written to again, before the next sync brought it back) shows the header's back and avatar with
    no name, and the list's spinner, until the chat arrives.
  - **Toasts** sit above the composer in a conversation (the kit's `footer` placement). Mute,
    favourite and unblock say so at once, as the client shows the change at once (`localUpdates`),
    here and on Chats' rows; a refusal takes the toast's place. Block and unblock wait on the
    backend, so their toast says so with a small loader ("Blocking @ann…"), then how it went
    ("Blocked @ann", with Undo and the close); Undo unblocks in the same toast ("Unblocking
    @ann…", then "Unblocked @ann"). A toast waiting on an operation never times out; its result
    gets a full time of its own (`showPending`, `AsyncUndo`; ours: the design's toast has no
    waiting state). Leave and delete don't wait: nothing is sent
    until their Undo has gone (`PendingRemovals`).
  - **Typing** couldn't be seen end to end here: typing reaches peers over WebRTC, which the browser
    check's environment didn't connect (two client bugs, fixed in web L1: see the web's "Chat list",
    who's typing). The bubble and the strip were checked by setting the names. The DM's bubble is
    now the library's (`TypingIndicator`, `variant="bubble"`, web L1), which the web's DMs show too,
    and the rule is `typingPlacement`, shared with the web.
    Their words are the library's (`ui.typingIndicator.typing`), English only.
  - **Sender names** are the library's (`--ink-3`); the prototype colours each by its swatch with
    hex values no token has.
  - **Spacing**: received messages leave 44px on the end side and sent ones 60px on the start side,
    as the prototype's; the avatar is 28px with an 8px gap (`MessageGroup`'s `avatarSize`,
    `--group-gap`). A marked message (the search's match, the one replied to or edited) is tinted in
    a rounded box 6px outside the row, the search's in the accent.
  - **The swipe's hint**: the prototype's two bounces (`oc-swipe-arm`) aren't in the export, so
    ours are (`MessageGroup`, EXPORT-LOG 2026-11-07). When iOS's edge swipe back is built (N3),
    it will have to win over a reply swipe that starts at the screen's edge.
  - **By hand in the library** (EXPORT-LOG 2026-11-07, to take back to the design export):
    `MessageGroup`'s `mirror`, `avatarSize`, `swipeStyle="inset"` and its CSS hooks
    (`--group-gap`, `--group-ring`, `--message-mark*`); `ChatBubble` and `VoiceMessage` put a
    mirrored bubble at the inline end. And (EXPORT-LOG 2026-11-08, N5d) the kit's
    `MessageLongPressMenu` with `messageMenuPlacement` (the prototype's inline message menu, as a
    component), and `MessageGroup`'s `hoverBar`. Both long-press menus (EXPORT-LOG 2026-11-09) keep
    the lifted copy as it is until the veil has faded, so the message or row doesn't blink back in.
    And `global.css` shows no scrollbars under the native root (`[data-platform="native"]`), as
    Android's WebView drew the global 8px one whatever a scroller's `scrollbar-width` said.

  - **Opening a chat doesn't clear its notifications.** The old trees' `CurrentChat` calls the
    shell's `releaseNotifications` for the chat (and thread) when it opens, so its delivered
    notifications go from the tray. The native conversation screen doesn't yet, so they stay
    until tapped or swiped. Reading the chat elsewhere still clears them when the app comes back
    (#10398 follow-up, "clear notifications for chats read elsewhere").
- **Native composer** (native N5c, #10370; the native plan's 05 composer, 06 attach panel and 07
  emoji and GIF panel, as of 2026-11-09 (b); `src/native/features/conversation`:
  `ConversationComposer`, `keyboardSlot`, `KeyboardPanel` and `PanelHandle` with `panelState` /
  `panelDrag`, `EmojiPanel`, `AttachPanel`). Built: the library's `MessageComposer` as the
  design's pill, + · text · emoji on iOS and emoji · text · + on Android, mic ↔ send; the chat's
  draft, the reply or edit strip a swipe sets, a file or up to ten photos and videos attached,
  @mentions, a voice message, the throttle and a video's progress over it, the old footer's words
  in its place where the reader can't send; the slot under it that the keyboard and the panels
  share, and the panels as 06's sheet (rest at the keyboard's height over a spacer, 90% of the
  screen grown, the `--scrim` backdrop, the handle's and the content's drags, the emoji search's
  strip, the GIF search). On the web composer's operations, moved to the shared layer for it
  (`logic/composer`: `chatEntryState`, `entryBlockBanner`, `entryNoticeText`, `mentionsFor`,
  `sendVoiceRecording`, `composerProps`; `logic/conversation/draftActions`), which the web's
  conversation uses too; the panels' own in `logic/composer` (`mediaPicks`, `recentEmoji`) and
  the client (`prepareAttachment`). Left, or decided where the plan is silent:
  - **The keyboard**: in the Android app the conversation keeps the viewport resize off and the
    slot takes the keyboard's height from the window insets, so the composer sits right on the
    keyboard, and a panel rests at the keyboard's last height. Android reports a keyboard coming
    up at one height and then, ~200ms on, at its own (370px, then 336px), sometimes over a second
    late, and a "down" from the last move can arrive after a quick switch back: the slot takes a
    height once it has stayed 250ms, holds the keyboard's height for up to 2s while it's on its
    way and ignores a "down" meanwhile (`keyboardReport`), and when the keyboard asked for by the
    keyboard glyph doesn't come (Android drops a focus's keyboard while the last is still going
    down) the field is focused afresh once. Measured per frame on the emulator, toggling the emoji
    and keyboard glyphs every 80, 150 or 300ms leaves the composer's top at 526px throughout. In
    the iOS app the native tree doesn't follow the keyboard's reports (only Android's are followed,
    `systemBars.ts`), so the WebView shrinks above the keyboard, and a panel rests at the keyboard's
    height only where one was seen on the device, else at 304px over the safe area: switching may
    jump. Following iOS's reports waits for a device to check on. The emoji and attach panels rest
    at the same height (the user's decision): the keyboard's where it's known, else 304px in the
    apps and 264px on phones' browsers (06's mobile web attach panel, the emoji panel too).
  - **Photos and videos picked** go straight into the composer (06 "live in the composer"), held
    by the composer (`mediaPicks`), not the chat's draft: they're lost when the chat is left (the
    draft keeps a file, or a photo pasted). Each is prepared as it's picked (a video's transcode
    takes a while); a send waits for them. Over the thumbnails the composer's media header says
    "N of 10" and Clear empties the attachment (every tile with it; `mediaLabel`, `onClearMedia`,
    05). The attach panel has only the standard handle (06 (e)). The composer's placeholder is
    "Add a caption…" and Send shows how many go (`MessageComposer`'s `attachedPlaceholder` and `sendCount`, by hand,
    EXPORT-LOG 2026-11-09). **Backend dependency**: a message holds one attachment, so the first
    goes with the caption and the others follow it, a message each, in the order picked (refused,
    those not sent are picked again), until the backend takes several in one message (the user's
    decision).
  - **The gallery strip and Recents** list the phone's last 100 photos and videos through the
    apps' plugin (`loadRecentMedia`; `utils/native/recentMedia`, shared with the old native UI's
    strip), All photos next to Camera (06 (d)). It asks for the photos permission as the panel
    first opens (Android); with it refused, or nothing listed, the strip has Camera and All photos
    only, and All photos opens the system's picker in place of Recents. The plugin doesn't list a video's length: it's read from the file
    where it has a path (Android); on iOS a video shows the play glyph without a time.
  - **The attach actions** are those the chat permits (no Poll or Prize in a DM, no payments in an
    app-store build), in 06's `--action-*` colours, a value per mode.
  - **The builders** (Poll, Prize, Send crypto, Swap, Meme fighter) are N9's: each pushes a
    placeholder (a local `builder` screen), over the chat with the attach panel left open under it
    as it was (the user's decision; the plan is being updated to say so); Android's back pops the
    builder first. The system's pickers (Camera, File, All photos with
    nothing listed) close it. A payment in the draft (one staged on another device) has no chip,
    and isn't sent with the text (`sendComposed` refuses it).
  - **The emoji panel's sections**: Recent first (07's eight to start, each pick to the front,
    sixteen kept, per user on the device, `recentEmoji`), then every emoji the phone draws by the
    emoji database's categories (Smileys & emotion … Flags; from a CDN the first time), not 07's
    curated seven; in the skin tone the old pickers set (no skin tone picker: 07 says ask first);
    no custom emoji. The category bar shows each section's emoji, greyed until it's the one showing
    (🕘 for Recent): the user's decision. Backspace deletes a character per tap (no repeat while
    held).
  - **GIFs** are Klipy's, as in the old UIs (`logic/composer/gifs`): trending, or searched; a tap
    sends one and closes the panel, a reply if the draft has one. A search with no match says "No
    GIFs for …" with Klipy's related search terms (`search_suggestions`) as chips to search for,
    or, with none (or none to be had), the trending GIFs under it (the user's decision;
    `gifsNotFound`, `GifFeed`). A build without a Klipy key has no GIF tab.
  - **A send** doesn't put the keyboard up while a panel shows (`MessageComposer`, EXPORT-LOG
    2026-11-08): the emoji panel stays to pick more.
  - **The edit composer**: "Editing message" in the accent (native only).
  - **Voice**: the line under a take is the web's, Esc included.
  - **Mentions** use the library's list over the composer. Enter follows the app's enter-sends
    setting (off on touch devices).
  - **Toasts** sit above the composer however tall it is (`--toasts-footer`); while the attach
    panel shows (at rest and in Recents), at its bottom, over it (the user's decision; 06 is
    silent; `onToastFloor`).
  - **A tap on the messages** leaves the keyboard and a resting panel as they are (the backdrop
    takes taps only from f 0.02, 06); grown or searching, it's the backdrop's, which collapses the
    sheet to rest.
  - **The keyboard on other screens** (§5 Open): Pick a username, Edit profile and Delete account
    keep their pinned button down (`aboveKeyboard`); the search screens and Link to your account
    let the WebView shrink above the keyboard. The builders' keyboard-up states are N9's.
  - **The light conversation** (04 (c), 00 (b)): the screen's root carries `data-chat-surface`,
    and `tokens.css` scopes the light colours to it: the off-white chat (`--chat-bg` #F8F7F4), a
    white pill, white received bubbles without their ring and with a soft shadow (every kind,
    photos and videos included), and sent bubbles in a solid accent per `[data-accent]` with white
    text, no shadow and the dark theme's content tokens inside (`[data-bubble-sent]`; orange's text
    with a shadow, an accepted contrast exception). Links in sent bubbles: white (the bubble's
    text colour) and underlined, as in every theme (2026-11-19, the user's rule), not 04's table's
    pale tints (#FFD0D9 / #FFD9BF / #D4E5FF / #C8F5E3, its "Links inside" column), for
    consistency; to go back to the tints for native light only, set `--msg-link:
    var(--accent-bright)` on `[data-bubble-sent]` in that scope of `tokens.css` (the tints are
    still its `--accent-bright` there). The list's end padding grows from 10 to 30px while a
    group's typing strip shows; the composer sits 4px under the list (05 (b)). The sheets' top line
    is `--sheet-edge` (`--line-2` in light). Not done: 04's recommendation to bring the received ring back when the
    OS's "Increase contrast" is on. Still open (06): the panels' rest height stays 304px over the
    safe area (or the keyboard's), which 06 says may go back to 282px.
  - **Decided by the user** (2026-11-09, where the plan was silent): the emoji sections are the
    real categories, not 07's curated seven, with their emoji as the category bar's icons; Recents'
    chevron is "Collapse"; GIF searches with no match as above. Kept as built (06 places All
    photos next to Camera but doesn't say more): without photos access or photos, All photos opens
    the system's picker.
  - **Not checked**: the group typing strip in a browser (the local replica's typing goes over
    WebRTC, which the headless browser couldn't set up); the iOS app (no device).
  - **The rules** (found testing N6): sending in a chat whose rules the reader hasn't accepted
    waited for an answer nothing in the native tree gave, so Send stayed disabled. The
    conversation now shows them in a bottom sheet (`RulesSheet`) with Cancel and Accept, on the
    web's decisions, moved to `logic/composer/sendPrompts` (the client asks through
    `captureRulesAcceptanceStore`; another chat declines it); the keyboard goes down as it opens.
    Accept sends the message; Cancel keeps the draft, without the "Couldn't send" line, Send back
    (`ComposedSend`'s `declined` and `composerAnswer`, and `MessageComposer`'s `onSend` resolving
    `false`, by hand, EXPORT-LOG 2026-11-10; the web's composer too). TODO(design): the design
    has no rules sheet; ours, with the old words ("Chat rules", Accept). The PIN a transfer asks
    for still has no native sheet (N10b).

- **Native details** (native N6, #10372; the native plan's 10 of 2026-11-08, and the Invite
  people and Members parts of its 2026-11-10 changelog; `src/native/features/details`). Built: a
  DM's details and a group's or channel's, pushed from the conversation's title and its menu's
  details item (the local `chat_details` screen), the Members screen (`chat_members`) with its
  tabs, Invite people (`invite_people`) and a member's profile sheet. On the web panel's logic
  (`logic/members`' MemberManagement, `logic/groupOrCommunity/detailsPermissions`,
  `logic/profile`'s ProfileCardData), the web's DM settings, moved to `logic/chats/dmSettings`,
  and new shared logic: the members' role sections and ⋯ (`@client`'s `memberSections` and
  `memberMenu`) and the disappearing lengths (`logic/chats/disappearingMessages`, on the library's
  `lib/durations`, the web picker's); a group's disappearing messages
  (`logic/chats/groupDisappearing`, on the client's updateGroup) and who may change them
  (`canChangeDisappearing`, on `chatManageAccess`); when a group was created (the client's
  `groupCreated`). The user's answers of 2026-11-10 to the open questions are in below. Left, or
  decided where the plan is silent (the prototype export wasn't available to check against):
  - **DM**: the cover's kebab holds Delete chat (with Undo, as the conversation's menu), the one
    thing the conversation's menu has that the screen doesn't already (the plan names the kebab,
    not what's in it); without it (the OpenChat bot's DM) there's no kebab. Call starts a voice
    call, or joins the one going on (N14); Call isn't there where calls can't start, nor Mute for a
    bot (a bot DM can't be muted). A bot's only tile, Search, would be a full-width row of one, so
    there's no row and Search is a round button on the cover before Favourite (the user's call,
    2026-11-10; `searchOnCover`). About shows once their profile is in (none for a bot): the bio,
    Member since, CHIT earned (not with CHIT off).
  - **Read receipts** (the plan's This chat): not a setting the app has, so not there (the web's
    panel hides it too).
  - **Disappearing messages** (a DM's, though not with a bot, a deleted user or someone blocked,
    where This chat isn't shown; and a group's for its owners): the library's `TimedToggle`,
    as the web's (the plan's 10 of 2026-11-10; `DisappearingRow`): the switch, and "After 1 day ⌄"
    in `--accent-bright` while on, "Off" while off; switching on opens the 8 lengths (5 min,
    15 min, 1 hour, 8 hours, 12 hours, 1 day, 1 week, 30 days; 4 × 2), picking one closes them,
    tapping the row opens them again. It starts at a day; switched off it goes back to the length
    the chat's TTL last had this session, whether set here, from the menu or another device
    (`logic/chats/chatDisappearing`'s `ChatDisappearing`, on the client's
    `disappearingLengthsStore`, so it outlives the screen and is the menu's too; since the review
    of 2026-11-10, before which it lasted only while the row was mounted). It's read from the TTL,
    not from a save as it finishes, so one finishing after a newer one can't change it. The app
    restarting forgets it (back to a day): the backend keeps no length while they're off. A
    chat's own length set from another app shows among them, picked. Shown at once (the
    library's `Optimistic`), back as it was with a toast if it's refused. One setting with the
    conversation menu's submenu ("Native conversation", above). The lengths and "After …" are the
    app's words, translated (TimedToggle's `valueLabel`, and `subtitle`, ours, EXPORT-LOG
    2026-11-10: "After 30 days" is a phrase per unit, `disappearAfterLabel`, since the preposition
    sets the length's case: "Nach 30 Tagen", "Po 1 dniu", "Через 1 неделю"; the library's are
    English only); minutes read "5 min", and German, French and Polish hours "12 Std." / "12 h" /
    "12 godz.", so the widest fits a 360px phone's chip (50px for the text with the grid's indent
    under the label: "12 hours" is 44px, "12 Stunden" was 61px). No help line under it any more
    (the plan's row has only its subtitle). The old row's switch with help and its "Disappear
    after" value row (the anchored menu) are gone, and the brief for the length's picker is this
    one. The web's DM panel starts at a day too (`DISAPPEARING_START`, the one default, since the
    review of 2026-11-10; it was the old panels' week); the web's group settings dialog still
    starts at 12 hours (`features/group/settings.adapter`).
    TODO(design): the TimedToggle is the library's as it is ("same as web"), so its label
    (12.5px semibold) is smaller than the native settings rows' (15px medium), as in a group's
    This chat card, over Mute @everyone; the plan doesn't say to change it.
  - **Group**: under the name, "Private · N members" has a lock before it for a private group or
    channel (the user, 2026-11-10). The cover has back, favourite and Edit (the user, 2026-11-10: a kebab with one
    item is just a button): a pencil for those whose role meets "Update group", pushing
    Edit group (N7's `group_settings` page, `edit`). Copying or sharing the link is Invite people's
    (the Invite tile), so the cover has no Copy invite link, and nothing else on the screen is
    repeated in a menu. No Export chat. A channel's cover is its community's
    banner; a group has none, so it's the accent's gradient, as the You tab's. The avatar is the
    photo where there is one, else the chat's swatch (the conversation header's).
  - **About**: "Created" is the day it was made ("Nov 10, 2026"): a group's summary and details
    have no date (the canister keeps `date_created`, but only its metrics show it), so the client
    reads the chat's first event, `group_chat_created`, and its timestamp (`groupCreated`, one
    request the worker caches), with "Created by @ann", who made it (the event's, their name
    loaded if they've left). Nothing shows until it's read, nor where it can't be (the history
    before the reader joined is hidden): not the owner in their place, as it was before the review
    of 2026-11-10, since ownership can move and there can be several owners. History says whether
    new members see the messages from before.
  - **Members row**: up to five faces and "View all · 48" (notes §1: "View all" is the only label
    for a full list), to the Members screen.
  - **This chat** (a group's; the plan names the card, not its rows): the disappearing messages
    first, then mute @everyone (a switch, the web panel's), in the design's order. The owners
    switch the disappearing messages on and off and pick how long, as a DM's (the TimedToggle,
    above); everyone else sees them read only (Off, or how long), as a fact row: the plan doesn't
    draw a read-only TimedToggle, so its `readOnly` status pill isn't used. Owners only,
    as the current apps and the web's settings have it (`chatManageAccess` marks them read-only
    for the rest), though the backend lets anyone whose role meets "Update group" change them.
    Not shown to someone previewing.
  - **Rules** show read only to everyone who can send (the web panel's `chatRulesText`, with the
    community's for a channel); owners and admins edit them from Manage (N7).
  - **Manage** (owners and admins, not in a frozen chat): Access gates, Rules, Permissions, Bots
    and webhooks, Stats (Access gates with a lock, ours: the gate icon is the same shield as
    Permissions'), each pushing N7's page (a local `group_settings` screen: "Native group
    settings", below; Bots and webhooks and Stats are still placeholders). The tiles' **Invite** is every member's (not in a frozen chat, nor for
    someone previewing): it pushes Invite people (below) where it has something to offer, and
    otherwise says who can ("Only admins can invite to this group", naming the lowest role "Invite
    users" allows; `logic/members/invitePeople`'s `chatInviteAccess`, `inviteRole`).
  - **Leave** goes to the list with Undo, as the conversation's menu (the plan's "Undo toast for
    leave"). **Delete** too (the user's answer, 2026-11-10, rather than a confirm): to the list
    with "Deleted N6 Book Club" and Undo; the delete is sent once the toast has gone (the shell's
    PendingRemovals), so Undo sends nothing.
  - **Search** goes back to the conversation and opens its search (`searchRequests`). Found
    testing N6: opening the search (from here or the header's menu) took the app down to "Couldn't
    load messages" since N5c, the composer's resize observer running again on the composer gone;
    fixed.
  - **Members screen** (with the plan's 2026-11-10 changelog): owners, admins and moderators get
    the compact tabs, Members | Lapsed | Blocked where the group (or a channel's community) has
    access gates, Members | Blocked where it hasn't; regular members get no tabs, the members only
    (`@client`'s `memberTabs`, `hasAccessGates`: a lone unique-person gate is none, as it's
    suspended). Lapsed shows a count while anyone has lapsed. It always opens on Members; switching tabs clears the search (the
    library's `Field`, with its clear ×, as Invite people's), whose
    placeholder follows the tab. A tab that goes while it's open (the gates taken away, a role
    lost) goes back to Members, the search cleared, and stays there if the tab comes back
    (`members.adapter`'s `keptTab`; the review of 2026-11-10). Members: the search (as before: a large group holds only its first
    page of members, so the others are looked for as you type, `findMembers`), the Invite people
    row (not on the other tabs, and only for someone it would open for: the plan doesn't say who),
    then the plan's role sections (Owners, Admins, Moderators, Members, empty ones left out; you
    first, then by name), each a picker row (photo or swatch, name, You, @username); a section's
    label shows its count only past one ("Owners", "Admins · 2"). Lapsed and Blocked have the
    plan's note over their rows and its empty line. A lapsed member's ⋯ offers Remove from group
    (the plan; the old mobile page also offered Block there), a blocked user's Unblock, both with
    "Remove / block members" (`listedUserMenu`), else a toast says your role can't. Lapsed members
    keep the access they have today (nothing about it changed). The plan's second Blocked item,
    "Remove (removes them from the blocked list, as on web)", isn't there: the backend's only way
    off the blocked list is unblocking, and the web's panel doesn't offer a Remove either
    (GroupPanelView passes no `onRemoveBlocked`), so it would be Unblock twice. A private group's
    Blocked tab is always empty (blocking is a public group's), but shows as the plan has it.
  - **The ⋯** shows only on members below you (the plan): its role items up to your own role
    (several owners allowed) where your role may change roles, then Remove and Block where it may
    remove / block members (the plan names Remove; Block is the web panel's, under the same
    permission, and stays next to Remove: the user's answer, 2026-11-10), Block only in a public
    group: the backend refuses a block in a private one (`ChatNotPublic`), so the client's
    `canBlockUsers` and the web's panel offer it in a public group only, and a private group's
    owner rightly has none (a channel's blocking is its community's, from the profile sheet;
    `members.spec`'s "Block in a group's ⋯"); with neither, a toast says your role can't. Note the client lets anyone whose role
    meets "Change member roles" give any role but owner, so the cap at your own role is the plan's
    and the native screen's (`memberMenu`); the web panel offers what the client allows.
  - **Removing** and **blocking** wait out their Undo before they're sent (the shell's
    PendingRemovals, as leaving), the member gone from the list meanwhile; Undo sends nothing and
    they're as they were. Found testing N6: a block was sent at once and its Undo unblocked, but a
    block in a group takes them out of it and unblocking only lifts the ban (the backend has no
    add for a group: they join again themselves), so they were gone. Unblocking from the Blocked
    tab can't bring them back, and its toast says so ("Unblocked Ann. They can join again"); it
    waits out its Undo too (the plan's "Unblock (Undo)"), as does removing a lapsed member. A role
    change says so in a toast ("Ann is now an admin"); a refusal says why. The profile sheet's
    Unblock is the ⋯'s: it waits out its Undo, them gone from Blocked meanwhile (the review of
    2026-11-10; it was sent at once).
  - **Invite people** (the plan's 2026-11-10 changelog; `InvitePeopleScreen`, the local
    `invite_people` screen), pushed from the Invite tile and the Members tab's row: "Invite
    people" over the chat's name, then People | Invite link, each only for someone it's for
    (`chatInviteAccess`, on the details' permissions: People with "Invite users", or "Add members"
    in a private community's channel; Invite link in a public chat, or with "Invite users" in a
    private one); one alone shows without the tab bar (a public group's plain member gets the
    link only: the plan doesn't say what they get). On MemberManagement, as the web's InviteDialog
    (`initialiseSharing`, `sharingLink`, `toggleInviteLink`, `cancelInvite`, the picks, and its new
    `sendPicked`), and the invite pages' search (`searchToInvite`).
    People: the search (the library's `Field`, with its clear ×, which keeps the keyboard up), the
    picks as the library's `UserChip`s (their photo, first name, ×; "No one selected yet" after a
    people icon), a divider (18px over it and 22px under it, the user's call of 2026-11-10: 12px
    over it and the plan's 14px under it read cramped), then with nothing searched Pending · N (Cancel, where you may
    uninvite, waits out its Undo) and Suggested (the people you have DMs with who'd join, the latest
    DM first, up to 30 (`invitePeopleLists`), as the old invite pages offered: not those in the
    chat, lapsed members included, nor the invited; for a channel, its community's members, and
    others only where you may invite to the community). A large group or channel (or a channel's
    community) holds only its first page of members, so the DM partners are looked up among them
    first (the client's `lookupDirectChatUsersAmongMembers`, a group's too since the review of
    2026-11-10), Suggested waiting meanwhile (a spinner by its label), so a member it doesn't hold
    isn't offered to invite. With no one pending and
    every DM partner already in the chat or invited, nothing shows under the divider (found testing
    on an account whose DM partners are all in its groups; the plan draws no empty line there);
    with a search, Results: those found,
    then the invited and the members held who match, dimmed (.45) and marked Invited / Member (the
    search leaves members out, so a large group's member it doesn't hold isn't listed). How each
    would join is `inviteWay`: a private community's members are added to its channel where you
    may add them (the web's Add tab; the plan has one People list), everyone else invited. The
    pinned button (with the send glyph): "Send invites" (disabled) / "Send invite" / "Send 3
    invites", or "Add 2 people" when everyone picked is added; it waits for the backend (disabled
    meanwhile), then stays on the screen (the user, 2026-11-10) with "Invite sent to Sofia" / "3
    invites sent" / "Added Sofia", the search cleared and the picks sent. Each pick goes as it
    would join at that moment (`MemberManagement.sendPicked`): one who's joined or been invited
    since being picked isn't sent (the backend would refuse the whole invite) and leaves the
    picks; with no one left at all, nothing is sent and a toast says so ("No one left to invite:
    they've joined or been invited already"). The adds and the invites go separately: those sent leave the picks and the rest stay
    picked (a partial add's not added among them), the toast saying who went and then why the
    rest didn't ("Added Sofia · There was an error inviting users"); with none sent, the failure
    says why. A search that fails finds nobody ("No one matches"), not a spinner for good
    (`searchToInvite`). With nothing pending and no one to suggest, a hint to search ("Search for
    people to invite", ours: the plan has none). The invited show in Pending at once: the client's invite
    puts them among the chat's invited users before the backend answers (and takes them out if it
    refuses), which the screen's Pending follows (`inviteUsers.spec`, MemberManagement's spec).
    The search fields of the native screens (Invite people, Members, New chat, the chat list's, the
    conversation's, the forward sheet's, the emoji panel's) read as searches, not sign-in fields
    (the library's `SEARCH_INPUT_ATTRIBUTES`: a search type and input mode, autocomplete off and
    the password managers' own opt-outs), as Android's autofill offered a password manager's menu
    on Invite people's ("Search name or @username"). If one still shows on a device, the remaining
    switch is the Android app's: the WebView's `importantForAutofill` (MainActivity), which would
    turn autofill off for every field, sign-in ones included; not done.
    Invite link: the plan's card with its switch ("Share via link", read only for a public chat's
    link, which is always on, and for someone who can't manage it), the QR code (184px on a white
    tile, `core/QRCode`), the link in mono, Copy link and Share (`utils/share`'s `shareLink`: the
    apps' share sheet), then Reset link (danger) with the plan's line under it in its own card (the
    library's `SettingsAction` with `help`; it was the card's note, the user's call of 2026-11-10),
    and the footnote that access gates are skipped, for a private chat's link only: its invite
    code skips them, while a public chat's link is a plain one whose joiners still pass them. A
    link that couldn't load says so in the card, with Try again (no spinner for good), and the
    link loads when the tab comes if it wasn't there as the screen opened (`invite.adapter`'s
    `linkTabView`, `MemberManagement.inviteLinkLoad`; the review of 2026-11-10). Reset's Undo: a reset link can't be brought back, so the reset waits out its toast
    (the shell's PendingRemovals, as a removal), the link dimmed and Copy and Share off meanwhile;
    then a spinner in the card until the new link and QR are in (the plan has the new link at
    once, with Undo). Switching the link is shown at once and goes back with a toast if refused.
    Not built: a community's Invite people (the screen takes a group or channel; the community's
    menu and Manage push a placeholder, `community_settings`, and `inviteAccess` takes any).
  - **Profile sheet** (tapping a member, the plan's "profile sheet", not drawn): a bottom sheet with
    their avatar, name and @username, About (bio, member since, CHIT earned) as their profile
    loads, and the web's user card's actions (the user's answer, 2026-11-10): Message (not on your
    own), which opens your DM with them, and Block or Unblock where the card offers it here
    (`ProfileCardBlock`: in a group for a role that may block, in a channel its community's),
    blocking with the ⋯'s Undo. Not the card's suspend / unsuspend for platform moderators (no
    native screen for it), nor a mention (the card has none).
  - **Not built**: a link to the members (`?everyone`, the @everyone mention's; `?usergroup=`)
    still opens the conversation only; the native router could push the Members screen for it.
    Pinned messages (the web's panel lists them) aren't in the plan: a design brief will follow as
    its own PR (the user, 2026-11-10). A community's details are N8a's (its settings pages
    N7's); a channel's details are the group's, with its community's banner and rules. The plan's
    thread list and thread screen (10 "Threads") are N8a's ("Native Communities tab").
  - **Checked** on the Android emulator (2026-11-10, dark): a bot's DM, Book Club as an admin,
    Readers Circle as a member, Owner Test as the owner (disappearing on, a day, off; Delete and
    Undo), the Members screen's labels, a block from the ⋯ and from the sheet with Undo, the
    sheet, the kebab's Copy and Edit, search from both places, and the rules sheet's Cancel and
    Accept. Not checked: unblocking from the Blocked section (nobody blocked to try it on), iOS,
    the light theme.
- **Native wallet** (native N10a, #10377; the native plan's 13; `src/native/features/wallet`).
  Built: the Wallet tab's root (the total, a tap cycling the display currency the web wallet keeps
  on this device, the eye, the "today" pill, Send / Receive / Swap, the tokens largest first with
  their price pill, amount, value and share bar, Small balances folding open, Supported tokens and
  its sheet with search; the empty wallet with Receive leading, Send and Swap disabled saying "Add
  funds first", the welcome card with Copy @username, the first five supported tokens and View
  all · N) and a token's page (`/wallet/:ledger`: the price pill in the header, the kebab with its
  flows and Copy ledger ID, the amount with the eye, the value, its share of the wallet, the
  buttons, the filter tabs and its history by day, Load older, a failed history's Try again). The
  figures are the web wallet's: WalletPanel's and WalletMain's logic moved to the library's
  `lib/wallet` (the holdings, the display currency, prices, the token page's buttons and menu, the
  activity's days and signs), the web's wallet adapter's tokens and activity to
  `logic/wallet/walletTokens`, with `walletCatalogue`, the session's histories and the balances'
  first refresh (`BalanceRefresh`) beside it. Left, or open:
  - **Send, Receive and Swap** (and the kebab's) go to their flows' URLs (`/wallet/send`,
    `?token=` from a token's page), which show N3's placeholder until N10b builds them.
  - **Swap** is offered (a token page's button and its kebab) only for a token a supported exchange
    lists (`tokenActions`, every tree's rule: `swappableTokensStore`, the DEXes' pools). Locally
    no exchange answers, so no token has Swap: its button is disabled and the kebab leaves it out
    (the kebab lists exactly the flows whose buttons are enabled; specced).
  - **No divider above Supported tokens** (the user's decision, 2026-11-24, against the notes'
    "one divider between them" and the prototype's line), under the tokens or under Small
    balances, and no extra space above it either: it follows as one more row, at the rows' own
    spacing.
  - TODO(design): **All activity and wallet settings**, the root header's two icons (notes §3.9):
    neither the notes nor the plan's 13 say what they open on native, and neither screen is in
    N10a or N10b, so they're not shown yet.
  - **"Today"** (notes §4) is taken from snapshots of the total kept on this device
    (`logic/wallet/totalSnapshots`): one an hour at most, taken only while the Wallet tab shows with
    its balances and prices in (nothing outside the wallet keeps the balances fresh), kept two days,
    per user. The pill shows the change against the newest snapshot 24 to 25 hours old, so it shows
    only for someone who had the wallet open about this time yesterday. Open question: whether a
    snapshot should be taken in the background (it would need the balances refreshed outside the
    wallet), and how far from 24 hours a snapshot may be.
  - **No per-token daily change** (notes §4): none tracked.
  - The **Send / Receive buttons are the library's `lg`** (52px, as the prototype's), not the notes'
    56px; on a token page at zero "Receive CHAT" can truncate at 390px wide (the prototype's grid).
  - A token's **history rows** don't open anything (the web's open the explorer).
  - **Hidden tokens** (the web panel's Hide) aren't offered here: no row menu in the design.
  - Checked in the browser (390×844, dark): a fresh account's empty wallet, Add funds first, the
    Supported tokens sheet and its search, a token's page at zero (its menu: Receive and Copy
    ledger ID), the currency tap and the eye; with balances set in the client's store (local
    ledgers hold nothing), the funded root and a held token's page; and an app store build (no
    tab, `/wallet` and a token's URL open Chats). Not checked: a loaded history (the local index
    canisters failed), small balances (the local wallet's minimum is 0), "today" (needs a day),
    iOS, the light theme.
- **Native group settings** (native N7, #10373; the native plan's 11 of 2026-11-10;
  `src/native/features/groupSettings`). Built: Create group (below), and a group's or channel's
  settings pages, pushed from
  its details without a URL (the local `group_settings` screen): Edit group (the cover's pencil)
  and Manage's Access gates, Rules and Permissions, each its own draft (the shared
  `UpdateGroupState`, made from the chat and its rules as the page opens) with a pinned Save (as
  Edit profile's: "No changes" until something has changed), which sends what changed (the
  client's `updateGroup`) and goes back to the details with "Changes saved". The values the gates
  page reads and writes are the web's AccessGates' (moved to `logic/access/gateValues`, which the
  web's gates adapter now uses too); the shared state gained `replaceGate` and `setOperator`.
  Left, or decided where the plan is silent (the prototype export wasn't available to check
  against):
  - **Edit group**: the photo (picked, cropped square in start's crop sheet, sent with the save),
    the name (3 to 40 characters, the old editors'), the description (growing, its length), and
    the plan's Settings card: Public, Message history and Disappearing messages (the library's
    TimedToggle, the details' 8 lengths; a draft until Save, unlike This chat's, which saves at
    once). Who sees the history is a fact here, as on the web (it's set when the group is made:
    the client has no change for it). Public and Disappearing messages are the owner's
    (`chatManageAccess`), facts for an admin. The plan draws Create group's Details, not Edit
    group: Edit group is the same page without the links to gates, rules and permissions (Manage
    has them). TODO(design).
  - **Asking first**: renaming a verified group or changing who can see it asks "Are you sure?"
    with the old pages' words (a `NativeAlert`); No keeps the other edits, as the web's. Back
    (the header's or Android's) with unsaved changes asks "Discard changes?" (Keep editing /
    Discard), as the web's Manage does; the plan doesn't say. TODO(design).
  - **Access gates** (to the design's page and screens, 2026-11-25): the intro, the Gates
    card, each gate with its icon (in the accent while it's on) and what it is under its name:
    Diamond and Lifetime Diamond as switches (a locked or credential gate only where the group
    already has one, to see it and take it off); Payment, Minimum token balance, Neuron holder
    and Minimum CHIT as rows with On / Off and a chevron, showing a summary of their entries
    while on (the first two, joined as the gates combine, "3 ICP or 20 CHAT" under Any one gate,
    then "+N"). Then Gate settings, always there and dimmed (0.45) until they apply: Members must
    meet (All gates / Any one gate, from two gates) and Re-check members (Never / Weekly /
    Monthly / Quarterly, from one gate; an interval set elsewhere, say 14 days, shows as "Every
    14 days" and stays picked), each a row with an icon, a help line that follows the state, the
    value and a menu from the row.
    - Payment, Minimum token balance and Neuron holder push their own screens (`gate_entries`,
      local, on the page's draft held by `gatesEditor`): the list (what the gate is, its tokens
      or nervous systems with their values, tap to change, × to take one out with Undo, Add a
      token / Add a nervous system (Diamond's), Remove gate with Undo while it has any; empty:
      "No tokens yet. Add one to turn this gate on."), then Choose a token (a search; those
      already in the gate left out), then the value (the picked one with Change, back to the
      search; a payment's price or a balance's minimum with its dollar worth where the token
      has a price; a neuron's minimum stake, optional, and its dissolve delay as the design's
      chips, Any / 1 month / 6 months / 1 year, plus a delay set elsewhere), with Add token /
      Save pinned, which lands back on the list ("ICP added"). Changes go into the page's draft
      at once; the page's Save sends them.
    - Minimum CHIT keeps a sheet (one value): what it is, the minimum, Save, Remove gate.
    - Ours, where the design is silent: the intro keeps the app's words (who can join, and that
      people you invite don't have to meet the gates), not the design's; the design's "add more
      than one to accept any of them" is left out of the help (see Not offered); a locked or
      credential gate's help; a gate's entries screens opened with the page gone (a cold start)
      show only their header.
  - **Not offered**: the unique-person gate (the plan lists it, but DecideAI is suspended: the
    web and the old pages hide it too, and one already there is kept, unseen). The plan says
    several entries of a kind are allowed and "any one satisfies that gate"; the backend has one
    list of gates and one All / Any for them all, so two payment gates under All both have to be
    paid. Open question for the user.
  - **Diamond**: adding gates is Diamond's, as on the web and the old pages; without it and with
    no gates, the page says so and has Get Diamond (the You tab's Diamond); with gates already
    there (Diamond lapsed) they show and can be taken off, but not added.
  - **Rules**: the switch, the design's six templates (the web dialog's, in the app's words: a
    card each, filling the text with its three rules, the matching one marked), the text, growing
    (its length out of 1024, Clear, and why it can't be saved: enabled and empty), and, once the
    text has changed, Ask members to accept them again (the old pages' Prompt existing members).
  - **Permissions**: the Members and Moderation cards (the web dialog's nine permissions, with
    the lowest role on the right in the accent where it isn't the client's default; the kit's
    `SettingsValue` gained `accent`, EXPORT-LOG 2026-11-16), the Messages card (who can send, then
    Customise per message type: the types' rows under the switch, each its own role or Same as
    default, against the defaults: the defaults' swap offers for nobody aren't customising, and
    switching it off puts the types back as the defaults have them, so swap offers never open to
    everyone unseen), the Threads card (Separate thread permissions, the same rows for threads
    under it, marked and counted against the messages'), and Reset to defaults
    (`defaultChatPermissions`, a text link under the cards, as the design has it; 2026-11-25)
    while anything differs. Someone whose role can't change them (not
    the owner) sees the roles only, with no Save. Save counts only what a save would send
    (`hasSavableChanges`): threads given just "members send" send nothing (the client compares
    them with that), so they read as no change.
  - **Found testing**: saving any permission gives threads a set of their own in the client's
    local update (its `mergePermissions` reads "threads unchanged" as "threads like everyone"),
    so the next Permissions page showed Separate thread permissions on. That merge is every
    tree's, and the old trees' behaviour stays, so the native pages read the threads as they were
    saved for the local update's minute (`savedThreads.ts`).
  - **Review (2026-11-20)**: Save also needs a description that fits and a name of the right
    length trimmed (as it's saved; the shared editor checks it untrimmed); the Rules page waits
    for the rules (they come with the details), so its draft is never the default rules; a gate's
    Undo puts back that gate alone (and the operator or re-check its removal lost, unless set
    again since), and its toast's Undo goes when the page does.
  - **Rules after leaving and coming back** (found on the device, 2026-11-20): two rules saves
    within a minute left the first's rules showing for good once the client's local updates were
    undone (the client's `updateRules` local update: each undo put back the rules it had
    replaced). Fixed in the client, for every tree (the user's call, 2026-11-21: a pure bug fix
    the old trees get too): the undo takes off only its own rules (`chat/detailsUpdates.ts`, and
    a community's the same, `community/detailUpdates.ts`), so `selectedChatRulesStore` is right
    for the native and web pages and for the client's rules check before sending.
  - **Second review (2026-11-20)**: what's read back after a save is what the server holds (the
    threads the original's where nothing was sent for them; threadsAsSaved); threads not
    customised per type keep their types in step with the messages' as those change, so no
    hidden thread role is saved (withMessages); rules too long say so (a new string,
    `native.groupSettings.rules.tooLong`, in every language).
  - **Create group** (the plan's 11 "Create group"; the Chats tab's menu and New chat's New
    group, the local `new_group` screen): two steps on one screen, Back going a step back.
    Members: the search (name or @username, `searchUsers`), the picks as wrapping chips in place
    of "No one invited yet", a divider, then Suggested (the people the user has DMs with) or the
    Results as checkbox rows (details' `InviteRow`; no bots, not the user); Next is always there
    (members are optional, as in the old pages). Details: Edit group's page with the switches
    for Public group and Message history and the Disappearing messages TimedToggle (the plan's
    changelog of 2026-11-10: the same 8 lengths, starting at a day, not a dropdown row), then
    Access gates, Rules and Permissions as rows with what's set ("Off", "1 gate", "On",
    "Default", "2 changed"), each pushing Manage's page on the same draft
    (`new_group_settings`, held by `newGroupDraft`) with Done; Create group (the shared
    `UpdateGroupState`'s create, the client's `createGroup` with the people picked invited)
    opens the new group in the screen's place, saying so where the invites didn't go. A public
    group is Diamond's to make, as on the web and the old pages (the switch says so, off).
    Leaving with something entered asks "Discard this group?". TODO(design): the steps' header
    ("New group" over "Add people" / "Details"), Next, Done and the discard question are ours.
    Review (2026-11-20): Android's back on a page pushed over Create group closes that page, and
    one pressed again as it slides off goes to Create group (its back registers only while it's
    its tab's top screen: the shell's new `ScreenContext.onTop`, which turns as the stack does,
    not as a screen unmounts), and is used up while the group is being created; anything set
    (history too, which the client's `groupChanges` leaves out: `newGroupEntered`) counts as
    entered for the discard question; the new group opens under Chats whatever the list shows
    (it isn't a favourite); Create goes by the same checks as Save (`draftSavable`), and the
    Rules row says why when the rules can't be saved (empty, or too long); two Create groups open
    each keep their draft for their pages (`newGroupDraft` holds a stack).
  - **Not built**: Bots and webhooks and Stats (Manage's last two rows, a group's and a
    community's) are still placeholders: the plan has "Bots: list + Add a bot; webhooks: Add
    webhook. Stats: as in the prototype (not specified further yet; ask if unclear)", the
    prototype export wasn't available to check against, and the web has no Stats page either (the
    backend keeps only all-time counters). Open question for the user. A community's settings
    are "Native community settings" (below).
  - **The frame** (header, Back's "Discard changes?", the pinned Save, the save's questions) is
    `SettingsEditorFrame`, shared with a community's pages since N7's community half; the
    question's words come from `changeQuestion`.
  - **Checked** in a 412×915 touch browser on the native tree against the local replica (the
    emulator wasn't running), N6 Book Club as its owner: Edit group's description saved and shown
    in About, a permission changed (in the accent) and reset, a rules template saved and shown in
    the details' Rules, a payment and a CHIT gate added with Any one gate and saved, both taken
    off (Undo's toast) and saved, the visibility question declined, Discard changes; each put back
    as it was. Create group: seedcommunity2 picked, "N7 Throwaway" named, disappearing on (a
    day), a Diamond gate from its Access gates page, created and opened (TTL and gate as set);
    its photo picked, cropped, saved and shown in the details. Not checked: iOS, the dark theme,
    the Android emulator.
- **Native Activity** (native N13, #10381; the native plan's 16 of 2026-11-08;
  `src/native/features/activity`). Built: the title with Mark all read (always in the row, faded
  out and inert while nothing is unread, so nothing moves), All / Mentions / Payments (the
  compact `SegmentedTabs`) with a badge only where something is unread, the rows grouped by day
  (the prototype's mono caps headings) with the accent dot and no tint, and tapping a row marks it
  read and opens its message pushed over the Activity tab, Back returning to the feed. The URL is
  the web's (`?panel=activity` on the message's: the web keeps the feed beside it), which the
  native router reads as the Activity tab's stack. The tab bar's dot was already the shell's
  (unread in the activity summary). On the web feed's logic, moved rather than copied:
  `logic/activity/activityItem` (was `web/features/activity/activity.adapter`),
  `activityChatName` (was `ActivityScreen.chatName`, a copy of the old trees' `getChatName`; the
  old trees' rows still have theirs, web L3's to switch), and `activityFeed.svelte` (the items'
  context, the loading with Retry, marking read); and the library's `lib/activityFeed` (the item,
  the tabs, badges, days, and marks that roll back, which `ActivityPanel` now uses too). A store
  build has nothing to hide here: the feed only shows what happened (tips and crypto received,
  swaps accepted), as the epic keeps. Left, or decided where the plan is silent:
  - **Where it happened** is the old feeds' name (the person for a DM, "Community > channel",
    "> Thread"), where the prototype's sample says "Private chat" for a DM and "Community /
    #channel". To ask.
  - **The time** is the message's clock time under its day heading, as the web feed's, where the
    prototype's sample has relative times ("12 min", "1 h", "1 d"). To ask.
  - **Opening a payment** opens its message, as every row does: the plan's "or payment" names no
    other place, and the wallet (N10a) isn't built. To ask once it is.
  - **Poll votes** show under All only, as on the web (no Polls tab anywhere: the user's decision
    of 2026-11-24, see "Activity feed, first cut"). An accepted swap is a payment.
  - **A mark that fails** (the client undoes it) brings the dot back and says so in a toast
    (`ui.activityPanel.markFailed`); the prototype has no failure. A feed that fails to load
    shows the web's error with Retry; while it loads, the library's activity skeleton.
  - **The empty tabs** say the prototype's lines ("Nothing here yet." …), new `native.activity`
    strings, rather than the web panel's titled empty states.
  - **Read state** is the feed's one read-up-to time (see "Activity" under App), so opening a row
    marks the older ones read too, as on the web.
  - From web L3, in both trees: the person's own picture over their swatch, and a tip's tips on
    its row (see "Activity feed, first cut").
  - **Fixed on the way, in both trees:** Mark all read said "Couldn't update that" though it had
    worked. The feed took a mark as failed when the summary's read-up-to time hadn't reached it
    afterwards, and that time stays the server's until the next sync (`messageActivitySummaryStore`
    only zeroes the unread count for a local mark). The client's `markActivityFeedRead` now
    resolves to whether it stuck, and `markActivityRead` goes by that; the old trees ignore its
    result, and a failure is as silent for them as before (nothing logged).
  - **Leaving or deleting a chat opened from the feed** (its details' Leave and Delete) goes back
    to the feed, the Activity tab's root (`afterChatRemoved` in `router/locations`), rather than
    to the chat list's tab, which had left the Activity tab's stack on the chat that had gone.
  - Checked in a browser (390×844, two fresh accounts, one inviting the other to a group): two
    reactions, a mention and a quote reply in the feed, the badges (All 3, Mentions 1, none on
    Payments), the tabs, opening a row (its message pushed over the tab, the older row read, the
    newer two still unread) and Back to the feed, Mark all read (faded out, the tabs unmoved, the
    tab bar's dot gone, no error), the empty feed, light and dark. Not checked: iOS, Android.
- **Native CHIT** (native N11, #10379; the native plan's 14 of 2026-11-08;
  `src/native/features/chit`). Built: the CHIT screen, pushed from the Chats header's bolt and the
  You tab's CHIT card (a local push, no URL): the hero (the balance, "Lifetime N", the streak's
  pill, the last seven days as bars, the 52px Claim with the confetti inside the screen, and along
  the hero's foot the streak insurance row, "Insured for N days · streak covered" with a pip a
  day or "No insurance · streak at risk" on a warning tint, and today's puzzle row, "Daily puzzle ·
  Bridges" with Play / Continue / Solved), Streak milestones (each with what a claim pays a day
  from it on, the next with a bar and "streak / days"), "Achievements · N of M" (the partners'
  counted, as the Achievements screen counts) over the four latest with their group and View all,
  and the claim history calendar (`ClaimCalendar`'s `layout="card"`, as the prototype's: the month
  over a card of square days, the picked day, today at first, described under the grid, the
  month's totals and Local / UTC at its foot, its own Claim on today); the gear pushes CHIT's
  settings. Streak insurance (as the prototype: "Insured for N days" or "No insurance" over a
  bar a day of cover, Add cover's stepper with a line a day added and its price, the CHAT balance
  and the pinned "Buy N days · X CHAT" with the shield), the Achievements
  screen, and the daily puzzle as its own screen, laid out as the prototype's PuzzleDialog
  `layout="screen"` and the same for every game (the puzzle's number over its game and tier, or
  "How Bridges works" while the demo shows; the time, hints and streak as three chips; the board
  on a card; Reset over "Use a hint · 100 CHIT · 3 left" at the bottom, Start before the game
  starts; a solve made there plays the "Challenge solved" banner just above the bottom buttons,
  a tap skipping it, then the solved view: the 160px trophy tile, "Solved in 3:44" over the
  number, the countdown to the next puzzle, the tiles, Share to chat and Done side by side). Share to chat is a sheet of the chats the
  user can send in; the chat picked opens with the result card staged in its composer (the
  web's `sharedToChatStore`, which the native conversation now takes, asking first in place of a
  staged payment). A result card's Play in a conversation pushes the puzzle (`cardOffersPlayWith`,
  as the web's). On the web's logic, moved rather than copied: `logic/chit/achievements`,
  `logic/chit/streakInsurance` and `logic/chit/externalAchievements` (were the web's CHIT
  adapter's and `externalAchievements`), `logic/dailyPuzzle/puzzleCard` (was the web's puzzle
  adapter); new and shared: `logic/chit/chitScreen` (the milestones, the 7-day strip, the
  insurance row), `latestAchievements`, `insuranceQuote`, `logic/dailyPuzzle/solveReveal` (the
  banner, then the solved view); `ClaimHistory.claim` now says whether a claim was made (the
  confetti). An app store build has no streak insurance: no row, and no screen in its bundle
  (`disableStreakInsuranceFeature`, specced with the flag on). Left, or decided where the plan is
  silent (to ask):
  - **PuzzleDialog's `layout="screen"`** isn't ported: the library's PuzzleDialog plays Bridges
    only, so the native puzzle is a screen around the app's own boards, as the web's dialog is
    (`PuzzleSession`'s flow, laid out to the plan). Its tutorial is the prototype's, on the
    game's demo (stepped by `core/dailyPuzzle/DemoSteps`, as the web's `GameDemo`): the board on
    the play card without the chips, the step's title and text under it, text Back / the step
    dots / Next, and on the last step an inline Resume pill (back to the puzzle, where
    Start with its fee is: the tutorial doesn't charge) or Back to puzzle; the header says "Step 2 of 6" (the demo's own frame count) and has Skip, which leaves
    the inert board and Start until "How to play" shows the demo again
    (`DailyPuzzleGame.skipDemo`). The prototype's step titles are inferred from each frame's
    caption (`demoTitle.N` beside its `demo.N`); only the native tutorial shows them, the web's
    and the old trees' `GameDemo` leave them out. Not there: the prototype's "about 30 seconds"
    (each game's demo has its own length), and finishing a little board yourself (the demo's
    frames are stills, the same for every game).
  - **No Undo** on the puzzle: the shared game (`DailyPuzzleGame`) has none, so Reset has the
    prototype's Undo / Reset row to itself. The buttons are the library's 52px `lg`, not the
    prototype's 48px.
  - **The boards keep their own colours**: the prototype draws Bridges on the dark dotted card;
    the app's boards are light on purpose, the same in every theme (`games/README.md`), and
    shared with the web and the result cards, so they sit on the card as they are.
  - **No "Islands complete" bar**: it's Bridges' own count, and the shared game has no progress
    for every game to show.
  - **The solved tiles** are Hints, Day streak and the CHIT won: the prototype's Time is in the
    title already. No "Remind me each day?": the app has no puzzle reminder (as CHIT's settings).
  - **The 7-day strip** is the last seven days, today last (claimed, insured, missed, open, or
    before the account was made), from the claim history: the plan names it only.
  - **Streak milestones** list the claim schedule's milestones (3, 7, 14, 30, 100, 365) with the
    daily CHIT each pays from then on ("1,000/day"): the prototype shows a one-off reward a
    milestone pays ("+5,000"), which the backend has no such thing as. TODO(design): the value at a
    milestone's end, if a rate isn't it.
  - **The claimed button**: once today's is claimed the prototype's button turns into a plain bar
    (tint, a check, "Claimed · next in …"), so it's drawn as that, not as a disabled Button.
  - **An earned achievement's icon** is its group's (`ACHIEVEMENT_GROUPS`): the app has no icon per
    achievement, the prototype draws one each.
  - **Latest achievements** are the four most recently earned, from the CHIT events the calendar
    loads (newest first); with none, a line saying each one pays CHIT. The Achievements screen
    (View all) lists every achievement by AchievementsDialog's groups (its `ACHIEVEMENT_GROUPS`,
    now exported) in the settings kit's cards: the plan has no layout for it.
  - **The cover's bars**: the prototype has seven and stops there; the backend allows 30, so
    there are seven at least and another row of seven as the cover held and added passes them.
    The prices are the backend's (each day twice the one before), not the prototype's sample
    (1, 2, 4, 12, 28, 60, 124). Days used so far show under the bars (the prototype has none).
    Too little CHAT shows as the balance in the danger colour, Buy disabled.
  - **Buying insurance with a PIN**: the client asks for the PIN through a prompt the native tree
    doesn't show yet (N10b's PIN sheet), so with a PIN set, Buy says so in a small alert and
    points to oc.app; without a PIN it buys (paid in CHAT, the approval's fee on top, the price
    worked out from the cover bought). Not bought locally (no CHAT on the local ledger).
  - **Share to chat** takes no message (the web's picker has one): the card is staged in the
    chat's composer, where a caption can be written.
  - **The puzzle row with every puzzle solved** opens the solved puzzle (its result), where the
    web's card opens the leaderboard: the native design has no leaderboard.
  - **"Daily puzzle" on the You tab's card** (only when opted in): still not there, as the app has
    no opt-in.
  - Checked in the browser (390×844, dark, port 5059): a fresh account's CHIT screen from the
    Chats header, claiming (the balance, ring, strip and calendar follow), the
    calendar, streak insurance (the stepper and ladder; "Not enough CHAT"), the Achievements
    screen; the puzzle planted in the store (the local replica has none): the row, the screen,
    Start, the banner then the solved view, Share to chat into a DM (staged, then sent), and the
    card's Play on the other account opening the puzzle; and an app store build (no insurance
    row, no wallet tab). Not checked: a real solve (no puzzle locally), buying insurance (no
    CHAT), iOS, the light theme.
- **Native Communities tab** (native N8a, #10374; the native plan's 12 of 2026-11-08 and 10
  "Threads"; `src/native/features/communities`, `features/threads`). Built: a member's page at
  the tab's root (CommunityHome: the header with its 42px avatar, name and "Public · N members",
  which push the details, and the kebab: Invite people, Mute all channels, Mark all as read,
  Manage, Leave with Undo), the Threads row, the channels as ChatRows (the Chats tab's long-press
  menu, now shared: `chats/rowActions`) and those the user isn't in ("Not joined · tap to read",
  opened to read with the join bar); the switcher, strip ↔ sheet on one factor (`switcher.ts`:
  the fades, fill, corners, shadow and dim; a flick, a quick drag or where it's let go), the
  sheet's search, rows dragged by the grip to a new order (the client's `updateCommunityIndexes`)
  and Explore / Create; a community's long-press menu in the strip and the sheet; the community's
  details for members (About, Channels, Rules and Access gates, read only) and Manage's rows for
  owners and admins; a message's thread (the replies link under messages, Reply in thread and
  Follow / Unfollow in the long-press menu, the thread screen: the library's ThreadPanel full
  screen around the conversation's own list and composer, as the web's thread panel); the
  followed threads of a community (`?threads`: the library's ThreadList under the native page
  header, `header={false}`, EXPORT-LOG 2026-11-23). Left, or decided where the plan is silent:
  - **Manage's pages**, the cover's Edit and the kebab's Invite people push `community_settings`,
    N7's community pages ("Native community settings", below); the sheet's Create pushes
    `new_community` (N8b PR 5).
  - **The channels not joined** are those `exploreChannels` finds (its first page of 100, as the
    old mobile list's "Other channels") that the user can read: public ones, or private ones
    they're invited to (`logic/communities/otherChannels`). A private channel they aren't invited
    to isn't listed (it couldn't be opened). They follow the user's own channels, in the order
    found (both the user's decision, 2026-11-24). They have no long-press menu.
  - **Mute all channels** mutes (the client's `muteAllChannels`); there's no "Unmute all" (the
    backend's community mute only mutes; the user's decision, 2026-11-24: fine). Every member is
    offered it, whether or not the channels are muted already (the user's decision, 2026-11-24:
    it was hidden once all were, and joined channels can start muted, so a plain member saw only
    Mark all as read and Leave). Invite people shows where the community's permissions let the
    member invite (`canInviteUsers`, admins by default). The prototype's mute-length submenu isn't
    built: a community's mute has no length.
  - **A community's long-press menu** is the prototype's (Move to top, Mute all channels, Mark
    all as read, Manage, Leave), in the strip and the sheet alike (the user's decision,
    2026-11-24). As the Chats tab's rows, the pressed avatar or row lifts over the blur.
  - **Leave** goes at once with Undo, as a group's; the tab moves to the next community (Explore
    with none left), and Undo brings it back and shows its page again. The Undo toast covers the
    switcher's strip while it shows (the user's decision, 2026-11-24: fine, it can be closed). Delete community isn't offered: the plan's menu has Leave only, and the last
    owner's leave fails with the old words.
  - **The Threads row** shows only while the user follows a thread in one of the community's
    channels (the user's decision, 2026-11-24, against the prototype, which always shows it),
    with its badge the community's unread threads (not muted).
  - **The thread screen** is the conversation's screen for the thread (one file, as the web's
    MessageArea serves both): its list (ChatEventList with the root), the composer sending to
    the thread (`thread` prop), the long-press menu in the thread's context (the root's actions
    in the chat's). ThreadPanel's own header shows (the prototype's), with the library's back
    arrow, not the platform's chevron on iOS (TODO(design): the panel has no native back), and
    its back label says "Back to details". Jump to message goes back to the conversation and
    marks the root. Info isn't offered on a thread's replies (MessageInfoScreen reads the chat's
    messages). The rules sheet shows on the top screen only (a thread's send asks there).
  - **The threads list** keeps the library's All / Unread at its own size (the plan's compact
    40px tabs are 99's library follow-up); a community's groups are headed "#channel", with no
    mark or count (ThreadList's `channelHeads`, the user's decision, 2026-11-24). A new thread
    (Reply in thread) shows its root and composer at once, with no spinner. A thread opened from
    the list is pushed straight over it (`?threads`), with no conversation between them, so Back
    goes back to the list (from testing, 2026-11-24); its Jump to message opens the conversation
    at the root. One opened from a channel (its link, Reply in thread) is over the channel.
  - **A community's preview** opened from Explore is pushed over it (and a channel read there
    over the preview), so Back goes back through them to Explore and the community the tab was
    on; it was the tab's root, so Back from it went to the Chats tab (from testing, 2026-11-24).
    Joined from there, at the same URL, the community becomes the tab's root, with the tab bar and
    the switcher's strip (`TabStacks.arrive` goes again when the URL's screen is another:
    `sameScreen`); it stayed pushed over Explore, with no tab bar (from testing, 2026-11-25). A
    channel joined from its join bar stays as it is; Back from it is to the community's page.
  - **The details** have no tiles, Members, mute toggle or Leave (the prototype has them; the
    plan's members' details are Channels, Rules and Access gates). Access gates show the
    preview's card without the statuses.
  - **The details** (rebuilt to the user's design prompt of 2026-11-25, N7 #10617; the
    prototype file wasn't available, so built from the prompt): the cover with Back, Share and ⋯;
    the avatar, name and "Public · N members"; the tiles Invite (for those who may invite, as
    the page's menu offers it: `communityInviteAccess`), Search and Mute / Unmute; About (the
    description, then the language); Members (faces, the count) to the Members screen, which is
    now details' `Members` on a group, channel or community (`community_members`); for a regular
    member, Channels, Rules and Access gates, read only (`CommunityInfoPage`); Manage for owners
    and admins with what each row holds (`communityDetails.adapter`'s `manageMeta`; the
    library's `SettingsLink` gained `quiet`, EXPORT-LOG 2026-11-25); "You in this community",
    Mute all channels; Leave, or Delete for the owner, confirmed in a small alert, then gone with
    Undo (`removeCommunityWithUndo`, which the page's menu's Leave now uses too). Left, or
    decided where the prompt is silent:
    - **No moderators**: the prompt has Manage for moderators, read only where the permissions
      say; a community's roles are owner, admin and member (the backend's `CommunityRole`,
      `communityRoles`), so Manage is for owners and admins who may edit it
      (`communityDetailsPermissions`' canEdit, a frozen community none). Open question for the
      user.
    - **Mute both ways**: the community canister's `toggle_mute_notifications` with no channel
      mutes or unmutes them all, so the tile and the switch unmute too (the client's
      `muteAllChannels` takes `muted`, default true: the old callers unchanged). Muted is every
      channel of the user's muted, as the web's and the old menus' rule. The page's menu still
      only mutes (the user's decision of 2026-11-24); say if it should follow.
    - **Search** (the tile, from the user's review of 2026-11-25): a screen on the Chats tab's
      search (`ChatSearch`) over the community's channels: the user's, by name, and those they're
      not in that they can read, found by the community (`exploreChannels`, the old desktop's
      Browse channels); a tap opens the channel (`CommunitySearchScreen`, `community_search`,
      `communitySearch.adapter`). Not there: a search of a community's messages (the app's
      message search is one chat's, `searchChat`), nor its members (the Members screen has
      that).
    - **Share**: a public community's link, as its preview shares it; a private one has none here
      (its link is Invite and share's). TODO(design).
    - **⋯**: Edit community (for those who may edit it; the pencil's place before) and Mark all as
      read, the page's menu's items the details don't have otherwise. TODO(design).
    - **Created**: the backend sends no community's creation date to the app, so About shows the
      language alone. The community canister keeps it (`date_created`,
      `backend/canisters/community/impl/src/lib.rs` 687, set at 806) but returns it only in its
      operational metrics (`Metrics.date_created`, 534 and 1554, the HTTP `/metrics` route) and
      as its first event, which `community_events` gives owners only (its
      `queries/community_events.rs`; the app doesn't call it). Neither the summary
      (`CommunityCanisterCommunitySummary`, `libraries/types/src/community_summary.rs` 13–49)
      nor `selected_initial` carries it, so the agent and `CommunitySummary` have nothing to map.
      A group's comes from its first event (`groupCreated`). TODO: a backend change (a
      `date_created` on the summary, as `chat_summary.rs` 21 has for groups).
    - **Members row** (the user's review): "Members" over "N members" (`MembersRow`), the
      group details' too, which had a "Members" label over "View all (N)" and five faces (now
      four, 26px).
    - **Sizes**: the cover, avatar ring and tiles are the group details' (DetailsHead,
      DetailTiles: a 132px cover under the status bar, 186px with an iPhone's, the avatar's
      corners a third of it, 68px tiles); Manage's rows are the kit's 60px.
    - **Rules count**: "N rules" counts the rules text's lines with something on them.
  - **Checked** in a 390×844 touch browser on the native tree against the local replica, as a
    fresh user in Sci-Fi Book Club and Meme Factory: the page, the strip, the sheet by its handle
    and by a drag, the kebab, a channel's thread from its link and from the menu's Reply in
    thread, a reply sent there, the Threads row and list, a thread from the list, the details.
    Not checked: the reorder drag on a device, iOS, the Android emulator, the dark theme.
- **Native community settings** (native N7's community half, #10373; the native plan's 12
  "Community details" → Manage, on 11's pages; `src/native/features/communitySettings`). Built,
  pushed without a URL (the local `community_settings` screen) from the details' Manage rows, the
  details' cover's Edit (owners and admins) and the page's kebab (Invite people): Edit community,
  Invite and share, Access gates, Rules and Permissions, each its own draft on the shared
  `UpdateCommunityState` (made from the community and its rules as the page opens; Rules waits for
  them) in the group pages' frame (`SettingsEditorFrame`: Save, "Discard changes?", the save's
  questions), saved through the client's `updateCommunity`, back to the details with "Changes
  saved". What the viewer's role can't change shows read only (`communityManageAccess`).
  Left, or decided where the plan is silent (the prototype export wasn't available to check
  against):
  - **Edit community** isn't in the plan's Manage list; it's the cover's pencil, as Edit group is
    a group's. Its fields are Create community's Details as the plan lists them ("banner, avatar,
    name check, description, language sheet"), as Edit profile draws a cover and a photo: the
    banner (picked, cropped 2:1 in start's crop sheet, `BANNER_SIZE`), the photo over it (cropped
    square), the name (3 to 25 characters, trimmed; no live check, as there's nothing to check an
    existing community's name against but the save), the description, and a Settings card with
    Language (start's language sheet, one language; the details' About shows it) and Public
    community (the owner's; making it private asks first, the client's question). Both images go
    with the save. TODO(design).
  - **Invite and share** is Invite people's screen (plan 10: People | Invite link) for the
    community: the details' InvitePeopleScreen is now `InvitePeople` on a group, channel or
    community, the screen a wrapper. Who gets which tab is `communityInviteAccess` (the web
    Manage's: "Invite users" for both, no adding). Suggested looks the DM partners up among the
    community's members (the client's `lookupDirectChatUsersAmongMembers(true)`: a new argument,
    the old callers unchanged). Its title is "Invite people", as the group's (the plan's row says
    "Invite and share"). From testing (2026-11-24, an admin of a public community): a public
    community's or group's link has no code (the client's `#inviteCodeId`, as the old UIs and the
    web's Manage have it), so it's always on and its switch can't turn it off; the switch said
    nothing about why. Its help now says so (`native.invite.alwaysOnHelp`, `linkSwitch`). The
    backend refuses nobody here: enabling and resetting a code is `can_invite_users`, which the
    switch already goes by for a private one.
  - **Access gates without Diamond** (from testing): the gates there can be taken off but none
    added, so the switches for Diamond gates are disabled; the Gates card now says why under it.
    Only Members must meet and Re-check dim until they apply. The off switch looked dimmed
    anyway: the library's `Toggle` drew its off thumb grey; it's white now (EXPORT-LOG
    2026-11-24).
  - **Access gates and Rules** are the group's pages on the community's draft, unchanged; the
    gates' intro names the community.
  - **Permissions**: a community's seven, in two cards (the plan draws a group's; the split is
    ours): Members (change roles, edit the community, invite, remove) and Channels and user groups
    (public channels, private channels, user groups), each with owners, admins or everyone, in the
    accent where it isn't the default (`defaultCommunityPermissions`, now exported from
    `stores/community`), and Reset to defaults (the design's text link). A community has no message
    or thread permissions. No note under the Members card (the design has none; 2026-11-25).
  - **Not built yet** (placeholders): Channels and User groups (a second PR of this issue), Bots
    and webhooks and Stats (under-specified: "Native group settings").
  - **Checked** in a 390×844 touch browser on the native tree against the local replica, as
    seedcommunity1 in Seed Private Lab (its owner): the description saved and shown in About, then
    put back; the language sheet; a permission saved (Invite people → Everyone) and reset; the
    "Keep it civil" rules saved and shown in the details, then off with the seed's default text
    put back; a Diamond gate saved and shown, then taken off; the invite link switched on (QR,
    Copy, Share, Reset) and off; Invite people from the kebab; a channel's Edit (the shared frame)
    with Discard changes. Not checked: iOS, the dark theme, the Android emulator, the banner and
    photo upload.
- **A search field password managers leave alone; a settings action with a line under it** (by
  hand, native N6, EXPORT-LOG 2026-11-10, to take back to the design export): the library's
  `lib/searchInput.ts` (`SEARCH_INPUT_ATTRIBUTES`), which `Field`'s live input carries, with a
  clear × that keeps the input's focus; `SettingsAction` takes `help`, a line under its label (the
  native Reset link's).
- **A person's photo on `UserChip`** (by hand, native N6, EXPORT-LOG 2026-11-10, to take back to
  the design export): `UserChip` takes `photoUrl`, shown over its swatch, for the native Invite
  people screen's picks (the plan's "chips with avatar").
- **The disappearing lengths' one home** (by hand, native N6, EXPORT-LOG 2026-11-10, to take back
  to the design export): the library's `lib/durations.ts` holds the lengths `TimedToggle` offers
  and `durationMs`, which its dialogs and the app's native details use, in place of a copy in
  each. Nothing on screen changes.
- **Composer caption placeholder and a count on Send** (by hand, native N5c, EXPORT-LOG
  2026-11-09, to take back to the design export): `MessageComposer` takes `attachedPlaceholder`
  (the text box's placeholder while something's attached; "Add a caption" by default) and
  `sendCount` (a count on Send's corner, from 1). The native composer passes "Add a caption…" and
  the number of photos and videos picked; the web passes neither.
- **Mirrored message kinds and smaller GIFs** (by hand, native N5c, EXPORT-LOG 2026-11-08, to take
  back to the design export): every kind of message (photo, album, video, GIF, file, link, transfer,
  swap offer, poll, prize) takes `mirror` as text and voice bubbles do, so your own in the native
  layout has its grouped and tail corners on the inline-end side; and a GIF message is capped at
  180 × 315 (three quarters of the design's 240 × 420), on the web and native alike.
- **Shell breakpoints vs layout tokens**: the shell's breakpoints and widths (Fix Brief - App
  Shell Layout: 768 / 1200 / 1476 / 1876 / 2476px, chat list `clamp(350px, 30cqw, 550px)`, right
  column 375 / 425 / 500px) don't match the library's layout tokens (`--bp-*` 1280–2500px,
  `--panel-info-*` 325–450px, `--panel-list-*`). The shell follows the brief (`shell/layout.ts`
  and Shell's container queries). The tokens should be brought in line, or the brief corrected.
- **Shell minimum width**: the brief gives the shell a 900px minimum and the island an 825px one
  up to a 1255px shell, but at 900px the island has only 806px (900 − 2 × 12 padding − 60 rail −
  10 gap). The shell's minimum is 919px instead, so the two agree; a smaller window scrolls the
  shell (both ways, below 919 × 720px) rather than the page. Confirm against the prototype.
- **CHIT streak ring** (by hand, 8d, EXPORT-LOG 2026-11-19, to take back to the design):
  `ChitDialog`'s ring fills from the last milestone reached to the next (`progress`, from
  `@client`'s `streakRingProgress`): empty at 0, a third a day towards 3, full on the day a
  milestone is reached (the heading then reads "3-day milestone reached!"), on the next segment,
  empty, once the next claim opens, and full from 365 on. The export's drew a fixed arc at 0 and
  emptied on each milestone.
- **Nav rail's local pick** (by hand): `NavRail` keeps the item a click picked until the host's
  `activeIndex` changes; it now also lets it go when `items` change, as the app shows Favourites
  only with favourites, which moves the items after it.
- **Rail remembered** (by hand): `NavRail` tells the host when the user expands or collapses it
  (`onExpandedChange`), so the app keeps that across visits where the rail pushes the layout
  (`shell/railState.svelte.ts`); floating, it starts collapsed. The host also says whether the
  rail floats (`floating`), rather than the rail measuring its animating slot, and the collapse
  toggle works with Enter and Space.
- **Nav rail's communities scroll on their own** (by hand, #10641, EXPORT-LOG 2026-11-27), to
  take back to the design export: the communities fill the rail down to Create community and
  Explore communities, which stay in view with the foot (Admin, CHIT, profile, collapse), and
  past that only the communities scroll (no scrollbar, which would push the collapsed rail's pins
  off centre; a cut-off pin shows there's more). The accent bar follows an active pin as the
  list scrolls and is clipped at its edges, and a community picked elsewhere (a link, the chat
  list) scrolls into view. The whole rail still scrolls in the shell's slot only when even the
  foot doesn't fit, which the shell's 720px minimum keeps from happening. The design has no
  overflow for the communities: it shows a few.
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
  (they did nothing without). `GroupMessage.swipeLeft` puts the app's say on a left swipe; the
  web no longer sets it (L2): it keeps the group's own mapping, as web/05 says (others' messages:
  right replies, left forwards; your own text: right edits, left replies), and hands
  `onSwipeLeft` only a forward, where the message can be forwarded (`webMessageSwipeLeft`). The
  old mobile tree keeps its rule (`messageSwipeAction`: right replies, left edits your own or
  forwards someone else's), and native sets `swipeLeft` for its own (left edits your own). The
  bar's position still assumes its full width (`BAR_W`).
- **Message text** (by hand, phase 3b): `ChatBubble` shows its `text` as plain text, so markdown,
  links, mentions, custom emoji and spoilers were lost. It now takes a `body` snippet shown in its
  place; the app renders the old UI's `Markdown` there. A lone emoji stays the bubble's own (large).
- **Tips** (by hand, 5a, EXPORT-LOG 2026-11-16), to take back to the design export: `ReactionChips`
  (so `ChatBubble` and `MessageGroup`, and `GroupMessage`) takes `tips`, a chip per token before
  the reactions: the token's logo and the total, the viewer's own marked as their reactions are,
  who tipped as its tooltip. The design has no tips. A tip with an `id` is a button with `onTip`
  (`MessageGroup`'s `onTip(index, id)`, by hand, 5b, EXPORT-LOG 2026-11-23): the reader tips again
  in that token.

- **A deleted message's popover** (by hand, EXPORT-LOG 2026-11-19), from a Claude Design spec
  not yet in the export or the plan files: `ChatBubble` (so `GroupMessage`) takes `deletedBy` and
  `deletedAt`; with either, the placeholder is a button (its send time still inline) whose popover,
  in `Tooltip`'s inverted style (`Tooltip` takes a second line, `detail`, and an `id`, by hand),
  says who deleted it (`deletedBy`, the whole line in the app's words, "Deleted by Alice", so
  every language words it in full; EXPORT-LOG 2026-11-20) and when, 8px above it at its start
  edge (the end edge mirrored), linked by aria-describedby. Ours: it goes under the placeholder
  where it wouldn't fit above inside the scroller, a press elsewhere closes it, a mouse click
  keeps it open (a tap toggles it), a pen that can't hover taps as a touch does, a long-press
  neither opens nor closes it (`lib/deletedPopover`), and it closes when its placeholder goes.
  The open popover's group comes forward over its neighbours (`z-index: 3`, EXPORT-LOG 2026-11-20:
  each group is a stacking context, and the list puts the earlier message later in the document),
  and a deleted placeholder's hover bar sits beside it, at its end, centred on it, clear of the
  bubble and the popover (`lib/hoverBar`), where web 05 puts the bar over a narrow bubble's start;
  every other message keeps web 05's placement.

- **Video players for links** (by hand, 5a, EXPORT-LOG 2026-11-16), to take back to the design
  export: `PlayerCard`, a link's click-to-play player (a poster with a play button and the title,
  the player only on its click, a row linking to the site where it can't play), and `ChatBubble`'s
  `players`, before its cards in a 542px bubble. The design has no player.
- **One message per group** (by hand, phase 3b): the conversation uses the old UI's list, which
  renders one row per event, so each message is a `MessageGroup` of its own. `avatarSpace` keeps
  the avatar's space under a run's first message and `endsRun` gives only the run's last message
  the last-in-group shape. The design composes whole runs in one group.
- **Voice messages**: `VoiceMessage` draws a fixed waveform and has no `levels` prop, though every
  OpenChat voice note has one.
- **GIFs** (by hand, EXPORT-LOG 2026-11-16): `MessageComposer` takes the host's results (`gifs`:
  `ComposerGif`s with a status and a search that found none), asks for a search (`onGifSearch`),
  the next page (`onMoreGifs`) and hands a pick back (`onPickGif`); its placeholder tiles
  (`GIF_WORDS`, `onGif`) are for the docs only. The design shows the categories but not what each
  searches for (Trending is Klipy's featured GIFs, the others search their word, "Thanks" "thank
  you"), nor the loading, empty, failed or nothing-found states: TODO(design). Typed words are
  searched once typing stops for 500ms, from 3 characters, as the old `GiphySelector`s did.
- **Proposals** (by hand, 5a, EXPORT-LOG 2026-11-16), to take back to the design export:
  `ProposalMessage` is in the `GroupMessage` union (`kind: 'proposal'`), so `MessageGroup` renders
  it; its type prop is `topic` (it was `kind`, which the union takes), a decided proposal can also be
  `adopted` (not yet executed) or `failed` (its execution failed), a host that passes `myVote` (null
  for none) owns the vote (the card no longer remembers one cast here, which stayed after a failed
  vote), and its buttons press on Enter and Space.
- **Proposals in the conversation** (`features/conversation`, 5a; `logic/conversation/messageRow`,
  `proposalVote`; `proposalCard` in `@client`, the new trees' only: the old `ProposalContent`s keep
  their own arithmetic, so what they show doesn't change, e.g. NaN% with no voting power): a
  proposal shows as `ProposalMessage`: its title, its type (the chat's names for its NNS topic or
  SNS action, `proposalTopicsStore`, "unknown" until they load), its proposer (a known team's neuron
  by name, `NamedNeurons`, else its id shortened), Critical for an SNS's treasury, dapp and minting
  actions (the mobile app's list), its tally (each side's share, to two places) against the share it
  needs to pass when voting ends (`minYesPercentageOfTotal`) and at once
  (`minYesPercentageOfExercised`), how long voting has left ("Voting period remaining: 2d") or that
  it has ended, and how it was decided. Adopt and Reject until its deadline, whatever the outcome
  (the NNS keeps voting open after an early decision, for the rewards), while the reader hasn't
  voted and the chat isn't read-only, as the old cards (`proposalVoting`). A proposals chat's
  screen makes its rows' context again every minute (`PROPOSAL_CLOCK_MS`) and the rows key on the
  time left, so the countdown keeps up and voting closes at the deadline (the old cards ticked
  with `now`); the vote shows at once (`voteOnProposal`, `proposalVotesStore`) and the row
  is made again as it does (`RowCache`). A vote that didn't go through says why, as the old cards
  did: no neuron to vote with (the reader's OpenChat principal to add as a hotkey, with a copy
  button), or each neuron that couldn't vote with why, linked on the IC dashboard
  (`ProposalVoteDialog`, no design for it: `TODO(design)`); any other failure is a toast. Proposal
  details opens its page on the IC dashboard (`proposalPage`). Not carried over: the summary (the
  old card showed it, with Read more) and the payload ("Details") on the card, which the design's
  card has no room for (they're on the dashboard page); the proposal's id and the proposer's link;
  collapsing a proposal and the proposals filters (the right column's entry is a placeholder:
  "Right column host"; `FilteredProposals`, and the old lists' grouping of collapsed proposals, come
  with them). The native conversation shows the same card without Adopt and Reject (it passes no
  vote handler yet). Checked on the local replica with proposals added to the list on the page
  (there's no proposals chat there): the card, and a vote that fails.
- **Prizes** (`features/conversation`, 5a): a prize shows as `PrizeMessage`. `PrizeMessage` takes
  `canClaim` and passes the click to `onClaim` by hand: the design offers Claim to everyone and
  gives no click, which `claimPrize` refuses. Claim shows only where `prizeView` (`@client`, shared
  with the old trees) offers it: not the sender's, not in a DM, not while previewing or lapsed, not
  once claimed, ended or all taken, not to a reader who misses a requirement. A prize carries no
  amount, so a win says "You won". While a claim is on its way (the old trees' `claimsStore`)
  the card shows "Claiming…" with a spinner in place of Claim
  (`PrizeMessage`'s `claiming`, by hand), and its confetti fires once the claim has won, not on
  the click (by hand: the design fired it on the click). How long
  it has left is worked out when the row is made and doesn't count down. A prize still being sent
  (`prize_content_initial`) shows as the card it will be, with "Sending prize…" where Claim would
  go (a failed one stays a text bubble, which shows the failure); one in a ledger the registry
  doesn't carry stays a text bubble. A reply shows its quote on top (see Media messages).
- **Thread panel and "N replies", by hand (4c, EXPORT-LOG 2026-11-07)**, to take back to the design
  export: `ThreadPanel` takes `list` and `composer` snippets (and `replyCount`): the app lists a
  thread's replies with the conversation's own list and composer (`MessageArea`), which the
  panel's `MessageGroup`s and `MessageComposer` couldn't be (no paging, read marking, menus,
  attachments). The thread link under a message is design pass 8's (`ChatBubble`'s bordered pill
  under the reactions: faces, "N replies", "· N new", the accent while open; `threadFaces`,
  `threadNew`, `threadActive`), but as its own component, `ThreadLink`, which `ChatBubble` draws
  and `MessageGroup` draws under every other kind of message (from the message's thread fields),
  where pass 8 draws it in `ChatBubble` only: so a poll, a swap or a file keeps its link, and no
  message shows two (EXPORT-LOG, pass 8). `modal.ts` exports `dialogOpen()` for a page's own Esc.
  `ThreadPanel`'s Follow waits for the host (`Waited`, a spinner) where it flipped at once.
- **A group's sender name** (by hand, EXPORT-LOG 2026-11-07), to take back to the design export:
  `MessageGroup`'s name above a run is as wide as the name (at the inline start, truncated past
  the column), not stretched across it, so only the name opens the profile.
- **Composer banner** (by hand, 8b): `ComposerBar` takes `onBannerAction`, passed to `Banner`'s
  `actionHandler` with `bannerAction` as its label (it had the label but no handler). Nothing in
  the app uses it yet: a guest's Sign in (10a) is on the `Banner` that stands in for the composer
  where the reader can't send, which had an action already.
- **A change given up** (by hand, 10a, EXPORT-LOG 2026-11-10), to take back to the design export:
  `Optimistic` (and `Waited`) roll back a call that rejects with `CANCELLED` (`{ cancelled: true }`,
  exported with `isCancelled` from `optimistic.svelte.ts`, which `ProfileDialog`'s sign-in steps
  check too) without setting `failed`, so `GroupPanel`'s mute and @everyone pills and
  `GroupSettingsDialog`'s About page Mute and Favourite say nothing when the app asks a guest to
  sign in instead (they said "That didn't go through. Try again.").
- **Scrollbars in Safari** (by hand, 10a, EXPORT-LOG 2026-11-10), to take back to the design
  export: `global.css` gives `scrollbar-width: thin` (and `scrollbar-color`) only where
  `scrollbar-color` is supported. Safari has `scrollbar-width` but not `scrollbar-color`, and
  with `scrollbar-width` set it drops the `::-webkit-scrollbar` rules, so it drew its own bar (the
  chat list's, the rail's, the conversation's) rather than the thin grey thumb on no track. The
  scrollers that set `thin` themselves (`MessageComposer`, `Learn`'s contents, the shell's rail,
  the conversation's list) no longer do. Not a regression: the same since Safari 18.2.
- **Own pictures in the rail, conversation and members** (by hand, L1, EXPORT-LOG 2026-11-10), to
  take back to the design export: `NavRail`'s `profileColor` (the user's swatch under or in place of
  `profileAvatarUrl`; the rail had one fixed gradient), `ConversationHeader`'s and `MessageGroup`'s
  `avatarUrl` (a picture over the colour), and a `GroupPanel` member's `image` (`MemberRow` took one
  for bots and webhooks only).
- **The chat list's community header picture** (by hand, #10624, EXPORT-LOG 2026-11-24), to take
  back to the design export: `ChatListHeader` takes `avatarUrl` (the community's own picture over
  its swatch, which shows while it loads and if it fails) and `ChatListPanel` passes it on as
  `headerAvatarUrl`; the header's swatch is the community's own (`headerColor`, `swatchFor`), as on
  the rail, where it was always teal.
- **Chat row avatars, mentions and typing** (by hand, L1, EXPORT-LOG 2026-11-10), to take back to
  the design export: `Avatar` takes `url`, an image over the gradient (which shows while it loads
  and if it fails); `ChatRow` takes `avatarUrl`, `mentions` (an "@" pill before the unread count,
  as both old rows had it) and a `typing` that may be the words ("Lucy is typing"), after the dots
  in the accent as `ComposerBar`'s typing strip has them; `ChatListPanel` passes `avatarUrl` and
  `mentions` on. Still missing from the design:
  - a muted unread count: the old rows showed a muted chat's count, and the "Thread replies"
    count when only muted threads are unread, in grey; `ChatRow`'s and `ChatListPanel`'s counts
    are always the accent's, so they show as any other count;
  - ~~a way for the host to set or clear `ChatListPanel`'s search text~~: done, its `query` now
    follows the host (see the next entry).
- **The chat list's search tabs** (by hand from web/04, L1, EXPORT-LOG 2026-11-11; they replace
  the fold-away of 2026-11-10), to take back to the design export: while there's a query
  `ChatListPanel` pushes its All / Direct / Groups / Unread tabs up and away and its search tabs
  (All results / Chats / People) up after them, 400ms, and pushes the filters back as the search is
  cleared, the user's pick kept; nothing moves under reduced motion. Each search tab has a badge
  of its results (`SegmentedTabs`' `counts`), the selected tab's plate slides between them
  (as on every `SegmentedTabs` now) and the results fade in on a switch. All shows up to 5 chats and
  3 people, each section ending in "+N more chats / people" that switches to its tab; Chats and
  People list everything (`lib/searchTabs`). New prop `people` (the people and bots found). The
  filter doesn't narrow a search. `query` follows the host: the user's typing sticks until the
  host passes a different text, so the host clears a search by passing `""`. The Thread replies
  row hides while a search is on (web/04). The 2026-11-03 export's grouped search (EXPORT-LOG,
  "Still to port"; its source isn't in the repo) is the reference for the exact look if it comes
  back. TODO(design): the badges' style (the export's `SegmentedTabs` count: a pill, the accent's
  on the selected tab, grey on the others), the push's easing (`--ease-standard`; web/04 gives the
  motion and its 400ms only, not whether the rows fade too), the plate's slide (`--duration-slow`,
  `--ease-out`, on every `SegmentedTabs`; the export's plate doesn't move) and
  the look of "+N more …" (an accent text button, left-aligned under the section).
- **A busy Button** (by hand, L6, EXPORT-LOG 2026-11-12), to take back to the design export:
  `Button` takes `busy`: a spinner in the label's colour in place of the icon, the variant's look
  kept, not pressable (`aria-busy`). The Suspend user and Freeze confirm dialogs' actions use it
  while they run (see "Platform operators and moderators"). TODO(design): the export's own dialogs
  swap the label ("Sending…") instead; the design has no busy button.
- **A pending toast** (by hand, L6, EXPORT-LOG 2026-11-12), to take back to the design export: the
  library's toast layer takes `showPending` (`ToastLayer`, handed down with `setPendingToastHost`):
  a toast with `UndoToast`'s loader, no action or ×, no time limit, which `settle` turns into how
  it went in the same slot (it doesn't play in again). A platform moderator's unfreeze and
  un-suspend use it (`shell/pendingToast`; see "Platform operators and moderators"). Native's
  `ToastQueue.showPending` is the same idea. TODO(design): the design has no pending toast on the
  web, nor a failure tone for a toast.
- **The chat list search's Groups** (by hand, the user's decision of 2026-11-12, EXPORT-LOG
  2026-11-12), to take back to the design export: a fourth search tab, **Groups** (All results /
  Chats / People / Groups), with its badge, and All's Groups section after People (its first 3,
  then "+N more groups"). New `ChatListPanel` prop `groups` (the public groups found, rows like
  `people`'s); `lib/searchTabs` has the Groups tab and cap; strings
  `ui.chatListPanel.searchTabs.groups`, `moreGroups` and `groupMembers` (a found group's line).
  `SegmentedTabs`' labels no longer wrap: a label too long for an equal share widens its tab, the
  others giving way ("All results" took two lines at a 349px panel once there were four tabs);
  a bar too narrow for every label at its full width is tight, its tabs shrinking with their
  content and a label ending in an ellipsis, so no bar spills out (`lib/tabsFit`, review of
  #10477). TODO(design): the tight bar; web/04 has no groups: the tab, the section and its rows (the chat list's
  `ChatRow`: avatar or swatch, name, member count in the preview's place).
- **A community's chat list, and the filter remembered** (by hand, polish #10648–#10651, EXPORT-LOG
  2026-11-27), to take back to the design export: `ChatListPanel` reports a filter tab picked
  (`onFilter`, its index) so the host can remember it; with `showTabs` off the rows aren't
  filtered, whatever `selectedFilter` says; `scrollThreads` puts the Thread replies row in the
  list, first, so it scrolls away with the chats instead of staying above them. The web uses all
  three in a community's panel (no filter, Thread replies scrolling with the channels) and the
  remembered filter in Direct and groups and in Favourites.
- **A DM's typing bubble** (by hand, L1, EXPORT-LOG 2026-11-10), to take back to the design export:
  `TypingIndicator` takes `variant: 'bubble'`, native plan 04's DM bubble (received style, three
  dots, 34px tall, the small corner top-left, fading in), which the native conversation drew
  itself; both trees' conversations now use it (see "Who's typing in a conversation"). With
  `showAvatar` (and `avatarUrl`, `avatarColor`) it has the typer's 34px avatar before it, as a
  received `MessageGroup` run, web/05's "avatar + three dots"; native's has none.
  `VirtualChatList` takes a `footer` (after the newest item, scrolling with the items, the reading
  position kept as its height changes), which the web's DMs put the bubble in.
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
- **Calls**: `CallPanel` / `VideoTile` render `MediaStream`s, which Daily's prebuilt frame doesn't
  expose. Decided on #10124 (2026-11-17): the new UI makes every call with Daily's call object and
  never uses the frame, broadcasts included; the legacy trees keep the frame. `CallSession` takes
  the mode; in call-object mode its `media` (`logic/video/callMedia`) follows the participants and
  plays every remote participant's audio, and `callPeople` maps them to `CallPanel`'s people.
  - **Built (7b, 3a):** the header's call buttons follow `callOffer` (audio or video in a private
    chat, a broadcast in a public one, join the call going on, back to the user's own call once
    minimised); `CallView` shows `CallPanel` under the chat header in place of the messages while
    the user is in that chat's call; `CallHost` (the web App) takes the app's call events on one
    session (the web App, so a call outlives every route) and asks before switching calls (`ConfirmDialog`: the design has none). The chat list
    says voice or video. By hand in the library (EXPORT-LOG 2026-11-17): `ConversationHeader`
    shows the voice button only with `onVoiceCall`, shows calls in channels, and takes `callIcon`.
  - **Devices, by hand** (EXPORT-LOG 2026-11-17): chevrons on Mute and Camera pick the
    microphone, speaker and camera (`CallMedia.selectDevice`; the speaker is the app's choice,
    `setSinkId` on every remote voice, hidden where the browser can't choose). The web design has
    none; it follows the native Audio output menu. The choice isn't remembered between calls.
  - **Full screen:** the call over the whole window (`CallHost`), as the prototype's, and the
    browser's own full screen while it's there; leaving that (Esc) brings the call back inline.
  - **Ringing, undesigned:** a call ringing here is a card in the window's top-right corner
    (`IncomingCall`, from the library's `Avatar` and `RoundIconButton`), with the ringtone while the
    user isn't in another call. Accept opens the chat and joins; Decline declines; ✕ or Esc stops
    the ring here only. No design has an incoming call. While the call is in the browser's full screen, only the
    call shows, so a second call's card can't; and there's no ringtone during a call.
  - **Ended by the host, request refused:** toasts (`CallHost`), where the old trees had sheets.
  - **Broadcasts, minimal, by hand** (EXPORT-LOG 2026-11-17): a viewer without presence has Ask to
    speak in place of Mute, Camera and Share; the host gets a card per request with Not now and Let
    them speak, in the call view and on the minimised call. No demoting a speaker yet (the old
    participants list had it).
  - **Minimised (7c):** `MiniCall` floats over the middle panel while the call is minimised or
    another chat is open (`MiniCallHost`, `logic/video/miniCall`), clear of the chat's header and
    composer, and keeps the spot it was dropped in until the app reloads. It has mute, camera (video
    calls), Ask to speak, the host's requests, Back to call and Leave. By hand in the library
    (EXPORT-LOG 2026-11-18). No screen share from it: that stays in the call view (the old
    summaries had it). The design's minimised call has mute, Back to call and Leave only.
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
  into a doc and the FAQs, and `architecture` puts the host's own content on that tab, filling the screen between the header and the footer (the canister map, full width and height). Landing's section links scroll smoothly. Also (9a): `doc`, a doc page outside the tabs (the legal pages, `/diamond`), with no tab current, one column without the contents list when it has no sections; `belowDoc`, the host's own content after its sections; a section's `blocks` (numbered clauses that nest, terms and their meanings, bullets); a doc's `intro`, with `lede` and `foot` optional; `onCopySection`, a copy-link button beside every doc heading; `onSection`, a section chosen in the contents list for the host's address (the app sets `?section=` in place), and `navigation`, the host's count of its navigations, so a link to the section it navigated to is followed again after another was chosen; on a phone (one column, 860px and below) the contents list as a bar under the header naming the section being read, which opens to the whole list over the doc; and Terms and Privacy in the footer.
- **`ActivityPanel` back button** (by hand, phase 3d): opened over a chat or a wallet page
  (`?panel=activity`, ROUTES.md decision 7), the panel has a back button beside its title
  (`onBack`) that returns the left column to the middle's own panel. The design has none. Its
  empty All tab also gets its own words ("No activity yet") instead of the Payments tab's.
- **Activity feed, first cut** (`features/activity`, phase 3d): items read as the old feed's.
  The old feed marked everything read as soon as it loaded; this one follows the design: an item
  is read once it's opened, or with "Mark all read" (the feed's read-up-to time, so opening one
  marks the older ones too). The chat's name comes from `logic/activity/activityChatName` (moved
  out of `ActivityScreen` by native N13, which shares it; its "Thread" is now `thread.title`),
  which the old trees' rows call too since L3 (they pass their English "Thread", so they read as
  before). L3 (#10138, by hand, EXPORT-LOG 2026-11-23), to take back to the design export:
  - **No Polls tab** (the user's decision, 2026-11-24): #10138 asked for poll votes to get a tab
    of their own, and L3's first version added one on the web, but the tabs stay All / Mentions /
    Payments on the web and native alike, and a poll vote shows under All only. Why: poll votes
    are low-signal and rare, four tabs are tight on a phone, and the web and native should have
    the same feed. The issue's "poll votes' tab" came from its text, not a design decision.
  - **The person's picture** over their swatch (`ActivityRow`'s `avatarUrl`): the event's user,
    as the old rows showed; their swatch alone without one (or for an anonymous user), as
    everywhere in the new UI.
  - **A tip's tips** on its row, before any reactions, only on a tip's row as in the old feeds: a
    chip per token, the conversation's (`tipChips`, web 5a: its logo, the total in its decimals,
    who tipped as its tooltip), the first four then "+N" (mobile's cap: the row is narrow). A
    token the registry doesn't carry has no chip. Different from the old chips, which showed the
    number of tippers ("999+" above 999) and a tooltip with each tipper's amount and the total:
    the new UI shows the total and who, as its messages' tips do. To ask whether the feed should
    show the old count instead. The chip isn't a button (tipping isn't built, A3).
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
  swatch from the id. A person, group or community shows its own picture over its swatch, and the
  swatch alone without one, everywhere in the new web UI (the user's decision, 2026-11-10): never
  the client's default pictures (a generated identicon, `unknownUserAvatar.svg`, `group.svg`, a
  community's identicon), which the old trees keep. Own pictures come from `ownUserAvatarUrl` /
  `ownGroupAvatarUrl` (`@client`), a profile's from `profileAvatarUrl`, a community's from its
  `avatar.blobUrl`; bots and system users keep their fixed pictures (OpenChatBot's robot, the bot
  picture). They are: the chat list and its search, the chat list's community header, the rail's
  profile button and community pins,
  ProfileDialog (and its communities), UserDialog, DmPanel, GroupPanel and Manage (and the members
  lists), the conversation's header and its senders, the preview bar, the composer's @mentions
  (the library's user icon without a picture), Explore and Landing's communities. Still swatches
  only, with no pictures: the thread list's and thread links' faces, the share picker, the
  wallet's recipients, InviteDialog's and user groups' people, GroupPanel's pinned messages. Every
  screen picks the swatch with one function (`app/src/logic/swatch.ts`'s `swatchFor`, which
  `senderColor` is too) over the library `Avatar`'s five names, and every library component paints
  those names with `Avatar`'s gradients (`AVATAR_GRADIENTS`; EXPORT-LOG 2026-11-11), so an id has
  the same swatch everywhere: a person's in the list, their messages, their DM's panel and their
  profile; a community's on the rail, in Explore, its panel and a profile's communities. Not in the
  design export, whose components each had their own shades (and the rail its own names): to go
  back to it.
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
  opens a plain dialog on `DialogShell` naming the user, with the old modal's words and a reason
  (`SuspendUserDialog`, `TODO(design)`); a suspension then says so in a toast with Undo, and
  unsuspending runs in a pending toast (see "Platform operators and moderators"). From the card,
  the suspend dialog takes the card's place over the same backdrop (`moderatorAction.handOff`, by
  hand, EXPORT-LOG 2026-11-12; `DialogStack.handOff`, the local dialogs' version of the linked
  dialogs' hand-off), with a back arrow to the card, which shows again at once as it was
  (`ProfileCardData`'s `shown`); ×, the backdrop and Esc close it. Unsuspending plays the card's
  exit and closes it: `UserDialog` used to play the exit without telling the app (`onCancel`), so
  the card's invisible layer stayed until the next navigation, and a card opened again sat
  beside it (fixed in the library, EXPORT-LOG 2026-11-12; Message too).
  A DM's composer follows the other user's suspension at
  once, both ways, with no reload: a warning banner, "This user's account is suspended. You can't
  send them messages." (`recipientSuspended`, new in all 15 locales: the old trees had no words
  for it and said "This chat is read-only"), the composer back when they're un-suspended. The
  selected chat's permissions (`messagePermissionsForSelectedChatStore`) derive from
  `selectedChatRecipientStore`, the other user, which publishes only when they're replaced
  (`userSuspended` replaces the user, so a suspension or un-suspension does; another user's
  change doesn't), and the permission stores publish only when what may be sent changes;
  `chatEntryState` reads it too, for its own block (`recipient_suspended`). A frozen
  group or channel, or a channel of a frozen community, shows "This chat has been frozen"
  (`chatFrozen`), and follows a freeze and an unfreeze at once: a group's through
  `localUpdates.updateChatFrozen` (the moderator's) or the next sync (everyone else's); a
  community's (its channels' `isChatOrCommunityFrozen`) now through
  `localUpdates.updateCommunityFrozen` on the moderator's `freezeCommunity` / `unfreezeCommunity`,
  where it used to wait for the sync. Where several apply (`entryBlock`), a moderator's doing comes
  first, as the reader can't undo it: the reader's own suspension, then frozen, then the DM's
  other user suspended, then blocked (unblocking wouldn't help), then the rest. Every tree's
  composer, the old ones' and native's included, shows these (2026-11-12). The banner doesn't name
  the user (the header does); the design has no words for it (`TODO(design)`).
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
  (the old desktop panel had a Save button); turning disappearing messages on starts at a day,
  as the native details do (`logic/chats/disappearingMessages`' `DISAPPEARING_START`, the native
  plan's 10; since the review of 2026-11-10, before which it was the old panels' week, the
  client's `DEFAULT_EVENTS_TTL`, which the legacy trees keep).
  By hand: `chit` is optional (left out when the viewer turned CHIT off), `aboutContent` renders
  the bio as Markdown, and `DmChatSettings` hides read receipts without a handler, since OpenChat
  has no read receipts setting. The OpenChat Bot's DM has no right column at all, nor the header's
  panel toggle or pinned-messages button (`chatHasRightColumn` in `router/regions`, which the
  screens read through `ScreenContext.hasRightColumn`): it's the read-only welcome chat a new
  account lands on, and its panel (a picture, Search, Favourite) only took width from it; its name
  still opens its profile. It's keyed on that bot's id, not on a kind of DM, since no wider rule
  is settled and none matches it alone today: `isChatReadOnly` is false for every DM, other bots'
  DMs are conversations with their commands, and the proposals bot's DM, the other one nobody can
  write in, isn't a welcome chat. TODO(design): the plan docks `DmPanel` for every DM and says
  nothing about bots or read-only DMs; whether all bot DMs, or all read-only DMs, lose the panel
  is an open question, and until it's answered they keep it. Not wired yet: the panel's ⋯ menu (no items), calls (7b), and the
  old panel's durations other than the eight `DmChatSettings` offers (a TTL set elsewhere shows as
  its own length, "2 hours", and saves unchanged).
  - **TimedToggle's 8 lengths** (web plan 08 of 2026-11-10, by hand, EXPORT-LOG 2026-11-10): 5 min,
    15 min, 1 hour, 8 hours, 12 hours, 1 day, 1 week, 30 days (`lib/durations`), in 4 columns when
    the count divides by 4, else 3 (`durationColumns`; a `columns` prop overrides). Checked in a
    browser at the docked panel's narrowest (375px, a 1500px window; seedcommunity1's DM with
    seedcommunity2): each chip 65.5px, 54px for its text; the widest, "12 hours", is 44.4px, so
    the grid keeps its indent under the label (the plan's fallback, dropping it in 4-column mode,
    isn't needed). ProfileDialog's This chat tab (600px, a 1476px window) has 121.8px chips. Not
    measured: the group settings dialog's, whose grid has no icon and no indent. The library's minutes read "5 min" (`ui.duration.minutes`), as the
    plan's chips; its words are English only, as before. Its row and chips no longer tint on
    hover on a touch screen (`@media (hover: hover)`), where `:hover` stuck to the tapped row.

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
  - not offered: report, and the desktop row's swipe-to-remove (Remove chat is a row menu item
    instead). A platform moderator's freeze and suspend are the header's and the community
    menu's, not the rows' (L6, "Platform operators and moderators").
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
  - by hand (2026-11-19, at the user's request): the words name what it is. The line under the
    name (Manage's side and the About page) says "Public channel", "Private community", "Public
    group" (`logic/groupOrCommunity/visibility`, also the native details; six `access.public*` /
    `access.private*` keys, each translated as a whole phrase so the adjective agrees with the
    noun), where the design has a bare "Public"/"Private"; `GroupSettingsDialog` takes `noun="channel"` ("How this channel
    works", "Channel name", …) and `GroupPanel`'s member, rules, webhook and permission notes
    follow `scope`, where the export said "group" for every kind (EXPORT-LOG 2026-11-19).
  - left alone (old UIs): French `level.channel` is "Canaliser", the verb, not the noun "Canal".
    The old UIs show it ("Supprimer Canaliser"), so it stays until they go. The new trees read
    their own nouns instead (`levelNoun.*`, through `interpolateNewUi` and `timelineEventText`'s
    `levelWords`; see "Wiring"), and the details line has whole phrases (`access.*`).
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
    no others), each opening that channel's Manage with a back arrow to Channels, in the
    community's Manage's place over the same backdrop (`DialogStack.handOff`; so does the back
    arrow, and a channel's members' link to the community's). Manage reads the open chat, so a
    channel that isn't open is opened first, under the community's Manage
    (`navigateUnderDialogs`), and handed off to once it's open.
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
  - presence: who's online among the members held, from `getUserStatus` on the app's 5s clock
    (`OnlineUsers`, as the chat list's DMs, since L1), lights their rows' dots and the quick panel's
    "Online now"; the look-up runs again only on the clock or when the members held change, and the
    rows take a new set only when someone comes online or goes offline. A large group holds its
    first page of members only, so those not held aren't counted. No last-seen time ("2m") for
    those offline (`activity`): the old member lists had no presence at all.
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
  - the frame below 768px is the desktop frame at full screen with a narrower nav; the design has
    no narrow layout for it. Below 768px a browser gets the old mobile UI (10b), so it only shows
    in a window narrowed after load.
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
  - a failed invite or add shows two toasts, one above the other: the dialog's "That didn't go
    through" and the app's reason.
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
  - sharing a daily puzzle result uses it too (#10236, `PuzzleShareDialogScreen`, "Sharing a
    puzzle result"), with `onBack` (by hand) for its back arrow to the puzzle;
  - not yet: Receive's "Share to chat" (6b, with `SharePicker`). The picker has no recent chats order (the design's "Recent chats"): sections
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
  strip resting on it (two names: "A and B are typing"; a group's, a channel's and a thread's: a
  DM shows a bubble since L1, see "Who's typing in a conversation"), sign-up takes a pasted invite link
  (`resolveReferrer`: its `ref` is the referrer's user id; bots and suspended users, whose referral the sign-up refuses, are neither found nor searched for, `canRefer`) and says "Invited by" for the link's
  referrer, and Swap shows only the best quote. Not yet:
  - `NavRail` pins take a `menu` (right-click, Shift+F10), but the rail adapter gives the
    community pins none: the community menu's actions live in the chat list header for now.
  - `ChatPicker`'s multi-select (forward to several chats; the old trees forwarded to one, as 5b
    does), `ChatListPanel`'s grouped search
    (messages need search in the app; people and bots show under their own heading since L1, see
    "Chat list"), the design's `MediaViewer` (replacing
    `core/MediaViewer.svelte`, which the native conversation opens too) and `PuzzleDialog`'s screen layout (native) are
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
- **`ExploreCommunities`' page size, by hand** (polish #10652, EXPORT-LOG 2026-11-27, to take back
  to the design export): `pageSize` (default 6, the export's) sets the rows a page shows, the
  `limit` it asks the host for and Load more's count. The web passes 20.
- **`ExploreCommunities`, by hand** (8a, to take back to the design export): a community's
  `avatarUrl` and `coverUrl` (images over the swatches, as `NavRail`'s pins); `languageOptions`
  as `{ code, label }` (the filter picks by code, shows the label and the code's flag; the app's
  old codes `cn`, `jp`, `iw` have flags); `initialQuery` / `initialLanguages` (the URL's
  `?q=&lang=`, or the saved filter, on opening; an initial text shows the results passed, not
  "Searching…"); `initialScroll` / `onScroll` (the scroll position kept across visits); `failed`
  (a page the component asked for couldn't be loaded: an error with Retry in place of the page
  before it, or Retry on Load more, with the component left as it was; no design for it); the
  guest banner sits at the foot of the pane in every view (EXPORT-LOG 2026-11-09: it sat straight
  under content shorter than the pane, near the top in search), and the open language menu goes
  over it and is capped to the room left in the pane, scrolling in it, kept to it as the pane
  scrolls or resizes, the pane scrolling it up first when it opens near the foot (its last
  options ran under the banner, or past the pane's foot under the sticky search bar).
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

- **Clipped glyphs on one-line labels** (2026-11-21, by hand; EXPORT-LOG): text truncated with
  an ellipsis (`overflow: hidden`) and set at `line-height` 1 or 1.1 lost the bottom of its
  descenders (g, p, y) and the top of its accents: every `Button` label ("Sign out"), the nav
  rail, dialog, page and call titles, field placeholders and more. The library's `glyph-room` mixin
  gives each one room around its line without changing its size or position. For the design:
  its specs put single-line labels at `line-height: 1`; a tighter line than the font's own
  (about 1.3) clips once the text is cut with an ellipsis. Labels at 1.2 still lose up to a
  pixel off an accented capital (Ś, É) or a Vietnamese stacked accent.

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
  - seven message-only kinds (`p2p_swap_accepted` has no design type, so it's a payment;
    `poll_vote` is under All only, with no tab of its own: the user's decision, L3);
  - no paging.
- **Chats**:
  - typing reaches peers only for the selected chat (WebRTC), so the chat list rarely shows it;
  - read receipts exist only in DMs;
  - there's no cross-chat message search (web/04's Messages tab and section, and picking a
    message to open its chat searching, aren't built: see "Chat list", the search's tabs, for a
    search of the messages on the device instead);
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
  - the terms shown in a popup at sign-up (`AuthDialog` links to `/terms` instead, which opens
    the terms page in a new tab);
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

- **Words for group, channel and community** (2026-11-19): the new UIs (src/web, src/native and
  `logic/conversation/messageRow`) fill a message's `{level}` from `levelNoun.*`, nouns reviewed
  in all 15 locales and stored as they read mid-sentence (French "canal", German "Gruppe"),
  capitalised only where a key wants it: `interpolateNewUi` (`i18n/i18n.ts`) and
  `timelineEventTextNewUi` / `aggregateEventTextNewUi` (`logic/conversation/timelineEventText`);
  the old trees' `interpolate`, `timelineEventText` and `aggregateEventText` are unchanged, and no
  old-UI file is touched. Lint stops src/web, src/native and `messageRow` importing the old three
  (eslint's `oldLevelWords`; `newUiOnlyLogic` lists new-UI-only logic), but only a static import: a dynamic
  `import("@i18n/i18n")` hands over the whole module, and `app/src/core` serves both trees, so
  neither can be checked. Chinese keeps 群聊 for a group, the word ~30 other cn strings use. The
  old `level.*` (French `level.channel` is the verb "Canaliser"; German nouns lower-cased
  mid-sentence) is left for the old UIs, which show exactly what they did. Not fixed: many
  `{level}` sentences can't agree with the noun (gender, case: Russian "к {level}у", French
  "au {level}" for a feminine "communauté", Polish "do {level}" wants the genitive); fixing those
  means whole-phrase keys per level.

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
  now use too): a guest's join is recorded and opens sign-in, and replays once after it, once
  the account's own chats are in (`takePostLoginJoin` on `currentUserChatsLoadedStore`, AppScreen;
  after a sign-up the anonymous session's stand in until then, and a join decided against them
  was undone by the account's initial load); gates the client can't check open `JoinGateDialog`, a level at
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
  - the platform moderator's Freeze / Unfreeze group or community on a preview (the desktop
    footer's button): a group preview's header menu has Freeze / Unfreeze group instead; a
    community is frozen from its own header's menu in the chat list, not from a channel (the
    user's decision, 2026-11-12; L6, "Platform operators and moderators");
  - the gate icons (desktop) and "Access gates enabled" (mobile) in the footer: the bar's gated
    state says how many requirements there are instead;
  - "Get Diamond" in the dialog closes it for the Diamond dialog (a dialog replaces another, never
    stacks), so after buying the user presses Join again; the design has Diamond over the join
    dialog, its row turning Met;
  - the design's preview mode around the bar (its rail entry for the previewed community, the
    reduced menus, the user's own messages hidden): not 8b's;
  - **Agree and join** (the user's decision, 2026-11-20; every new-UI join: the bar's Join,
    `?autojoin`, a guest's join replayed after sign-in): the rules of what's joined come before the
    join, in the `join_rules` dialog (`JoinRulesDialogScreen`, the rules in Markdown as the
    pre-send `RulesDialog` shows them), with Cancel and "Agree and join". logic/join's `beginJoin`
    reads them (the client's `rulesToAcceptBeforeJoining`: a group's or channel's own, through the
    group's `rules` query or the community's `selected_channel_initial`, which answer someone who
    isn't a member; a channel's community's, and a community's, through its `selected_initial`,
    when the user hasn't accepted them; each only if enabled); none for a guest, who is asked once
    the join is replayed after sign-in, and none for a member (a join replayed after sign-in that
    finds them one is skipped). A channel's rules and its community's are each headed with whose
    they are. If the user goes to another page while the rules are read, nothing is joined or
    shown (`DialogStack.closedAll`). "Agree and join" joins (`agreeAndJoin`, with the rules
    agreed to); the join gate dialog takes the rules dialog's place over its backdrop
    (`DialogStack.handOff`) when there are requirements to meet, which carry the agreement on. A
    join that doesn't go through leaves the dialog up with a toast. The backend can't take an
    acceptance with a join, only with a message, so the client keeps the text agreed to, and when,
    in the user's cache on the device (the `rules_agreed` store of `openchat_db_<principal>`; each
    change read and written back in one transaction by the agent, `applyRulesAgreedChange`, so
    tabs don't write over each other's, and the client's changes made one after another; read as
    the session starts, so a reload or a restart doesn't lose it; `rulesAgreedOnJoiningStore`
    holds what was last read), and the first send there, finding those rules still to accept,
    sends their versions (`acceptedRules`, as the pre-send prompt's acceptance is) without asking,
    if the text is still what was agreed to; changed rules are asked about as ever. An agreement
    goes once a send carries it, once the user has left the group, channel or community (a leave
    that fails keeps it), and after 30 days unused (the pre-send prompt asks then). It's per device: another device asks before
    the first message, as before. Left:
    - rules that couldn't be read (offline, a canister error) don't hold the join up: they're
      asked for before the first message, as before;
    - a channel of a private community opened through its invite link: the channel's rules can't
      be read before joining (`selected_channel_initial` takes no invite code, and the backend
      checks the community is accessible without one), so only the community's are shown, and
      the channel's are asked for before the first message, every time. Needs `invite_code` on
      `selected_channel_initial` (a backend change);
    - a channel of a community being previewed joins the community (the bar's "Join community"):
      only the community's rules are asked for there, and the channel's before the first message;
    - TODO(design): no rules dialog in the design; the pre-send dialog's look, with "Rules of
      {name}", a line saying to agree to join, and "Agree and join".
  - the Back from a channel preview of a joined community goes to the list, not to the next chat
    (the old desktop's `selectDefaultChat`; the router picks the list's default chat).
  - two joins at once on one canister and ledger (two channels of one gated community): the
    client's standing gate approval (`#standingGateApprovals`, which spares a retry the approval
    fee) can keep the wrong amount, as which approval the ledger applied last isn't known. Fix
    when parallel joins become possible: remember neither when two overlap, so the next try
    approves again. Not reachable from the UI yet.
- **Guest pass** (10a #10134, `logic/auth/guestPass`, `logic/auth/authDialog`): someone signed out
  in the app (a guest, `anonUserStore`) reads Explore and public groups, communities and channels,
  each a read-only preview (8a, 8b), with the guest rail (Explore and the previewed community, Sign
  in for the profile: `NavRail`'s `guest`), Explore's guest banner and the preview bar's "Sign in
  to join". Built here:
  - **Pages that need an account** (`guestRouteAccess`, ROUTES.md's Guest column): a DM,
    `/favourite`, `/notifications`, `/wallet/…`, `/profile_summary`, `/share` and `/admin`. A guest
    who goes to one gets Explore in its place in history (`GUEST_HOME`; `regionsFor` shows Explore
    for it meanwhile, so the page never mounts for a guest) with the sign-in dialog over it
    (`onGuestSignIn`, the router's, through `core/RouteEffects`; `askToSignInForThisPage`), and the
    page opens once they're signed in: the client's post-login state carries it (`{ kind:
    "continue_to", path }`, `postLoginPath`; AppScreen goes there once, replacing Explore). Every
    way of signing in carries on, sign-up and an emailed link included (the identity changes in
    place, so the state is still there). `?panel=activity` over a page does nothing for a guest.
  - **Linked dialogs that need an account** (`linkedDialogNeedsAccount`): `?profile`, `?diamond`,
    `?chit` and its views, `?share`. A guest's opens the sign-in instead, over the page, and the
    dialog once signed in (DialogHost). Opened from inside the app (the `upgrade` and `profile`
    events, the rail's CHIT), the param replaces the page's entry rather than pushing one
    (`openLinkedIntent`), so the page isn't left twice in history once DialogHost drops it again.
    `?hof` (the leaderboard) opens for anyone.
  - **Actions that need an account** ask a guest to sign in and leave them where they are
    (`signInFirst`, which reads `anonUserStore` itself; `signInFirstOrCancel` for a change shown
    before it's made, which rolls back saying nothing): the details panel's Mute, @everyone and
    Favourite (the pills roll back saying nothing: "A change given up" above), Manage's About page
    Mute and Favourite, the panel's and header's chat menu items but the details and Copy link, the
    community menu's Mark all as read, the chat list's Create group, a thread's Follow, and a
    profile card's Message (the DM opens once they've signed in, where `chatWith` would open it:
    `chatWithRoute`). Joining and creating a community already did (8b, 8a).
  - **The composer's Sign in prompt**: where a guest can't send and no preview bar shows (a chat
    the guest isn't previewing), the old footer's "Please sign-in to send a message" banner has a
    Sign in action (`entryBlock`'s `anonymous`, whose banner has `signIn`). In practice a guest's
    chat is a preview, whose bar's "Sign in to join" is the prompt.
  - **A thread without a composer** (a preview's, a guest's included, or a read-only chat's: no
    composer and no preview bar there, as in the old trees) keeps the room under its last reply
    the composer leaves above it (`MessageArea`'s `no-composer`, ComposerBar's 12px), where the
    reply sat on the panel's bottom edge.
  - **The sign-in dialog's state** is `logic/auth/authDialog.svelte.ts` (from `features/auth`,
    F2's deferred item): `AuthDialogProps` (its `.then` chain gone, L7; the methods' names come with
    the host, `AuthDialogHost.options`, which `createAuth` sets from `auth.adapter` for every host)
    and `pageSignIns`, which now also holds where a page's sign-in goes on to (`opened`,
    `destination`): /diamond's Upgrade's Diamond dialog, an emailed link's too, in place of
    MarketingScreen's own flag.
  - Decided (no design: the spec's guest notes are the rail, Explore, the preview and "Composer →
    Sign in prompt"; 99-not-designed has the rest of the guest pass as not designed):
    - under the sign-in for a page that needs an account, Explore (the guest rail's one
      destination), not the old desktop's `/chats` (which it did for `/favourite` only). The
      native tree, whose signed-out start keeps the URL, keeps the old route effect. The user's
      answer (2): fine for now.
    - a DM asks to sign in, then opens (ROUTES.md had "no"); `/admin` asks to sign in, then shows
      what it shows the signed-in user (ROUTES.md had "blocked"). The user's answer (3) keeps
      that: showing a guest the not-found page in its place was considered and dropped, as the
      code is public (hiding the route gains nothing) and the backend enforces operator access.
      Signed in, a non-operator gets the old Admin page's refusal ("Only platform operators can
      access the admin area"), and an operator a note that the console isn't built here yet
      (L6, "Platform operators and moderators").
    - a preview's messages ask a guest to sign in (the user's answer): they have the hover bar,
      the menu and reactions a member would have (`messageOffer`'s `guest`: what anyone with an
      account could do, nothing a role gives, no tips), and what needs an account asks them to
      sign in, staying on the chat (`guestMessageAction`): a reaction (a chip, the hover bar's,
      More reactions, before the picker opens), Reply (the hover bar's, the menu's, a swipe),
      Reply in thread, Forward, Reply privately, Remind me, Report, Follow in a thread and
      Translate (for Diamond members). Copy, Copy message url, Share and folding a proposal work
      signed out. A guest's double-click does nothing (it's for selecting a word, not a reply that
      asks to sign in). A signed-in previewer's messages stay read only, as in the old trees
      (signing in wouldn't let them act: joining would).
    - a preview's row in the chat list has no "…" menu, a guest's or anyone's (the user's answer
      (6), the design's preview mode: "channel row menus off"; `chatRowHasMenu`): a group or
      channel the user isn't a member of. A member's row keeps it, a lapsed member's too (still a
      member, who may want to leave, mute or archive it). So the row menu's Remove no longer
      shows on the web (it only did for a preview, `canRemoveFromList`); the preview bar's Back
      takes a preview off the list. The native tree's long-press sheet is as it was.
    - closing the in-app sign-in forgets what it was to go on to (a page, a join, creating a
      community), so a later sign-in from the rail doesn't pick it up (the old trees kept a join
      and replayed it then). The user's answer (1): yes, keep. So does a sign-in that ends signed
      out without the dialog being closed (the II or NFID window closed, which hides the dialog:
      `signInEndedSignedOut`), and asking for a sign-in replaces whatever was left (`askToSignIn`
      clears it when it goes nowhere in particular: the client's `updateIdentityState` keeps a
      post-login state it isn't given a new one for).
    - `?hof` (the leaderboard) opens for a guest. The user's answer (5): keep, an easter egg.
  - Left:
    - a guest who follows an in-app link to a page that needs an account (a `/wallet` link in a
      message) leaves the preview for Explore under the sign-in; Back returns to it.
    - the chat list's empty state's "New message" has no handler (for anyone).
    - narrow screens: a phone browser gets the old mobile UI until N15 and then the native tree
      (10b), each with its own guest handling.
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
- **Legal pages and `/diamond`** (9a #10132, `features/marketing`): Learn's doc pages outside its
  tabs (ROUTES.md, decision 5), from the library's `doc` (by hand: "Learn, added by hand" above).
  The terms, privacy notice and guidelines are Learn content (`learn/legal`), converted word for
  word from the old pages, which now render it (desktop's Terms, Privacy and Guidelines content,
  both sign-ups' terms), so a legal edit lands once; the old pages' rendered text is unchanged. As
  the old pages, the legal texts are in English only. Not kept, or different:
  - italics are plain, in the old pages too now (two places: the terms' "no" in an already bold
    note, and the guidelines' "change the system"), as in Learn's other converted content: Learn's
    markdown subset has no italics;
  - the guidelines are open sections, not the old collapsible cards; `?section=` scrolls to one
    rather than opening it;
  - the old desktop copy links used the page's origin; every tree now copies on the site's own
    (`copySectionUrl`), with the toast, and the doc's own path (the terms at sign-up link to
    `/terms`, not the sign-up's page). The whitepaper's headings copy their links too. Both old
    trees render the legal docs with one component (`components/landingpages/LegalDocContent`,
    which has no colours; the mobile sign-up passes its own heading and stacks the definitions);
  - a clause's number is the doc's own text ("1.2)", "A1") rather than a CSS counter.
  - `/csea-reporting`: the checklist's words are in two places, the old desktop page and
    `CseaChecklistScreen` (in English, as the old page), until the desktop tree goes: a change to
    them goes in both. Its state is shared (`logic/moderation/cseaChecklist`). The time in the UK
    follows the app's 5s clock (`stores/time`'s `now`) rather than the old page's own minute.
  - `/diamond` shows the comparison (or the member's membership) but not the plans or payment:
    paying needs the PIN prompt and the wallet, which only the app has, so Upgrade opens the app's
    Diamond dialog (after signing in, signed out: an emailed sign-in link too, while this page
    is open) rather than paying on the page as the dialog does. TODO(design): the page's head ("Diamond", "Benefits of Diamond") and the card under it
    have no design; the old page showed the feature table alone.
  - Narrow screens: a phone browser gets the old mobile UI until N15, then the native tree (10b):
    the old desktop pages (from the same content) in a web build (`OC_MOBILE_LAYOUT=v1`), and "not
    found" where the old mobile tree is mounted (`v2`), which has no legal routes of its own. The
    web's doc pages are checked down to 390px in a narrowed window; `/diamond`'s `DiamondContent`
    is cramped there (its own 32px padding and a feature column that wraps), as the dialog is.
    The web tree is for desktop widths only, so that stays.
- **Diamond** (`?diamond`, `features/diamond`, 8e #10131): paid through the shared payment
  (`logic/diamond`, which both legacy `Payment.svelte`s use too), in CHAT or ICP at the backend's
  own prices (CHAT in production, ICP elsewhere, by default), auto-renew on, a timed member opening
  on the plans. By hand in the library: `DiamondContent` (the dialog's body, for the `/diamond`
  page in 9a), per-token prices (`tokenPrices`: only the backend's tokens, never USD-converted), the
  approval fee (`approvalFees`, counted in what a token can afford and shown on confirm), a top-up
  address per token (`depositAddresses`), `onUpgrade` resolving `false` (nothing bought, nothing to
  say: the PIN prompt dismissed, or a PIN failure, which is toasted with its own message), and Back
  handing off to the dialog it came from, and for the page (9a): no ×, Maybe later or Done without
  `onClose`, and `onStartUpgrade`, Upgrade and Extend handed to the host. Not yet:
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
  - the card's reminder and hide (its "⋯" menu has only "How to play", `?chit=howto`): the old UI
    has neither.
- **Sharing a puzzle result** (#10236; `?chit=share:<gameId>`, `PuzzleShareDialogScreen`): a
  solve slow enough to be carded (`canShareResult`, the old screens' `canShare`) offers Share in
  the puzzle dialog, which opens `ChatPicker` in its place over the same backdrop, its back arrow
  (`ChatPicker`'s `onBack`, by hand) returning to the puzzle; ×, the backdrop and Back close both.
  The picker offers every chat the user can send text in, the open one too (the user's decision
  of 2026-11-23, as the old desktop picker did). The chosen chat opens, and its conversation
  takes the share (`sharedToChatStore`, `logic/dailyPuzzle/shareResult`): the result card as its
  draft's attachment and the message written in the picker as its text, the composer started
  again from the text (`composerGeneration`: it reads a draft's text only as it mounts), so the
  open chat ends up as any other. In place of a transfer, prize or swap offer staged in the chosen
  chat's draft, the picker asks first (`shareStep`), with the composer's replace confirm
  (`ReplaceStagedDialogScreen`, "This daily puzzle result will take its place") in the picker's
  place over the same backdrop. Replace shares; Cancel, × and the backdrop keep the payment and
  attach nothing; either way the chosen chat opens (the user's decision of 2026-11-23; the old
  trees replaced it without asking). Opened from the puzzle, the confirm keeps the veil the picker
  wore. A picker opened straight from a link (`?chit=share:<gameId>`, not handed off to) shows its
  own backdrop, which the confirm fades in again in its place. Nothing is sent
  until the user sends it, as the old trees' share. The card is made from the store's solve
  (`shareableResultCard`), so a link to it with nothing to share opens the puzzle instead. Where
  it differs from the old trees:
  - the picker lists the chats the user can send text in (`SharePicker`); a chat that allows text
    but not the result's permission (`memeFighter`, as `contentTypeToPermission` maps it)
    refuses at send, as the old pickers did;
  - staged in the composer as a file chip, "The Daily #12" over its game and tier
    (`composerAttachment`; `TODO(design)`: the design has no chip for a result, the old trees
    showed the whole card there). Its remove button says "Remove file".
- **The result card in a chat** (#10236, `DailyResultMessage`, by hand, `TODO(design)`: no design;
  built on `TransferMessage`'s card): the puzzle's number, game and tier, its grid
  (`DailyResultBoard`, the game's own pictogram), and the time, hints and streak from the daily
  canister's results index (`DailyResultVerifier`, once per card as it shows; "–" until it
  answers and for a result it doesn't hold, #9332 invariant 44), "Verified" or "Unverified" (the
  stats faded); Play while it's today's puzzle and the reader hasn't solved it, and CHIT isn't
  turned off (`cardOffersPlayWith`: the setting hides the puzzle dialog, so Play would open
  nothing), opening `?chit=puzzle:<gameId>`; "needs a newer app" for a game this build can't
  draw, and no grid (`drawsResultGrid`) for a layout it can't read, as the old cards. The
  caption is plain text, where the old trees rendered it as markdown (as the other cards' captions
  in the new UI). The old desktop hid the verified line on a narrow window; it always shows. The
  native conversation shows the card too (the library's `MessageGroup`, `messageRow`), with its
  grid, and Play (N11) as the web's, pushing the native puzzle screen; its pinned messages and
  message info show it without the grid or Play.
- **Leaderboard** (`?hof`): this month's, last month's and all time's top 10, as the old hall of
  fame shows them, with its Invaders game behind the joystick (8f: the old game, now
  `core/invaders`, for both trees), where the device can play it (a keyboard, or iOS, which steers
  by tilting); it now starts again after a game ends, keeps the final score on screen, and fits
  its waves to the field (fewer rows on a short one, a phone on its side).
- **Ways to earn** (`AchievementsDialog`): the old "Learn to earn" list (`achievementList`). The
  dialog's groups and its "next up" bands are the app's (`logic/chit/achievements`: each achievement
  given a group; quick up to 1,000 CHIT, middling up to 3,000, big above), not anything the old
  UI had; no achievement has an icon of its own (the old UI had none).
- **Achievement toast** (`AchievementToast`, for the client's `chitEarned`): only with the popup
  setting on (`chitPopup`) and CHIT on, as the old earned popup; one toast for each achievement,
  in turn, with the CHIT it paid (the old popup listed them all in one, with the total), and the
  longest streak gets the flame icon, where the old popup shook the page and played longer. A
  batch is marked seen as it comes, as the old popup did, so with the popup off it isn't. It plays
  just above the composer, centred in the middle panel, or 12px above the middle panel's bottom
  where it has no composer (Explore, the wallet, a list with nothing selected), as web/00 and
  web/13 have it since 2026-11-12 (replacing L1's "top of the app"). It never overlaps the app's
  toasts, which sit at the same foot (see "Toasts"): while one shows (`toastStore`'s or a library
  component's, `shell/Toasts`), it sits 12px above them on their centre line
  (`shell/bottomPlacement`'s `achievementSpot`, from the toasts' height: they're placed by the
  same rule, so it doesn't wait on them moving), and when they go it settles back down over 280ms
  (the duration token; none with reduced motion) rather than staying up. Like them, it moves up
  above a popup the composer opens (its + menu, mention list or emoji picker, which it would
  otherwise cover: it's over the whole frame, so a lower z-index can't put it under them), and
  stays on screen on a window smaller than the shell. The places come from the elements
  themselves (`shell/bottomAnchors`: the middle panel, the chat's own composer in it, not a
  thread's beside it, and the toast layer), measured only while it plays, at most once a frame,
  again as they resize, come or go, the window resizes or the shell scrolls. Its confetti is the
  library's layer, which takes no clicks, so a toast's Undo or × under a falling piece still
  works. With the middle panel hidden (the shell's single column showing the list) it plays
  centred at the window's bottom, over its safe area and any toast; that isn't checked, and the
  shell's minimum width keeps it from showing (10b: no narrow layout).
- **App events** (`features/app/AppEventDialogs.svelte`): the not-found, no-access and
  not-available dialogs are a `DialogShell` with the old UI's words (no design: `TODO(design)`);
  "Page not found" was never translated. Suspending a user (`suspendUser`, platform moderators
  only) opens `SuspendUserDialog` (see "Suspend and unsuspend").
- **Toasts**: the app's toast (`toastStore`, e.g. "Failed to un-archive chat") shows as the
  library's `UndoToast` without its action (`shell/Toasts.svelte`). The design has no failure tone
  for a toast, so a failure looks like any other message. The library components' own toasts (a
  wallet send's, an invite's, a sign-in method's) show in the same layer (`setToastHost`, App),
  over every dialog and veil (design pass 7), above the app's when both show (a failed invite: the
  dialog's "That didn't go through" and the app's reason).
  - **Where** (web/00, "dock it at the foot of the panel whose content changed"; since
    2026-11-12): the layer sits 12px above the middle panel's composer, or 12px above the middle
    panel's bottom where it has none (the wallet, Explore, a list with nothing selected), centred
    on the panel and as wide as it, the library's toasts and the app's together. While the
    composer has a popup open (its + menu, mention list, emoji and GIF picker: the library's
    `data-composer-popup`) it sits 12px above that instead, and goes back down when it closes. It
    follows the panel and the composer as they change (a composer growing, a right column docking,
    the window resizing, the shell scrolling in a window smaller than its 919x720 minimum), moving
    with the duration token (none with reduced motion), and stays on screen: on a short window
    with the composer below its bottom it sits 12px over the window's bottom (its safe area) and
    across the part of the panel that shows (`shell/bottomPlacement`'s `toastSpot`, measured from
    `shell/bottomAnchors`). Before, it was centred on the window, 24px over its bottom, partly over
    the composer.
  - **No middle panel** (the shell's single column showing the list): centred on the window, 24px
    over its bottom safe area, as before. Never seen: the shell's minimum width keeps it from
    showing, and the web tree has no narrow layout (10b).
  - **The right column's foot** (TODO(design)): web/00 docks a toast at the foot of the panel whose
    content changed, so a toast about a thread's or a details panel's action belongs at the right
    column's foot. They all go to the middle panel's: the app's toasts (`toastStore`'s
    `showFailureToast` / `showSuccessToast`, called from dozens of places) don't say which panel
    raised them, and telling them would mean changing every caller. The library's toasts could
    (a host per column through `setToastHost`'s context), but only them, so the two kinds would
    split; left until the app's toasts carry their panel.
  - **A thread open as a modal** (below the docking width): the toasts stay at the middle panel's
    foot, over the sheet, where they can cover the bottom of the thread's composer, as they could
    before (the sheet's composer isn't measured).
- **Chat list** (`features/chats`, phase 3a, then L1 #10136): the rows are the old rows'
  (`logic/chats/chatRow`, shared with the native Chats tab): the preview line
  (`logic/chats/latestMessagePreview`), the search in the list (`chatMatchesSearch`), and since L1:
  - **the filter** (All / Direct / Groups / Unread) is remembered on this browser, per scope
    (`features/chats/listFilter`, polish #10648): Direct and groups keep the one the mobile and
    native lists keep (`chatListFilterStore`), Favourites one of its own
    (`favouritesListFilterStore`; mobile shows no filter there). A community's panel has no filter
    (#10649), its search says "Search for channels…" (the old trees' `searchChannelsPlaceholder`,
    #10651) and its Thread replies row scrolls away with the channels, only the header and the
    search staying put (#10650).
  - **nothing selected**: the middle with nothing selected (region `empty`) is `NoChatScreen`, in
    place of the development placeholder ("middle: empty"). Beside a chat list with chats it has
    the kit's `EmptyState` with the old desktop's words by scope (`noChatSelectedText` in
    `logic/chats`, which the old `NoChatSelected` uses too); beside an empty list (which says "No
    conversations yet" itself), the activity feed (/notifications, ?panel=activity) or the threads
    it's blank (`middleWithoutChatText`, from the region's `chatList`). It keeps the placeholder's
    toolbar, Back on a narrow screen and the panel toggle where the route has the right column
    (`MiddleToolbar`). TODO(design): the design doesn't say which words, icon or action, nor what
    shows beside the activity feed; there's no action (the list's own New message has no handler
    yet either).
  - **the preview's markdown**: the preview goes through the app's `Markdown` (one line, links
    suppressed), as the old rows' does, so `**` and `_` format rather than show. The library's
    `ChatRow` takes it as `previewText`, a snippet the host renders (by hand, EXPORT-LOG
    2026-11-19, to take back to the design export: the export's preview is plain text);
    `ChatListPanel` passes it to the chats' rows only, not to the people and groups a search
    found (a username, a bot's description, a member count stay plain). In the row a link is text
    in the row's colour and a spoiler stays hidden: a click on either opens the chat (the old rows
    reveal the spoiler and open the chat). The native Chats tab's rows and its search's chats do
    the same.
  - **mentions in the preview**: as the `@names` typed (`typedMentions` in `logic/conversation`,
    through `mentionsAsTyped`), escaped (`escapeMarkdown`), as is the author's name before a
    group's message (`latestMessagePreview`'s `markdown`), so a name like `_john_` shows as it is.
    The old rows pass the raw `@UserId(…)` to Markdown, which shows a `@username` link (suppressed).
    Every other text the new UI shows as it is, not through Markdown, has the names as typed,
    unescaped: the list of threads, the thread's root card, the activity feed, the pinned messages
    and the forward picker's preview. A mention of a user or group not known yet stays as
    `@UserId(…)` until it loads (the client loads those a latest message or an activity mentions);
    in the preview a group not known shows as Markdown has it, a bold `@unknown_user_group`, as in
    the old rows.
  - **avatars**: a chat's own picture (`chatAvatarUrl`): a DM's user's avatar
    (`ownUserAvatarUrl` in `@client`), a group's or channel's own (`ownGroupAvatarUrl` in
    `@client`, which the client's `groupAvatarUrl` now uses too): its avatar, else a proposals
    chat's SNS logo, else a channel's community's avatar if the community has one. A user, group or
    channel with no picture of its own shows its swatch, as everywhere in the new web UI (see
    Swatches), not the app's default picture the old rows show (a user's generated
    identicon, `unknownUserAvatar.svg` for a user not loaded, `group.svg`, or `"unknown"` under
    `OC_MOBILE_LAYOUT=v2`, nor a community's identicon): the user's decision, 2026-11-10. A bot
    keeps its own picture, else the app's bot picture (`/assets/bot_avatar.svg`), in a DM with it
    and in the search.
  - **who's typing**, in place of the preview ("Lucy is typing", "3 members are typing":
    `getTypingString`), over the built rows (`liveRow`). Typing reaches peers only for the
    selected chat (see Chats, below), so another row rarely shows it. Typing (here and over the
    conversation's composer) and read receipts go over WebRTC (`rtcConnectionsManager`), where no
    peer ever connected (found testing L1, fixed in the client for every tree):
    - without TURN credentials the peer was given the service's refusal (`{ "error": "Invalid API
      Key" }`, 401) as its ICE servers, and `RTCPeerConnection` threw ("Failed to read the
      'iceServers' property from 'RTCConfiguration'"). A local build has no `OC_METERED_APIKEY`
      (`build_dev.sh` and `frontend/.env` don't set it), so it always asked with `apiKey=undefined`.
      With no credentials the peer now connects directly only (no ICE servers): enough on one
      machine or one network, so typing works locally with no key; across networks it needs the
      key (set `OC_METERED_APIKEY` in `frontend/.env`), as before;
    - two inits at once (the app's at sign-in, a chat's connections as it opens, as on opening a
      chat's URL) made two peers with the one id (`d_<userId>`); the signalling server refused the
      second ("ID-TAKEN"), which had replaced the first. They now wait for the one peer.
    Checked end to end on the local replica (two signed-in browsers, a DM): the row's typing line
    and the composer's strip. The peer's id is per user and device kind, so two desktop tabs of one
    account still take it from each other (the old trees' too).
  - **online presence**: a DM row's dot, from `getUserStatus` on the app's 5s clock
    (`OnlineUsers`, `logic/chats/onlineUsers`), for the DMs listed. Only the effect that looks
    them up follows the clock, and the rows take a new set only when someone comes online or goes
    offline, so the rows aren't built again on every tick (as `ec9b75ac59` did for the old list).
    No dot for groups, bots or the user, as the old row.
  - **a suspended user** (their whole account, by a platform moderator; the user's decision,
    2026-11-12): a DM whose other user is suspended (`allUsersStore`'s `suspended`, `chatRow`'s
    `suspended`, direct chats only) shows the avatar dimmed with a small red ban mark where the
    online dot sits (no online dot), and a "Suspended" tag after the name (the library's `Pill`,
    danger tone). Everyone sees it, not only moderators, as the old DM header's "Account
    suspended" (which the new header keeps). The preview line stays as it is. A person the search
    finds is marked the same way (`foundRows`); `UserDialog` and `DmPanel` show the tag (after the
    name, under it in the panel) and no online dot, their avatars undimmed. Groups and communities
    are frozen, not suspended, so they're never marked. The native Chats tab's rows show it too
    (`nativeChatRow`, the same `ChatRow`). It follows a moderator's suspend or unsuspend at once
    (the client updates `allUsersStore`). Not in the design export: TODO(design) for the dimming,
    the mark and the tag (`Avatar`, `ChatRow`, `UserDialog`, `DmPanel`; EXPORT-LOG 2026-11-12).
  - **unread mentions**: an "@" before the count, groups and channels only (`unreadMentionCount`
    in `@client`, the old rows' rule), following `messagesRead` as the unread count does, and none
    for a chat whose latest message has expired.
  - **a chat the user can't read into** (a preview, or anything while suspended:
    `isChatReadOnly`) shows no unread count or mentions, as the old desktop row (the old mobile row
    showed them). The native Chats tab's rows follow the same rule (its Unread filter too).
  - **Thread replies' count**: the route scope's unread thread count (`scopeUnreadCounts`), the
    unmuted count unless that's 0 with no mentions, then the muted one (`unreadCountShown`, both
    in `@client`, as the old mobile list's and the old desktop unread pill). It shows in the
    accent either way (the library has no muted count, see "Chat row avatars…").
  - **search on OpenChat**: as the user types (300ms after the text settles; `TermSearch`), the
    client's `searchChatList` looks up people and bots that take direct chats, and public groups
    (`searchGroups`), in every scope, each kind arriving on its own (`chatListSearchResults` hands
    `TermSearch` what has come so far: the people show while the group index is still answering,
    and a failed call finds nothing of its kind). **Public groups are back at the user's request
    (2026-11-12)**, as the old search had them (web/04's search has chats, people and messages
    only; L1 had added groups, the old mobile search's, then dropped them on 2026-11-10): they're
    the search's **Groups** tab and All's Groups section (up to 3, "+N more groups"), each row the
    group's own picture or its swatch (`ownGroupAvatarUrl`, the chat's swatch), its name and its
    member count (`GroupMatch.memberCount`, the group index's `member_count`, now mapped). Picking
    one opens its page (`/chats/group/:id`, the same route as `/group/:id`), which previews it as
    a link to it does; it then shows under Chats, as any previewed chat. TODO(design): web/04 has
    no groups section (see "The chat list search's Groups" under Design / library). What's
    already in the list (a DM's user or bot, a group the user is in or previewing, in any scope:
    the list's chats with `allServerChatsStore`, which has the group previews) and the user are
    left out (`outsideList`). Communities aren't searched: the old trees' chat
    list search never had them (Explore finds them). They're the search's People (the search's tabs
    below; until 2026-11-11 they followed the list's own matches under "Users and bots", the old
    desktop list's heading); a person's line is their @username, a bot's its description. Their avatars follow the rows' rule (above): a person with no picture of their
    own shows their swatch, and a bot with no avatar the app's bot picture. Picking one starts a
    chat (`chatWith`). A leading "@" is dropped, an empty term asks the backend nothing, and the
    search starts again empty in another scope. The old trees search as they did before L1, but
    through `searchChatList`: the old desktop people and bots in the Chats scope (no groups, the
    default), people and public groups in the "none" scope (nobody reaches it, still
    `searchGroups` and `searchUsers`); the old mobile (New message) people, bots and public groups
    (`{ groups: true }`, one search where it called `searchGroups` beside it; the groups and the
    people still arrive apart, as before).
  - not carried over: the old desktop avatar's blocked overlay and max-streak ring (the old mobile
    row had neither, nor has the design), the community scope's channels the user hasn't joined
    (the old desktop's `BrowseChannels`, mobile's `OtherChannels`: browsing channels needs a
    design of its own), and message search (none across chats, see Chats below).
  - the native Chats tab's rows have the avatar and mentions in `chatRow` but don't show them
    (`nativeChatRow` leaves them out); its search is its own, on the same `searchChatList(term, { groups: true })` and
    `outsideList` (People and Public groups, see the native Chats tab's "Search's People and
    Public groups").
  - **the search's tabs** (built 2026-11-11 from web/04, the chat list's plan,
    `web/04-chat-list.md` in the design plan, "Search"; by hand in `ChatListPanel`, see "The chat
    list's search tabs" under Design / library; the user's decision, replacing the fold-away of
    2026-11-10): while there's a query the filter tabs push out, the old tabs sliding up and away
    and the search tabs sliding in after them over 400ms, reversed on clear (none of it moves
    under reduced motion). The search tabs are **All / Chats / People** (and **Groups**, the
    user's decision of 2026-11-12, see "search on OpenChat" above), in the filters'
    segmented style, each with a badge of its results; the selected one's plate slides as it
    changes. All's badge is every result (Chats', People's and Groups' added up), not the rows All
    shows: its sections' "+N more" add up to it. All shows its first 5 chats, 3 people and 3
    groups, each section headed (label and total) and ending in "+N more chats / people /
    groups", which switches to that tab; Chats lists every matching chat (the list's own search,
    archived chats included, pinned first), People every person and bot found (`searchChatList`,
    less the user and anyone already a DM: `outsideList` and `foundRows`, the panel's `people`),
    Groups every public group found that isn't a chat already (the panel's `groups`). The caps and each tab's
    list are `lib/searchTabs` (`searchSections`, `searchTabCounts`) in `@openchat/ui`, with
    specs. A new search after the field is cleared starts on All; clearing it brings the
    filters back with the user's filter, and the filter doesn't narrow a search. The app passes
    the panel its `query`; a new scope starts the panel again (`{#key scopeKey}`). The Thread
    replies row hides while a search is on. People's and Groups' badges read 0 until the search
    answers (300ms after typing stops, then the call), then the count lands: no "searching"
    state on the tab yet.
    **Not built: Messages.** Web/04 has another tab, **Messages** (All: up to 5 messages with
    "+N more …"), and "picking a message opens the chat already searching for that text"; its
    backend line is a message-index search, the panel capping and paginating. There's no search
    for messages across chats, and a chat's own search (`searchChat`, backend `search_messages`
    per group, channel or DM) returns `{ message_index, score }` only, no text (see "Chats"
    under "Data the design shows that the backend doesn't have", and the native Chats tab's
    "Message search"). The user's note (2026-11-11): it can probably be done without the
    backend, by searching the messages already on the device. What's there:
    - **the IndexedDB cache** (`openchat-agent/src/utils/chatsDb.ts`, one database per
      principal, every signed-in user): `chat_events` and `thread_events` hold full events, the
      `Message` with its `MessageContent` (text, captions, poll text), keyed
      `<chatId>[_<threadRoot>]_<eventIndex>` (a prefix cursor per chat works, as
      `deleteEventsForChatOrCommunity` does), indexed by message key and `expiresAt` only;
    - **what's in it**: the `CachePrimer` fetches one page per chat for every chat in the list
      (newest first, then only newer events), skipping archived chats, chats too large for it,
      external-URL chats and threads; deeper history only where the user has scrolled back.
      It's emptied on every `CACHE_VERSION` bump (no migrations: 11 bumps since May 2026), when
      the cache is 30+ days stale, and on logout. Edited messages are marked `dirty` and keep
      their old text until refetched;
    - **in memory**: only the selected chat's events and the open thread's (`selectedChat.ts`);
    - **every chat's latest message**: each `ChatSummary.latestMessage` carries its content.
    What's missing: no text index (each query would scan and deserialise every cached event, or
    an index would have to be built and kept up to date); no API to iterate or search the cache
    (it needs an agent method and a worker request, since only the agent may touch IndexedDB);
    no search library in the repo (no lunr, minisearch, flexsearch or fuse); and results only
    cover what this device happens to hold, so they'd need saying so ("messages on this device"),
    with deleted, encrypted, expired and left chats' events filtered out. Picking a result
    would open the chat with its search on the text (the conversation's search exists:
    `logic/conversation/chatSearch.svelte`). TODO: Messages, when it's built.
  - **the rail's unread** (`features/rail/rail.adapter`, as the old left nav and bottom bar): Chats
    and Favourites a dot (collapsed) or the count (expanded) of their DMs' and groups' unmuted
    unread messages, lit by a mention alone too (no number then), not their threads' (as the
    native tab bar, N5a's decision; the old desktop nav added threads); Notifications its unread
    activity; a community pin a dot while one of its channels has unmuted unread messages or a
    mention. The old desktop nav's live call counts aren't shown (the rail has no place for them).
  - **a name still loading** (#10563, at the user's request): the first chat list can show before
    every user it names has loaded (`FoldUsers` in the client: the new trees only, through
    `createOpenChatClient`'s `chatsBeforeUsers`). A DM whose other user is still being fetched
    (`usersLoadingStore`, the client's fetches in flight; `userLoading` in `logic/chats/chatRow`)
    shows the library's shimmer, a short bar for the name and a shimmering avatar, read as
    "Loading…" (`SkeletonText`, `Avatar`'s `loading`, `ChatRow`'s and `ConversationHeader`'s
    `titleLoading`, `NativePageHeader`'s; by hand, EXPORT-LOG 2026-11-21): in the web and native
    chat lists, and in the open DM's header on both. Its composer says "Loading…" rather than
    that the chat is read only (`entryBlock`'s `recipient_loading`), since what may be sent to
    them isn't known yet. "Unknown User" shows only once the fetch has finished without them.
    Left: a group's preview whose sender is still loading says "Unknown User: …" until they
    arrive, and the search's matching by name doesn't know them yet. TODO(design): the export
    has no loading name; the shimmer is Skeleton's.
  The community header's menu only marks all read; its other items open dialogs later phases
  build.
- **Conversation, first cut** (`features/conversation`, phase 3b): reading only (the composer is
  3c). The message kinds are 5a's (each in its bubble: "Message kinds" and the entries after it),
  the message menu, reactions and swipes 5b's ("Message actions"). Events other than messages show as a centred line in the old UI's words, names in bold
  (`logic/conversation/timelineEventText`, shared with the old trees; no design for them:
  `TODO(design)`), and "N messages deleted" expands them. Each event's line has its date and time
  under it, as in the old trees (`toLongDatetimeString` in `@client`, which both old
  `NonMessageEvent`s use too; L2), smaller in `--ink-3`; the aggregated joins, deletions and role
  changes have none, as in the old trees. The web plan's conversation (`web/05-conversation.md`)
  doesn't cover these lines, so they stay the old UI's (`TODO(design)`). The header has no back
  button (`ConversationHeader` has none; the web tree has no narrow layout, 10b), and its menu does
  favourite, mute and copy link only: the rest open dialogs (phase 4), and calls are phase 7. A
  DM's header has the old last-seen line (L2: `LastOnline` in `logic/conversation`, over
  `directChatSubtitle` in `@client`, shared with the old `ChatSubtext`s and the native header) in the header's presence line, with its online dot
  under two minutes; web/05's header doesn't say what that line says, so it's the old words
  (`TODO(design)`). Own runs show the reader's own name over them in groups and channels, as
  others' runs do (display name, else username; once per run, at its start, in `--ink-3`), and
  no name in a DM, where neither side has one (`showsSenderName` in `logic/conversation/messageRow`,
  L2, at the user's request; web/05 doesn't say, and the design's "You" gives way to the name).
- **Sticky date** (`features/conversation`, L2): as web/05 says ("Date pills stick: the date of
  the messages at the top of the window stays pinned at the top of the conversation while
  scrolling"), the list (a thread's too) pins the day of the messages at its top, in the inline
  dates' pill (`UnreadDivider` neutral), over the messages, as both old lists do: VirtualChatList
  says which day (`stickyDateTimestamp`), at the height `core/stickyDateTop` measures, which
  native's conversation uses too. It's the day's own pill until that reaches the pinned one's
  place, then the pinned one, with the day's own hidden as it scrolls on up under it, so a date
  never shows twice (the list's hand-off is told the pinned pill's place 16px lower, the 16px a
  day's pill sits into its row). One "Today" pill; the Unread divider doesn't stick.
- **Go to first mention** (`features/conversation`, L2; web/05 doesn't cover it: `TODO(design)`).
  An @ button over go-to-latest goes to the chat's first unread mention (`IconButton` "at", as
  go-to-latest is drawn; the old ones were round fabs with a bold "@"), and goes once that mention
  is read; none in a thread or a read-only chat, as in the old trees. Not carried over: the old
  lists' unread count on go-to-latest (shown even when at the bottom), and the old threads'
  go-to-top button.
- **Who's typing in a conversation** (L1): the web follows its plan, web/05 (the conversation's,
  `web/05-conversation.md` in the design plan; "Typing": "never a
  permanent row"; "DM: a received-style typing bubble (avatar + three dots) at the end of the
  list"; groups and channels a strip resting on the composer; acceptance: "typing indicators never
  change layout height"). In a DM, the library's `TypingIndicator` (`variant="bubble"`, with
  `showAvatar`: the other person's 34px avatar, their own picture over their swatch or the swatch
  alone, the values their messages' rows use, `ctx.avatar` and `senderColor`, then the three dots
  in a 34px received bubble with the small corner top-left), laid out as a received `MessageGroup`
  run, there while they type and gone when they stop. It's the last thing in the list's scroll
  content, after the newest message (`ChatEventList`'s `footer`, `VirtualChatList`'s, EXPORT-LOG
  2026-11-10), not under the list: the list's viewport keeps its height. As it comes and goes the
  list keeps the reading position: at the bottom it comes into view (the messages above slide up
  for it, and back down as it goes); scrolled up, it's below, out of view, and nothing visible
  moves. It shows only after the latest message: while newer messages are still to load
  (`moreNewMessagesAvailable`, after a jump back), a DM's typing goes to the composer's strip. In a group or channel (and any thread) the strip
  resting on the composer (`ComposerBar`), as before. The rule is `typingPlacement`
  (`logic/conversation/timeline`, spec'd), shared with the native conversation, whose bubble has
  no avatar (native plan 04: "three dots, no avatar"; its DMs show no avatars at all). Checked end
  to end on the local replica (two signed-in browsers, a DM).
- **Call events** (`features/conversation`, 5a; `logic/conversation/callItem`, shared with the
  native conversation): a call's message shows as `CallEvent`, a centred pill in the timeline, not a
  bubble, with no menu or reactions (web/05, web/12). Ended: "Video call · 4:12 · 10:00" (its length,
  `formatClock`); missed by the reader (ended without them in it, `overCallState`): "Missed video
  call from Ann", with Call back; the reader's own: "You started a voice call". Live only while
  it's the chat's call in progress (`videoCallInProgress`, `timelineCallState`), with the faces of
  those in it and how long it has run (on the app's `now500` clock), and Join; a call that never
  says it ended but isn't in progress any more shows as over, with no length. Two or more calls in
  a row, each within 8h of the next, show as one grouped pill that opens to list them (web/05,
  `groupCalls`: the list shows the run's newest, which draws the run, and the rest are left out of
  its items; anything between them, a message or a date's pill, keeps them apart; the live call is
  never grouped); the group is read as one (its row carries every call's index). Join joins the call,
  and Call back calls again, or joins the call going on by then (`callRequest`, 7b); a live call
  the user is in shows Leave. `CallEvent` drops the " · " before the time when a call has no length
  (by hand, EXPORT-LOG 2026-11-16). Checked on the local replica with calls added to the list on the
  page (no calls can be made there).
- **Media messages** (`features/conversation`, 5a): images, memes, GIFs and videos show as
  `MediaMessage` tiles, a GIF as big as a photo (the native tree's are three quarters, by choice:
  `compactGifs`, by hand, EXPORT-LOG 2026-11-19). A reply shows its quote at the top of the
  bubble, as a text bubble's (`ReplyQuote`, by hand: every kind takes `quoteName` / `quoteText` /
  `onQuote`, EXPORT-LOG 2026-11-19; a click goes to the quoted message, `quoteFor`), and so do
  voice, file, transfer, poll, prize and swap messages (not a proposal's card, `ProposalMessage`,
  which takes none: the proposals bot sends them, never as a reply). Like the text bubble's, the quote
  shows the quoted message's text only: the old trees' quote of a photo, video or GIF shows its
  picture. No edited mark yet (`MediaMessage` takes none). In low bandwidth an image shows its
  thumbnail and a GIF an empty tile until the
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
  status). A file shows its name, size and type and downloads under its own name. A reply shows
  its quote (see Media messages). Neither has an edited mark yet.
- **Link previews** (`features/conversation`, 5a): a text message's previews show as cards under
  its text (`ChatBubble` takes `previews` by hand, a `LinkCard` each, the card the design's
  `LinkPreview` has). The design's `LinkPreview` is a message kind of its own, with plain text and
  no edit, quote, thread or reactions, so it isn't used; with previews the bubble takes its shape
  instead (320px, cards flush, the time under them). A card links only to an http(s) URL
  (`ogPreviewCard` in `@client`, shared with the old trees). The sender removes one with the X on
  its card, after a confirm (`ConfirmDialog`, no design for it: `TODO(design)`). A link to
  another OpenChat message (`messagePreviews`) shows no preview: nothing in the library renders a
  quoted message. A Twitch link in the text (a channel, a video or a clip) plays in the bubble, as
  in the old trees (`TwitchPlayer`): a player before the cards (`PlayerCard`, by hand: the design
  has none, `TODO(design)`; `ChatBubble` takes `players` and widens to 542px for them, Twitch's
  least being 400x300), from `extractTwitchEmbeds`, `twitchPlayersAndCards` (the link's preview,
  if the sender fetched one, is its poster, not a card of its own), `twitchPoster`,
  `twitchPlayerUrl` and `twitchWatchUrl` in `@client` (`linkPreviews` and `twitchPlayer` in
  `logic/conversation`). The player's URL starts playing as it loads, so it loads only on the
  poster's click, and goes back to the poster whenever it's hidden, with `allow="autoplay;
  fullscreen"` on its iframe. Nothing lies over it (the row's mark is behind it). Where Twitch
  won't play (`twitchPlayerParent`: a page another site frames, or narrower than 400px), it's a
  row linking to Twitch; the native tree always links (its context has no `twitchParent`). A card's
  X goes by the cards shown (`previewLink`), so a Twitch link's preview, which is no card, doesn't
  shift them. Checked on the local replica: a channel's poster, then its player on a click.
  One change from the old trees: a channel's poster image is Twitch's picture of the channel now
  (`twitchLiveThumbnailUrl`: the stream's latest frame while it's live, Twitch's offline picture
  when not), not its preview's image, which is only the channel's avatar and is missing whenever
  the sender's preview fetch failed (the old trees then show a black poster). A video or clip still
  has a black poster with its title: Twitch gives a preview fetch only its logo, and its own
  thumbnails need its API.
- **Transfers** (`features/conversation`, 5a): a transfer shows as `TransferMessage`, with the
  token's logo as its mark. `TransferMessage` takes `direction` and `recipient` by hand: the design
  signs it by the bubble's side, which shows a transfer between two other people in a group as the
  reader's own receipt. Outside a DM it says who got it ("to Bob") unless that's the reader. "View
  transaction" opens the ledger's explorer. The caption is plain text (no markdown), the card
  shows no sent or delivered tick (`TransferMessage` takes no status). A reply shows its quote
  (see Media messages). A failed transfer, or one in a ledger the registry
  doesn't carry, stays a text bubble. The dollar value is worked out when the row is made (and
  again once the exchange rates first load); it doesn't follow the rates' later refreshes.
- **Polls** (`features/conversation`, 5a): a poll shows as `PollMessage` and votes through
  `registerPollVote` (`pollVoteChange` in `@client` turns the card's choices into one vote, and
  refuses one the poll can't take). `PollMessage` takes `readonly` and `showResults` by hand: the
  design locks a poll only once it's closed or voted, and shows results only after a vote. A
  public poll shows no voters' avatars and has no "View votes" list yet (the old mobile
  `PollPublicVotes`). How long it has left is worked out when the row is made (3d, 5h, 12m), and
  doesn't count down. No tick yet; a reply shows its quote (see Media messages).
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
  a text bubble, which shows the failure). Time left is worked out when the row is made. No tick yet; a reply shows its quote (see Media
  messages).
- **Message kinds** (`features/conversation`, 5a; `logic/conversation/messageRow`, shared with the
  native conversation): every kind of message, as `kindMessage` and `kindText` show it:
  - in a bubble of its own: images, memes, GIFs and videos (`MediaMessage`), voice and files,
    transfers, polls, prizes and swap offers (each has its entry below), and a prize's win, the
    message the thread under a prize gets for each winner: a transfer's card (`TransferMessage`,
    + for the reader's own win, no sign for someone else's; "View transaction" opens it), its
    caption the old words, "Bob won 0.10 ICP", without their bold (no design for a win:
    `TODO(design)`; the old trees' was a spinning coin over that line). One in a ledger the
    registry doesn't carry stays a text bubble;
  - as a text bubble in the old trees' words, through the app's markdown (`bodyMarkdown`, web and
    native, so a link works): a hidden message (a blocked user's, "Message hidden"), one this version can't
    show ("This message is not available in this version of the app", "This message needs a
    newer version of OpenChat"), a placeholder ("Please wait, your message will load shortly"), a
    reminder ("⏰ I will remind you about this message at …", then "⏰ You asked me to remind you
    about this message.", each with its notes under it; a cancelled one is folded away with the
    deleted messages, as the old trees, and elsewhere shows its notes alone), and the referral card ("Invite
    friends/family", what referring earns and the reader's own link, `referralLink`; the old card
    copied the link on a click and had a QR code). No design for any of them: `TODO(design)`;
  - still as a text bubble with its content's own English text (`contentText`, the chat list's
    preview text): a bot still working ("Bot working ...", the old trees' typing dots), an
    encrypted message, a price chart and a MiniApp's card (their designs are asked for: "Designs
    needed"), a reported message's and a moderation report's
    cards (the platform moderators' review cards, left from L6: "Platform operators and
    moderators"), and calls and proposals until theirs are built;
  - deleted (the design of 2026-11-19, not yet in the plan files): the placeholder
    (`ChatBubble`'s `deletedText`, `deletedText` in logic/conversation/messageRow) says "You
    deleted this message" in your own bubble you deleted and "This message was deleted" in any
    other (your own deleted by someone else too: ours, the design words it by side only), and
    "Undeleting message by …" while it's being undeleted, as the old trees do
    (`undeletingMessagesStore`; the row is made again as it starts and stops, `RowCache`). Who
    deleted it and when are in its popover (`deletedBy`, `deletedAt`: `deletedInfo`), each line
    whole in the app's words (`deletedMessage.byYou`, `byModerator`, `by`): "Deleted by you",
    "Deleted by a moderator" for the OpenChat bot's removal for breaking a platform rule (the
    platform moderators' deletions are the bot's; its old words and rules link are gone), or
    "Deleted by" the deleter's name (the row is made again as it loads), with "Today at 14:32" under it (the
    date pills' day, `formatMessageDate`, and `toShortTimeString`). `DeletedContent` always
    carries both; a field that's empty (no deleter, a zero time) is left out, and with neither
    there's no popover and the placeholder isn't a button. A group's moderator who deletes
    someone's message is named, not "a moderator" (the backend says only who). Others' deleted
    messages still fold into the "N messages deleted" line that shows them
    (`expandDeletedMessages`), and Reveal and Undelete are in the menu of your own (5b, "Message
    actions"): the placeholder's button takes only its own click, which opens the popover, so the
    menu's hover bar, right-click and long-press are as they were. A long-press (the menu) doesn't
    open the popover;
  - revealed (the user's decisions of 2026-11-20): a deleted message revealed (its content back,
    still deleted: `isRevealedDeleted`) shows its content with a bin in its ticks' place, the old
    desktop's (`TimeAndTicks`), on either side, whose popover says who deleted it and when, as the
    placeholder's (`revealedFields`; who and when are the server's copy's, `deletionOf` over the
    chat's or thread's server events, the client having merged the revealed content over them;
    none where the server's copy isn't deleted yet). It's only peeked at (`peekOffer`, over
    `messageMenu`, which the old trees read and still offer everything on): its menu offers Copy and
    Undelete where `messageMenu` does, and Hide; its hover bar sits beside its bubble, as a
    placeholder's, with "Deleted" before its ⋯ (`barNote`, `deletedMessage.label`); no reactions (the hover bar's, the picker, native's
    quick ones; its own show read only), no reply (the bar's, the menu's, a swipe, a double-click),
    edit, forward, pin, thread, reminder, report or tip, and on native no Info. Hide puts it back
    behind its placeholder on this device (`hideRevealedMessage`: the revealed content dropped, the
    message shown deleted by the server's copy's deleter at its time until the server says so);
    the placeholder then behaves as any (its popover, its Reveal). The bin is on text and media
    messages (`ChatBubble`, `MediaMessage`); a revealed voice message, file, transfer, swap offer,
    poll, prize, proposal or link preview card shows its ticks as before, no bin (their components
    take no `revealed` yet), though its menu is the peek's;
  - translated (5b's Translate): the translation shows in the message's place, as in the old trees
    (the client merges `translationsStore` into the events); there's no mark that it's translated,
    as there wasn't in the old trees. The old desktop's on-device translation of a whole chat (a
    spike, #9709: `autoTranslatableText`, `onDeviceTranslator`, its banner and header item) isn't
    carried over;
  - tips: a chip per token before its reactions, the token's logo and the total (`tipChips`), the
    reader's own marked as their reactions are, who tipped in its tooltip; `ReactionChips` takes
    `tips` by hand (EXPORT-LOG 2026-11-16; the design has none: `TODO(design)`). A token the
    registry doesn't carry has no chip. Where the message offers Tip, a chip opens the tip dialog on
    its token, to tip again (5b, "Message actions"), as the old trees' did; elsewhere it's shown only;
  - reactions: chips under every kind (5b, "Message actions");
  - a reply's quote: at the top of every kind (see Media messages).
- **Relayed messages** (`features/conversation`): a message a bridge bot relayed from Telegram or
  Discord shows as the bot's (`logic/conversation/messageRow.ts` picks the side by `msg.sender`), and so
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
  media, voice, the @mention picker and GIFs came with 5c, the "+" menu's builders with 5d (below).
  The text box is the old trees' rich-text editor (#10576, `core/richText`, through
  `MessageComposer`'s `editor`; the textarea until its chunk is here): markdown shows formatted as
  it's typed, code blocks are highlighted, a mention picked goes in as one and is sent as
  `@UserId`, and pasted formatting is kept, as markdown. Its ":word" emoji list isn't offered (see
  the ledger's `msg-emoji-autocomplete`). The old desktop entry's link-count note ("Link previews are hidden
  for messages with more than 5 links", `excessiveLinksNote`) isn't carried over: it can't show
  any more, since `extractEnabledLinks` stops at the 3 links that get previews
  (`MAX_LINK_PREVIEWS`) so it never counts past 5, and nothing hides a message's previews past 5
  links; the first 3 get them. To drop from the desktop entry too, or to word again (say, "only
  the first 3 links get previews") if the design wants one. In a bot DM, what's typed goes to the bot as its direct-message command
  (its `/` commands are listed as in any chat, below), and a bot that takes no direct messages
  gets the composer's error instead of the old warning. A bot's private (ephemeral) reply isn't shown:
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
  app's native recent-media strip is the native tree's (N15), not this tree's.
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
- **GIFs in the composer** (5c): the emoji picker's GIF tab (web 06) searches Klipy, as the old
  pickers and the native panel do (`GifFeed`, `logic/composer`): Trending (Klipy's featured GIFs)
  as it opens, a category's word, or what's typed, a page at a time as the grid scrolls; a search
  with no match says "No GIFs for …" with Klipy's related terms to search for, or the trending
  GIFs under it (the native panel's decision, kept). A pick isn't sent: it closes the picker and
  becomes the draft's attachment (`attachGif`), in place of anything attached (as a file picked
  is), shown in the media tray with its ×, and goes out with Send like a photo, the text its
  optional caption, as a reply to the draft's reply. That's the user's decision of 2026-11-19,
  against web 06's "Picking sends the GIF" (the old desktop picker let the user add a caption
  first too); the native panel still sends as it's tapped, by design. The tab is there only where
  GIFs may be sent (`giphy`) and something can be attached now (not mid-edit, nor during a voice take, nor
  in a bot DM), and in a build with a Klipy key (`OC_KLIPY_APIKEY`): without one, there's no GIF
  tab. TODO(design): the loading, empty, failed and nothing-found states.
- **Bot commands in the composer** (5c; none of it is in the design: TODO(design)): a "/" at the
  start of the text lists the commands the reader may run here, matched to what's typed, as both
  old selectors do: the client's `BotState` matches them (by name or description, or by name once
  arguments follow), `commandsAvailable` (`@client`, moved out of both old `CommandSelector`s,
  which use it now) keeps those the reader's role, the chat's permissions, what the reader may
  send and the bot's granted permissions allow, only the DM's bot's in a bot DM. The list is the
  composer's own (`MessageComposer`'s `commands`, by hand, EXPORT-LOG 2026-11-16), drawn as its
  mention list: ↑ ↓, Enter or Tab, Esc; the command's parameters by it, the required ones
  filled, and its bot. A pick takes the arguments typed after the name (`CommandPicker`,
  `logic/bots`, on `dateAwareSelection`: a date in words once the date parser is in) and runs the
  command when they're enough (`executeBotCommand`), the text going; else a dialog asks for them
  (`BotCommandDialog`, the old `CommandInstanceBuilder`: a field per parameter it shows, text, a
  number, one of its choices as chips, on or off, someone in the chat, a date and time;
  `logic/bots/commandArgs`; a date in the past for one that wants a future date stays as picked
  and says "You must select a future date" under the field, as the old date input did, and Send
  waits; checked to the minute the field picks, again as it's sent: `dateInPast`), the text staying until it's sent, and staying if the dialog's
  cancelled; the dialog closes if the chat changes under it. A chat's and a thread's composers
  each type and pick their own (each `CommandPicker` keeps its own `BotState`, going by the app's
  bots). Failures toast as the old trees' do (`botCommandFailure`, `@client`: `bots.failed`,
  `bots.tooManyRequests`, which both old trees use now). The built-in bot's commands are offered
  only where this tree carries them out (`carriesOutCommand`): /diamond and /faq (they post), /poll
  and /crypto where the "+" menu offers their builders (the client's `createPoll` and
  `tokenTransfer` open them), /register_webhook (its dialog). Decided (the user, 2026-11-19): /crypto
  opens the transfer dialog empty, whatever is typed after it; the dialog's user field lists only
  the chat's members matching what's typed (`mentionsFor`), where the old one searched every user.
  Not yet:
  - /gif (the GIF picker is the composer's own, with no way in from outside), /search (no search
    in the conversation yet), and the bot developers' and seasonal ones (/register_bot,
    /update_bot, /remove_bot, /witch, /test-msg in development): not offered. Each is offered
    once this tree has the screen it opens (the user's decision of 2026-11-19);
  - a bot's private (ephemeral) reply (above) isn't shown, nor does an external bot's command run
    locally (the local replica has no bots registered; checked with specs and the built-in bot);

  - /register_webhook's description has no words (`bots.register_webhook.desc`), in the old trees
    too.
- **Composer, not yet** (5c, left for later pieces of it):
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
    on it, and × drops it. Anything that would take a staged payment's place asks first (the
    user's decision, 2026-11-19; the old trees replaced it silently): a photo, video or file
    picked, dropped or pasted, a GIF picked, or another payment builder picked from the "+" menu
    or opened by `/crypto` (asked before its dialog opens: the staged one stays until the new one
    is attached, so closing the builder keeps it). A file the chat doesn't take is refused first,
    with the usual toast and no question (`fileAttachStep`), and one it takes is prepared only
    once the answer is Replace; a payment staged while it's prepared (a video's transcode) is
    asked about as it's done, the draft as it is then (`attachPrepared`, the one already agreed
    to not asked about twice). "Replace the prize?" with what takes its place
    (`builders.replace.*`, every locale), Replace or Cancel, which keeps the payment and drops
    what came; one decision for every path (`replaceNeedsConfirm`,
    `logic/composer/replaceStaged`), asked in the dialog host (`replace_staged`,
    `ReplaceStagedDialogScreen`, the plain `ConfirmDialog`, the theme's scrim): Replace hands off
    to the builder in its place over the same backdrop (`DialogStack.handOff` with the `scrim`
    backdrop, which the builder keeps as its own scrim, its swap offer's confirmation too), with no
    back arrow; Cancel, × and the backdrop close it. The design
    has no such confirm (`TODO(design)`). A photo, video, file or GIF replacing another is still
    replaced without asking. One whose token has left the registry has no chip: its send is refused
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
  - Each opens for the composer it's picked from, a chat's or a thread's (4c: the dialogs take
    its `MessageContext`).
  - Not yet: paying from an external wallet (above); the design's "Poll sent · Undo" toast.
- **Replies and edits in the composer** (5b): the draft where the message is (the chat's, or the
  thread's for a message in a thread) holds the message replied to or edited (`replyTo` or
  `setReplyingTo`, and `setEditing`, as in the old trees), and the composer shows it above the
  text (`composerContext`): who wrote it and its text, an edit starting from the message's text
  as the old entries started it (`editStartText`, logic/composer, which both old entries now
  call: each `@UserId(…)` / `@UserGroup(…)` as the `@name` typed, the link-disabled marker taken
  out, a caption for a captioned message, its mentions as typed too; 5c). The quoted text above
  it, an edit's or a reply's, shows its mentions the same way (`quoteText` in
  `logic/conversation/messageRow`, through `mentionsAsTyped` in `@shared`, L2), as the bubbles'
  reply quotes do, where the old trees' Markdown shows them as `@username`. Its X drops a reply,
  or ends an edit; a click on it goes to the message when it's in this chat (a private reply
  quotes another chat's: no jump, where the old UI opened that chat). An edit is saved with
  `editMessage` (failure toast `errorEditingMessage`). Ending an edit, saved or cancelled, puts
  back what the user was writing before it (`endEditing`, kept by `setEditing`; the old trees
  dropped the whole draft, and now get it back too), also when the chat was left mid-edit: the
  composer then mounts with that text to go back to (`composerStartText`; `MessageComposer` takes
  `text` so mounted in edit mode, by hand). Replying to a message mid-edit (its menu, a swipe, a
  double click) ends the edit the same way, its text dropped, and replies from the draft put back
  (`replyTo`, the client's drafts, through `replyToMessage`, given the row's `MessageContext`: a
  reply in a thread leaves the chat's edit alone). A private reply into a DM being edited ends
  that edit too, the reply showing with nothing written, as when nothing was being edited
  (`privateReplyEndsEdit`, after the client's `replyPrivately`, which the old mobile tree calls
  too and which is left as it was: the old trees are left alone, the user's decision of
  2026-11-19). The old trees' replies (`setReplyingTo`) still stay in the edit. Editing mid-reply
  starts the edit, and cancelling it puts the reply back. A reply to a photo, video, GIF or meme
  shows its picture beside the quote, as the old trees' reply strips do (`replyThumb`,
  `logic/composer/composerProps`: a video's first frame with a play glyph,
  `ComposerContext.thumbVideo`, by hand, EXPORT-LOG 2026-11-16; in low bandwidth a photo not
  revealed shows its small thumbnail and a GIF none, as their tiles do, where the old strips
  fetched the full picture). The native composer shows it too. TODO(design): the export's
  thumbnail has no video glyph.
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
  and presets as `DurationChips`). Once set, its toast says when it goes off ("I'll remind you
  today at 14:32", tomorrow, or on a date: `reminderSetText` in `logic/conversation/reminderSet`)
  with View, which opens the OpenChat Bot's DM, where the bot's own "I will remind you about this
  message at …" with Cancel reminder lands (decided 2026-11-19: that message was all the old UIs
  had, and it's easy to miss). The bot's message arrives after `setMessageReminder` returns, so
  its index isn't known: View opens the DM at its latest message as the chat list has it then
  (`reminderConfirmationRoute`), normally that message, never at the DM's first unread (older
  reminders that went off). If it hasn't synced yet, View lands one message short of it.
  Each runs in `features/conversation/messageMenu.ts`. Not yet:
  - **a message's pending reminder isn't marked** (waiting for the user's design round,
    2026-11-19): a small ⏰ on a message with a reminder still to go off, its time in the
    tooltip, and Cancel reminder in that message's menu (today Cancel reminder is only on the
    bot's "I will remind you…" message in its DM). The client keeps no index of pending reminders
    by message: they'd be collected from the OpenChat Bot DM's `message_reminder_created_content`
    messages (each has `remindAt` and `reminderId`, is `hidden` once cancelled, and points at the
    message through its reply context; a `message_reminder_content` with the same `reminderId`
    means it has gone off), which means loading that DM's events, not only its latest;
  - **no list of pending reminders** (waiting for the user's design round, 2026-11-19): somewhere
    to see, and cancel, every reminder still to go off, in the profile or the OpenChat Bot DM's
    header. It needs the same collection from the bot's DM as the marker above;
  - tip (built, 2026-11-23): Tip in the menu (last before the danger items, as the old desktop
    menu) and a tip chip under the message (to tip again in its token) open `TipDialogScreen`, the
    old trees' `TipBuilder` on `TipForm` (`logic/tip`): the token (the one last sent from the menu,
    the chip's own from a chip; any enabled token from `TokenPicker`, in the form's place with a
    back arrow), $0.01 / $0.10 / $1 steps where the token has an exchange rate (each disabled where
    the balance can't cover it), or an amount typed in the token (`TipForm.typeAmount`), what it
    is in dollars and the fee, "not enough" where the balance doesn't cover it with its fees
    (`TipForm.insufficient`, new string `tip.insufficient`), and an empty account's deposit
    address on the IC with Refresh (the old desktop's). Sent with the PIN where the user has one
    (the client's prompt, a small confirm over the dialog). Offered as `messageMenu` decides
    (`tipRecipient` now passed, `messageOffer`): never on the reader's own, an unconfirmed, failed,
    inert or revealed message, nor one with no one to pay (a bot's, a relayed message no one in
    the chat linked), nor without the "tip messages" permission (in a thread too), nor in an app
    store build (`disableTipsFeature`; tips received still show). Not yet, or not the same:
    - TODO(design): the design has no tip dialog (`DialogShell` with the library's `AmountCard`,
      `TokenPicker`, `Banner`) and no tip chip (EXPORT-LOG 2026-11-16, 2026-11-23);
    - paying from an external wallet (the old `SourceWalletSelector`, the approval and its fee):
      not offered, as the "+" builders' isn't ("Composer"); the OpenChat wallet only. `TipForm`
      keeps it (`sourceWallet`, `tip`'s `fromAccount`) for when it has a design;
    - the old dialogs closed on Send and toasted a failure; this one stays open until the tip has
      gone (Send busy), so a PIN prompt given up leaves the tip to send, and a failure (toasted, a
      wrong PIN with the PIN's own message) leaves it to try again, as the web's other paying
      dialogs (Diamond, streak insurance) do. The chip shows the tip at once either way (the
      client's `markTip`);
    - the old dialogs' flying 🤑 on each step, and "Custom tip amount" behind a link (the amount
      is always typeable here), aren't carried over;
    - an empty account shows only its address on the IC (`ReceiveAccount` on `icNetwork`: ckBTC
      for BTC, ckSOL for SOL, ICP for a oneSec token; no minter, no network fee, nothing to
      fetch), named ("Your ckBTC address"). The old `AccountInfo` had a network picker (native
      BTC and SOL, a oneSec token's EVM chains, with their deposit fees) and a QR code; those stay
      in the wallet's Receive;
  - a proposal's collapse waits for the proposals filters (proposals show: 5a, "Proposals in the
    conversation"; the thread's items, reply in thread and follow / unfollow, are 4c's: done);
  - the mobile app's "download media" (native save) is the native tree's (N15), not this tree's;
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
  (`focusEntryOnOpen`, as the old entry), unless a dialog is open. A thread's composer (4c) takes
  focus as the thread opens, the same way.

- **Native apps**: this tree doesn't register the native event listeners or signal `svelteReady`,
  so native builds leave it out whatever `OC_WEB_LAYOUT` says (`webLayoutFlag` in
  `rollup.extras.mjs`, read by both the rollup and the vite builds). The Android app also takes the
  web build over the air, so `selectLayout` keeps the native apps off it at runtime too. This is
  L6's native half, left as it is (PLAN L6): the native apps keep the old UI until the native tree
  (`src/native`, which registers them itself) takes over at N15, so this tree may never need them.
- **Viewport height**: the existing trees keep `--vh` in step with the visual viewport
  (`calculateHeight`) for mobile browsers. Not needed: phones get the old mobile UI until N15 and
  then the native tree (10b).
- **Layout switch** (10b): the web tree is for desktop widths only (the user's decision of
  2026-11-14; the narrow pass was dropped in favour of the native tree at N15). `selectLayout`
  picks a tree by width at load: below 768px the old mobile UI (`v2`, or the old desktop tree's
  narrow mode, `v1`, in a build with `OC_MOBILE_LAYOUT=v1`), and the native tree after N15; at
  768px and up this tree, scrolling sideways below the shell's minimum (919px). A window resized
  across 768px is offered a reload, never re-laid out live: `LayoutSwitchBanner` in
  `logic/layout` (the decision, `layoutSwitchAt` in `utils/layout.ts`, and the dismissal), shown
  by this tree (`shell/LayoutSwitchBanner`), the old mobile tree and the old desktop tree, each in
  its own look. Dismissed, it stays hidden until the window crosses back and then again. Only
  switches to or from a new tree are offered (a build without them behaves as before), never in
  the native apps, and only to a desktop pointer's window (a fine pointer that hovers): a phone
  or a tablet changes width when it's turned, and a phone turned to landscape (844px) must not be
  offered the desktop layout. The tree picked at load stays when a device is turned, as before
  10b, so a phone loaded in landscape still gets this tree (`selectLayout`'s rule, unchanged).
  - TODO(design): no design for the banner. Here the library's `Banner` (its × is `onDismiss`,
    EXPORT-LOG 2026-11-11) floating at the top of the window on the page's surface, over the
    shell and under the dialogs' veil; in the old trees a bar across the top, under their update
    banner (the two stack, the update banner first).
  - **Narrow desktop windows in a build with the native tree** (`OC_NATIVE_LAYOUT=v4`): they stay
    on the desktop site (this tree, scrolling sideways), as decided under #10366, and are offered
    nothing. Whether they should get the native tree instead, now that this tree has no narrow
    layout, is an open question for the user; it stays as it was until they decide. If they move,
    the native tree needs the banner back towards the desktop layout (N15).
  - The native tree (`src/native`) doesn't show the banner: with the rule above it's never
    offered one.
  - **The reload keeps the URL**, so the user lands on the same route in the other tree. From the
    route tables (`utils/routeTable.ts`, `components_mobile/Router.svelte`,
    `components/Router.svelte`):
    - every path the old mobile tree routes, this tree routes too;
    - the chat, community, favourite, `/communities`, `/share` and `/admin` paths are in every
      tree;
    - no equivalent in the old mobile tree: `/wallet/:ledger`, `/wallet/send`, `/wallet/receive`,
      `/wallet/swap` and `/wallet/recipients` (it has `/wallet` only), and the marketing and legal
      pages (`/home`, `/features`, `/roadmap`, `/blog`, `/whitepaper`, `/architecture`, `/faq`,
      `/terms`, `/privacy`, `/guidelines`, `/csea-reporting`, `/diamond`). They fall into its
      legacy `/:chatId/...` route; signed out, it shows its welcome screen for them;
    - no equivalent in the old desktop tree (the narrow one in a `v1` build): `/wallet` and its
      sub-paths, `/notifications`, `/welcome` and `/profile_summary` (ROUTES.md, decision 2);
    - the query-param views (`?threads`, `?profile`, `?panel=activity`, the dialogs' params) are
      this tree's; the old trees ignore them and show the path's screen.
- **Platform operators and moderators** (L6 #10141, `logic/moderation`): what the old desktop
  offers them, and where it is here. Built:
  - **The console hooks** (`window.platformModerator`, `window.platformOperator`): now
    `logic/moderation/consoleHooks`, installed by this tree's App and the old desktop App alike
    (no longer written out in the old App): the moderator's freeze, unfreeze and delete a frozen
    group, hot group exclusions, delete a message (a group's or a channel's), moderation flags,
    message filters (which now say in the console whether they went through), the reported
    messages, unsuspend; the operator's swap providers, upgrade concurrency, a full
    LocalGroupIndex, missed daily claims, the airdrop, Diamond fees, a token on or off, the
    proposals neuron, premium item costs, blocked username patterns, pausing the event loop. The
    mobile and native trees never had them.
  - **Freeze and unfreeze** (`logic/moderation/freeze`, which the old desktop and mobile menus
    and the old desktop preview footer now use too): a group from the conversation header's menu
    (and GroupPanel's ⋯); a community from the chat list's community header menu
    (`ChatListHeader`'s ⋯ in community mode) only. A group preview's header, which has no menu
    otherwise, has one with Freeze / Unfreeze group alone (the old footer's button). No channel
    offers Freeze / Unfreeze community, a member's channel or a preview (the old preview footer
    did, freezing the channel's community): the user's decision (2026-11-12), the community's
    header being the community's own menu. This reverses an earlier review fix that had put it
    back on a channel preview's header. Freezing asks first, from every one of those places
    (`freezeItem` returns `confirm`; `confirm_freeze`, `chats/FreezeDialogScreen`, on the
    shared `ConfirmDialog` that Delete message uses): "Freeze group?" or "Freeze community?"
    (naming the community, whose every channel freezes), saying members can't send messages or
    make changes until it's unfrozen (the backend refuses both while frozen), an optional
    reason, then Cancel or Freeze. The reason is trimmed, blank is none, and it's held to 512
    characters (`freezeReason`; the backend sets no limit, so this is ours, a suspension
    reason's). Its hint says who sees it: a group's goes into the "Chat frozen by …" timeline
    event members see ("Reason: …"); a community's is kept with the community's own events,
    which no screen shows. Unfreezing doesn't ask. The old desktop and mobile menus and the old
    preview footer still freeze at once with no reason (each tree would need its own dialog;
    the console hook takes one). Freeze spins (the library `Button`'s `busy`, by hand) and the
    dialog stays until the backend answers, with nothing dismissing it (Esc, ×, the backdrop,
    Cancel: `ConfirmDialog`'s optional `busy`, which its other uses don't pass);
    `logic/moderation/pendingAction`'s `PendingAction` holds that. A failure says so inline,
    "Couldn't freeze {name}. Try again." (`freeze`), the reason kept, and Freeze works again for
    another try. A success closes it and says so in a toast, "{name} has been frozen", with Undo
    for 5 seconds, as a suspension's (the user's decision, 2026-11-12): Undo unfreezes, as the
    menus' Unfreeze does. Unfreezing doesn't ask and has no dialog, so a toast is all it shows (the
    user's decision, 2026-11-12): "Unfreezing {name}…" with a loader while it runs, then, in the
    same toast, "{name} unfrozen" (gone after 2.5 seconds, no Undo) or "Couldn't unfreeze {name}"
    (which stays until it's closed, as the app's failures do): `unfreeze`, a `PendingToastAction`
    run by `shell/pendingToast` in the library's pending toast ("A pending toast", by hand). A
    preview's timeline may not show the change at once, so the toast is what says it. The old
    trees' menus keep freezing at once (`setFrozen`), the old chat menus toasting only a failure.
    TODO(design): the design has no moderator items, so they're the menus' last, freezing as a
    danger item; nor a freeze confirm (its words, the reason field and its 512 limit are ours,
    `freezeConfirm.*`), nor the freeze, unfreeze or pending toasts (`moderationToast.*`).
  - **Suspend and unsuspend** from a DM's header menu (not a bot's), as the old desktop menu has
    them, besides the user card ("Suspend and unsuspend", 4a): Suspend opens `SuspendUserDialog`;
    Unsuspend, from the menu or the card, lifts it at once, with no dialog, so a toast is all it
    shows (the user's decision, 2026-11-12): "Un-suspending {username}…" with a loader while it
    runs, then, in the same toast, "{username} un-suspended" (no Undo) or "Couldn't un-suspend
    {username}" (`unsuspend` in `logic/moderation/chatModeration`, a `PendingToastAction`, as
    unfreezing's). The old desktop and mobile menus and profile modals keep `unsuspendUser` and
    its old words. The dialog ("Suspend user") names who: their picture over their
    swatch, display name and @username, or their username once without a display name
    (`suspendee`; their user id alone while they're not loaded), then the reason. From the user
    card it takes the card's place over the same backdrop, with a back arrow to it ("Suspend and
    unsuspend", 4a); from the DM's menu it opens on its own. Suspend spins (the library `Button`'s `busy`, by hand) and the
    dialog stays until the backend answers, with nothing dismissing it (Esc, ×, the backdrop,
    Cancel; `PendingAction`, as the freeze confirm). A failure says so inline, "Couldn't suspend
    {username}. Try again." (`suspendUserFailed`), the reason kept, for another try; no toast. A
    suspension goes out as soon as it's confirmed (as in the old trees, which don't defer it
    either); the dialog then closes and says so in a toast, "{username} has been suspended"
    (`suspendUser` in `logic/moderation/chatModeration`, `userSuspended`), with Undo for 5
    seconds (native's undo toasts' time): Undo lifts it in the pending toast above
    (`unsuspend`). The toast is the library's undo toast through the app's toast host
    (`getToastHost`, `getPendingToastHost`), which outlasts the dialog. The old desktop and mobile trees still
    close their dialog with no toast. The DM header's "Account suspended" now follows a
    suspension or its Undo at once: the client's `userStore.userSuspended` replaces the user's
    summary instead of changing it in place, which the header's `$derived` user didn't see.
    TODO(design): no suspend dialog, busy button, suspend or pending toast in the design; naming
    the user in a member row under the title is ours.
  - **`/admin`** (L6b #10609, `features/admin`): someone who isn't a platform operator gets the
    old page's refusal ("Unauthorised", Back to safety) and an empty list column; an operator
    gets **the operator console**, laid out from the Claude Design canvas "Admin Console"
    (2026-11-26) in the app shell as the wallet is: its sections in the list column
    (`AdminPanelScreen`, the library's `SectionNav`: Review, Operator functions, Content,
    Compliance), the open one in the main pane at `/admin/:section` (`AdminScreen`; `/admin`
    alone opens Pending proposals). Pending proposals' and Authority reports' rows say what needs
    a person (awaiting you, yours; overdue, due soon, filed) with a count, from
    `logic/admin/adminSections`. The state of both screens is one `AdminConsole`
    (`features/admin/adminConsole.svelte`), made as the console opens and dropped as it closes,
    on the `logic/admin` classes the old console runs on too. Every operator function is a
    `SettingsCard` (fields from `TextInput` and `SelectInput`, 44px, checked as they're typed by
    `logic/admin/fieldChecks`) whose footer says how its last action went (`FormOutcomes`), in
    place of the old toasts and the error line under the tab; a proposal that went through says
    "proposed", never a success. A single switch (native call push, the daily puzzle) sits on its
    card's title line and applies as it's flipped. The danger zone shows each setting's value now
    beside the proposed one (`CompareRow`); destroying evidence asks for the report index to be
    typed, and clearing a legal hold and confirming a proposal ask first (`ConfirmDialog`). Tables
    are `DataTable` (the reports, the corrections, the vault log), with loading, empty and failed
    states. Confirming or rejecting a proposal, and a correction's approve or reject failing, are
    still toasts: the card or row leaves the list. Words are English only, as the old console's.
    Not there: a proposal's current and proposed values (the canister gives only a summary), a
    danger card's note of its own pending proposal (nothing ties a proposal to its setting but the
    summary's words), Undo (nothing here can be undone), the corrections' count in the list (they
    load only as the section opens, switching locales), and stopping a correction's preview (the
    client has no call for it). The old main menu's Admin item is at the rail's foot (#10630, merged).
  Built since (the old desktop had the only ones):
  - **Report review** (built, L6c #10610, `features/moderation`): the moderation channel's
    report cards, ported plainly on library parts (the user's decision, 2026-11-12), drawn in
    the conversation through `MessageGroup`'s `customContent` (by hand, EXPORT-LOG 2026-11-25;
    `messageRow` maps both kinds to `kind: 'custom'`, keyed by the content's kind).
    `ModerationReportCard` (`moderation_report_content`) is the old desktop card's layout and
    words, which are the fuller (the resolution's "sanction stands / reversed" lines; mobile has
    a shorter "Upheld by …"): the verdicts (Uphold, CSAM with the urgent flag, Dismiss, once at a
    time, a refusal's reason inline), the review-before-verdict gate, media review
    (`vault_media`, the shared `VaultMediaReview`), the access log (`vault_access_log`), NCA
    filing or recording one (`nca_filing`), copying the hashes, the checklist link
    (`/csea-reporting`, in a new tab) and an operator clearing a stale filing attempt.
    `ReportedMessageCard` (`reported_message_content`): one report at a time, a numbered button
    for each, how many of all. Their logic, extracted from the old cards, which use it too and
    behave as before: `logic/moderation`'s `moderationReport` (what the card shows and who may
    act), `ModerationReportCard` (the card's state: a verdict, a filing just recorded or started,
    clearing an attempt, copying hashes), `NcaFilingForm`, `VaultAccessLog` and `reportedMessage`.
    The three dialogs are local dialogs, each on its own (none opens another), so none has a
    back arrow; ×, the backdrop and Esc close them, as the old overlays. As in the old trees,
    a verdict doesn't ask first. New string: `report.notes` (a report's notes' label; the old
    card showed the untranslated "Notes"). Left:
    - the cards show to whoever reads the channel, as in the old trees; only a platform
      moderator (or operator) gets the actions;
    - a card scrolled out of the list and back (the list is virtual) starts afresh, as an old
      card did when remounted: a verdict under way still lands, but its spinner, an unreviewed
      gate's state and a filing just started from it aren't kept; the dialogs it opened stay up
      and still report back to it while it's gone;
    - native: `src/native`'s conversation passes no `customContent`, so both kinds show their
      words ("Moderation report") in a text bubble, as before: moderators work from a desktop.
      Native can draw them the same way, with the same logic, if they're wanted there.
    TODO(design): no report cards or their dialogs in the design.
  - **The old main menu's Admin item** (operators only): done, TODO(design), web only. An Admin
    destination (shield icon) at the NavRail's foot, above CHIT, for a platform operator
    (`platformOperatorStore`; not a group's or community's admins, nor a guest), through
    `NavRail`'s `footItems` (`rail.adapter`'s `railFootItems`); it goes to `/admin` and has the
    rail's highlight while the console is open, as the wallet's does. Considered first and dropped:
    a row in the profile dialog's rail (the console is a place in the app, not part of your
    profile; the user's decision, 2026-11-27). New string: `adminConsole` (the old item's "Admin"
    was literal text). Not there: a badge for what needs a person (a proposal awaiting you, an
    overdue report), which would mean loading both in the background for operators. No rail foot
    destination or icon for it in the design. Web only (the user's decision, 2026-11-26).
  - **The native half**: `src/native` has none of the above (nor did components_mobile have
    the console hooks or the console); not needed while native builds keep the old UI (PLAN L6).
    The native apps' event listeners and `svelteReady` are "Native apps" (above).
- **Right column host** (`features/app/DetailsColumn.svelte`, S1): the invites and proposal
  filters entries are still placeholders; the user profile, explore's filters and the call participants entries wait on
  8c, 8a and 7b. With nothing in `rightPanelHistory` the column shows the selected chat's details
  (the old docked panel showed nothing), and a new panel opens a closed column. Not carried over:
  dragging the column wider (the old panel's `Resizable`; the design's widths are fixed) and the
  halloween theme's cobweb.
- **Threads** (4c: `features/thread`, the conversation's `MessageArea`): the open thread in the
  right column (`ThreadPanel`) and the list of threads (`?threads`, `ThreadList`). Left, or not
  as the old trees have it:
  - **The root shows once, as the panel's card** (decided): the list of replies starts with the
    first reply, under the card, as the design has it (`threadReplyEvents`, 4c invariant 3). The
    old lists head the replies with the root once they're loaded back to the first one
    (`threadTimelineEvents`, unchanged), where it can be reacted to, opened in the menu, voted in;
    here those are done on the root in the conversation. Like the conversation, the list sits at
    the bottom of the panel while it's shorter than the panel (the list's `column-reverse`).
  - **Opening a thread shows the right column**, docked or as the modal, even when the user had
    closed it; closing the thread puts the column back as the user had it (`columnChange`,
    `RightColumnState.showThread`). The old desktop's thread replaced its right panel's history, so
    its panel went with it. Clicking the open thread's "N replies" (or its row in the list) after
    closing the column over it shows it again (`openThreadInColumn`).
  - **Follow / Following** shows a spinner and takes no click while the call is in flight, then
    the new state (`Waited`); a failure toasts and leaves it as it was. The old buttons flipped at
    once.
  - **A cold load of `/:mi?open=true` on a message with no thread yet** (a "Reply in thread" link
    shared before anyone replied) shows an empty right column: the client opens a thread on a cold
    load only for a message that has one (`ChatEventList`), as in the old trees, where the panel
    stayed closed. Starting one from the menu works.
  - **No root**: while the root is gone from the chat's events (the event window replaced) the
    column shows nothing (`rightPanelView`), where the old desktop panel showed a spinner.
  - **No "Mark all as read"** (decided, not built): a ⋯ menu in the list of threads' header with
    one item, "Mark all as read". Opening a thread reads it, as now.
  - **The list of threads has no per-thread actions**: `ThreadList`'s rows have no unfollow (the
    old desktop card's eye) or mark-as-read (the mobile card's menu), and show no latest replies, so
    a row never marks its thread read on sight (`threadReadOnSight`, which the old cards use, needs
    the replies on screen, 4c invariant 6): opening the thread reads it. Unfollowing is in the
    open thread (Following) and in a message's menu. The library needs both actions on a row.
  - **No loading state in `ThreadList`**: the first load shows a spinner in place of the whole list
    (`TODO(design)`); a reload keeps the list up (the old lists' `initialised` was a const false,
    so theirs went to a spinner on every reload: fixed in `logic/threads/threadPreviews`).
  - **No group avatars in the list**: a chat's mark and a root author's face are swatches
    (`swatchFor`, see Swatches); `followOnly` (followed without replying) isn't known to the client.
  - **The unread threads count** on the chat list's "Thread replies" (L1, see "Chat list"): the
    route scope's, as the old mobile list's subtitle counts them; the entry shows only where
    there are followed threads.
  - **Typing**: who's typing in the thread shows over its composer (`ComposerBar`), as in a
    group's conversation (a DM's thread too: `typingPlacement`), not in the panel's header as the
    old header had it.
  - **Mobile's "peek"**: the old mobile list opened a thread without changing the route; here it's
    always the root's own URL with `?threads` kept (ROUTES.md, decision 2), as the old desktop.
  - **Tipping in a thread** goes by the "tip messages" permission, as the conversation's does
    (5b, "Message actions"). Calls: closing a thread doesn't tell the call it's
    closed yet (`TODO(phase 7)`, the old panel's `activeVideoCall.threadOpen(false)`).
  - **Unfollowing the last followed thread** with the list open goes back to the chat list (no
    threads left), as the old desktop list does.
- **Bot builder**: no screen yet. When it's built, its owner picker offers `botOwnerCandidates`
  (you, then the users you have direct chats with), as both old `AutoBotBuilder`s do.
