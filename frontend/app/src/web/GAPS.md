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
- **Built-in fallbacks** that should come from the app: Diamond limits and feature matrix (`DiamondDialog`), storage caps and about URLs
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
- **`ProfileDialog`, by hand** (8c, to go back to the design export): `sections`, the sections
  its nav offers (a host that has built only some); the cover and photo edit buttons only with
  `onCoverEdit` / `onPhotoEdit`; `engagement` counts as numbers; `memberSince` from `joined` in the
  host's locale; a chats & calls toggle the host didn't take goes back; the cover and photo edit
  buttons keep their surface on hover (the design's hover tint alone let the image show through);
  `qrCode`, the invite's QR code drawn by the host (the dialog's own needs a global `qrcode`
  library); the storage section's "report a problem" row only with `onReportIssue`; the storage
  meter only with an allowance above 0; `aboutPages`, the About pages the host has; an empty
  communities section says so; "Just linked" only for a sign-in method linked in the dialog, and no empty "last used"
  line; the delete flow's CHIT step for a user who has never earned any says they haven't
  discovered it yet; a host step in the sign-in "add" form that rejects with `{ reason }` shows
  that reason in place of the generic one (linking a method says why it couldn't, e.g. the
  sign-in provider limit), and one that rejects with `{ cancelled: true }` says nothing (closing
  the confirming sign-in); Diamond opens from it without its exit (`DialogFlow.handOff`), so the
  backdrop stays while the next dialog animates in (`DialogScreen` keeps it); the CHIT claim day
  does nothing without `onChit` (the app's `onChit` opens the CHIT dialog);
  `puzzleSetting`, so a host without a daily puzzle setting leaves it out; "Ways to earn more"
  only with `onEarn`; `onClaim`, the calendar's Claim made in place with a "Claiming…" state; a
  day before `joined` isn't a missed one.
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
  - CHIT: the calendar shows the daily claims (and insured or reinstated days), not the old
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
  - the community header's Edit, Invite and new channel items, and the conversation header's
    Invite, Convert, Import and webhook items, come with 4b's later parts.

- **Group and channel settings** (4b part 2a): GroupPanel's Settings opens `GroupSettingsDialog`
  on `UpdateGroupState` (`features/group/GroupSettingsDialogScreen.svelte`, through
  `settings.adapter.ts`). Someone who can't edit the chat gets its About page instead
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
  - the About page opens on its own until the Manage frame lands in part 3. Its rules link does
    nothing.
  - with edit rights, GroupPanel's menu also shows Convert, Import and the new channel items.
    They do nothing until parts 4 and 5.

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

- **`ChitDialog`, by hand** (8d): the default milestone tiers keep their hand-spaced positions
  when a host passes them; a claim made in the dialog clears once the next claim opens; `onClaim`
  resolving `false` is nothing claimed (claimed already), and plays no claim.
- **CHIT dialog** (`features/chit`, 8d): the streak, today's claim, the balance, the insurance
  summary, the settings (the profile's CHIT section), the leaderboard (`?hof`) and the ways to
  earn (`AchievementsDialog`, over the CHIT dialog: there's no URL for it). Not yet: the daily
  puzzle (the card is left out) and buying streak insurance, whose row does nothing yet: the
  rest of 8d. A claim that fails shows the dialog's own error, where the old modal toasted and
  closed; an already claimed day just moves the countdown on, as the old desktop modal does.
- **Leaderboard** (`?hof`): this month's, last month's and all time's top 10, as the old hall of
  fame shows them, without its Invaders game.
- **Ways to earn** (`AchievementsDialog`): the old "Learn to earn" list (`achievementList`). The
  dialog's groups and its "next up" bands are the app's (`chit.adapter.ts`: each achievement
  given a group; quick up to 1,000 CHIT, middling up to 3,000, big above), not anything the old
  UI had; no achievement has an icon of its own (the old UI had none).
- **Achievement toast** (`AchievementToast`, for the client's `chitEarned`): only with the popup
  setting on (`chitPopup`) and CHIT on, as the old earned popup; it names the first achievement
  when several come at once (with the CHIT for them all), and the longest streak gets the flame
  icon, where the old popup shook the page and played longer. It marks them seen as it shows,
  as the old popup did, so with the popup off they aren't marked.
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
  link previews, translations, tips, the message menu, reactions and swipes (phase 5) aren't
  wired. Events other than messages show as a centred line in the old UI's words, names in bold
  (`logic/conversation/timelineEventText`, shared with the old trees; no design for them:
  `TODO(design)`), and "N messages deleted" expands them. The old lines' date and time under each
  event isn't shown yet (it's duplicated in both old `NonMessageEvent`s, to extract). The header has no back button (`ConversationHeader` has
  none; narrow layouts don't show the shell yet), no last-seen line for a DM, and its menu does
  favourite, mute and copy link only: the rest open dialogs (phase 4), and calls are phase 7. The
  old list's go-to-mention button and sticky date aren't carried over; it keeps go-to-latest.
  Own messages show no name (the design's "You" would be the lower-case app string).
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
- **Composer, first cut** (`features/conversation/Composer.svelte`, phase 3c): text only.
  Attachments, GIFs, voice, replies, edits and the "+" menu are phase 5 (`MessageComposer` hides
  "+" and the GIF tab without their handlers). There's no @mention picker (typed @usernames are
  still sent as mentions), no rich-text editor (the old one showed markdown as it was typed) and
  no link-count warning. In a bot DM, what's typed goes to the bot as its direct-message command,
  but there's no `/` command selector, and a bot that takes no direct messages gets the
  composer's error instead of the old warning. A bot's private (ephemeral) reply isn't shown:
  nothing here subscribes to `ephemeralMessage`, so it's dropped. The old trees show it above the
  composer for a minute, or until it's closed, paused while the app is hidden. A chat's rules are asked for in a plain dialog
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
- **Bot builder**: no screen yet. When it's built, its owner picker offers `botOwnerCandidates`
  (you, then the users you have direct chats with), as both old `AutoBotBuilder`s do.
