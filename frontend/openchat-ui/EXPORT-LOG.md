# Export log

## 2026-10-07 — pass 1: library + docs
- Exported 53 library components, tokens, icon set (142), a11y + tooltip behaviours, docs page.
- Target: Svelte 5 + Vite + TypeScript, scoped CSS on token variables. Package `@openchat/ui`.
- Hand-edited after conversion: Spinner, MemberRow.
- Known gaps: hand-built app modals have no accessible name (app, pass 2); build/type check not yet run.

## 2026-10-13 — pass 2: library update + app components
- Library: 27 exported. Updated: CallEvent, ChatBubble, ChatRow, ComposerBar, MessageGroup, TransactionRow, VoiceMessage. New: AvatarStack, Confetti, Countdown, EmojiPicker, FileMessage, LinkPreview, MediaMessage, MessageActions, MessageComposer, PollMessage, PrizeMessage, ProposalMessage, RequirementChip, RoundIconButton, SnapFloat, SortableInputList, SwapOffer, ThresholdBar, TransferMessage, Waveform.
- Retired: Composer (replaced by MessageComposer).
- App (new, `src/app/components`): 56 — AccessGates, AccessGatesCards, AchievementToast, AchievementsDialog, ActivityPanel, AuthDialog, BalanceCard, BotDialog, CallPanel, ChatListHeader, ChatListPanel, ChitDialog, ConversationHeader, ConvertToCommunityDialog, CreateGroupDialog, DailyPuzzleCard, DeleteGroupDialog, DiamondDialog, DmChatSettings, DmPanel, ExploreCommunities, GroupPanel, GroupSettingsDialog, GroupStats, ImportToCommunityDialog, InfoPanel, InviteDialog, JoinGateDialog, LeaderboardDialog, LeaveGroupDialog, MemeFighterDialog, MiniCall, NavRail, NewChannelDialog, PollBuilderDialog, PrizeBuilderDialog, ProfileDialog, PuzzleDialog, SendCryptoDialog, StreakInsuranceDialog, SwapOfferDialog, ThreadList, ThreadPanel, TokenCoin, UpgradeBanner, UserDialog, UserGroupDialog, VideoTile, WalletMain, WalletPanel, WalletReceive, WalletRecipients, WalletSend, WalletSettingsDialog, WalletSwap, WebhookDialog.
- Hand-edited: CallEvent, MiniCall, TokenCoin (createElement / React hook → markup). Converter: prototype `export/tools/dc2svelte.js`.
- Docs: Library / App tabs; every *Dialog opens from a button. global.css +36 rules/keyframes.
- Not verified with build / svelte-check yet. App shell not exported.
- Re-exported ChitDialog (prototype fix), DailyPuzzleCard, MiniCall (props metadata now parsed).

## 2026-10-13 — hand conversion to plain Svelte 5
- All 129 components (73 library, 56 app) converted from `.logic.js` + `useLogic` to plain Svelte 5: typed `$props()`, runes, scoped CSS. `src/lib/dc/` removed.
- Demo fallbacks dropped (props that only had made-up demo values are now required); demo data lives in `src/docs/samples.ts`.
- Shared prop types in `src/lib/types.ts`. `meta.json` prop lists regenerated from each component's `Props` (with `required`, real default and doc).
- Verified against the export with a pixel diff of every docs demo (both themes) and scripted interaction comparisons; intended changes are listed in the git history.
- Do not re-export: port prototype changes by hand.

## 2026-10-15 — pass 3, ported by hand
- Library: ProgressTimeline (flat always-visible `steps`, `funds` line, "Step N of M" bar with `elapsed`; legacy `phases` still accepted; `collapseDone` removed), SideCard (`fill`).
- WalletSwap: Details → Swap, one column, ICPSwap only (`dexes` removed), manual quote with refresh/expiry, progress on the new timeline. Shows the app's real 3 swap steps (approve → swap → withdraw; `onStep(0..2)`), not the prototype's 5.
- WalletSend: Details → Send, one column with summary rows, PIN dialog, then a Sending → Sent receipt. `onSent` is still the transfer (made at PIN submit); new `onDone({ request, result, openChat })` fires from Done / Back / View in chat. `WalletToken.inputDp` caps typed decimals.
- WalletReceive: one column, address card with the QR; Copy QR as image is real (`copyImage` in `lib/clipboard.ts`, hidden where the browser can't copy images).
- WalletMain: token page summary card, 700px column; a token click opens its page from any idle flow (not while a send or swap is waiting on the host); a send lands on the token page from WalletSend's `onDone`.
- Kept from the hardened components: amount helpers (comma decimals, exact Max, unit comparisons), swap fee model, CopyButton/copyText, DialogFlow, host-driven data. Not ported: the prototype's demo data, fake clipboard/PIN, and old amount bugs.

## 2026-10-15 — pages, ported by hand
- New `src/pages`: Landing and Learn, from the prototype's pages export. Plain Svelte 5 (no `lib/dc` runtime or `.logic.js`), scoped CSS, colours from tokens only (no hex fallbacks), every UI string an `ui.landing.*` / `ui.learn.*` key.
- Host contract: route props (`homeHref`, `appHref`, `exploreHref`, `learnHref`, `learnPageHref`) and `auth` (AuthDialog's callbacks). A successful method or sign-up closes the dialog and calls `onEnterApp` (else goes to `appHref`); a result that arrives after the dialog closed does nothing. Nothing fakes a sign-in: the prototype's timed auto-enter is gone.
- Landing: featured `communities`, the Android build links and the proposals link are props (no link without them). The header's mode / accent controls override the props until the host passes new ones, and report through `onModeChange` / `onAccentChange`. The hero backdrop lives in `heroBackground.ts` (theme colours read from CSS, paused off-screen, one still frame under reduced motion). The product shot uses the library Avatar.
- Learn: content in `learnContent.ts` (`LearnContent`: docs, posts with slugs, roadmap items `{ title, status, … detail }`, FAQ groups of `{ q, a }`). The sub-page comes from `page` / `post` when the host routes its own paths (`onNavigate` takes the clicks), else from the hash (`#faq`, `#blog/<slug>`; back / forward follow it).
- Library: icons `moon`, `smartphone`, `sun` (icons.css regenerated). Not ported: the export's global `a` rule and its `data-lp-*` / `data-learn-*` global layout rules (scoped inside the pages instead).

## 2026-10-16 — rail width tokens, by hand
- `--rail-collapsed` / `--rail-expanded` were 76px / 282px while `NavRail` drew 60px / 283px with literals. The tokens now hold what the rail draws, and `NavRail` reads them, so a host that sizes the rail's slot (the app shell) can use the same token.
- NavRail: the active bar's measurement waits a tick, so a rail unmounted in between (the app leaving the shell for a full page) no longer throws on its missing root.

## 2026-10-16 — sign-in for the app, by hand
- AuthDialog: `methods` (the ways in on offer: the app narrows them with `?auth=` and for browsers without WebAuthn); `wallets`, a wallet step for Ethereum / Solana that passes the picked wallet's id to `onMethod`; "Check your inbox" shows the code `onRequestEmailLink` resolves with (`EmailLinkSent`); `kind: 'link'`, the page an emailed link opens, which takes that 3-digit code and reports `onLinkCode`'s `EmailLinkResult` (signed in here, signed in elsewhere, expired, invalid). New `ui.authDialog.*` copy for these.
- AuthDialog, from the old sign-in UI: a host call can reject with `AuthFailure` (`{ reason }`) to say why, shown in place of the generic line (a taken username …); `email` prefills the sign-in field, and sign-up's recovery email is now a field of its own; `referrer` prefills sign-up's referrer (removable); `methods` also orders the other methods; `onCancelEmailLink` when the person leaves "Check your inbox".
- Landing and Learn: `signedIn` puts Open app (to `appHref`, or `onEnterApp`) in place of Sign in / Create account, and of Landing's closing Create account. `PageAuth` passes `methods`, `wallets`, `email`, `referrer`, `onCancelEmailLink` and the wallet id through.
- None of this was designed: to go back to the design export (the app's `GAPS.md` lists it).
- Review fixes: a new `kind` from the host starts that mode from its first step (a wallet list or "Check your inbox" no longer shows under Create account), and only a new value counts, so a host spreading its props doesn't undo the person's own switch to sign-up; switching mode from "Check your inbox" calls `onCancelEmailLink`; a `referrer` the host passes after the person picked or removed one leaves their choice alone. Landing and Learn's Open app click lives in `PageAuthState.openApp`.
- More review fixes: "Check your inbox" shows a failed resend (the link sent before still works); `onCancelEmailLink` also fires when the host unmounts the dialog or changes its `kind` while it's on "Check your inbox". `PageAuth.onClose` hears the person closing the pages' dialog (not the close that follows a sign-in), so the host can stop what it had going.
- Fourth review: `passkeySignup` (default true) turns off "Create an account" from sign-in when the host has no passkey on offer (no WebAuthn, or `?auth=` without it), and `PageAuth` passes it, opening Landing / Learn's Create account as sign-in then; `wallets` can be a function that loads a method's list when it's picked (the app's Ethereum wallets, wagmi's configured and announced connectors); closing on "Check your inbox" leaves that step, so unmounting doesn't stop the link a second time.
- Fifth review: `PageAuth.onOpen`, heard as the pages' dialog opens (before it shows), so the host reads what it shows then (the last method used, the prefilled email, the referrer) rather than on every visit.

## 2026-10-19 — Learn content, by hand
- Learn's content text may use a small markdown subset (`inlineMarkdown.ts`): links, `**bold**` and `` `code` `` in paragraphs, list items, roadmap details and FAQ answers, and a blog paragraph that is only `![alt](src)` shows as an image. They render as elements, never HTML; a link that isn't web, mail or the host's own path is its text. FAQ search matches the text without the markup.
- FAQ answers split into paragraphs on blank lines and keep line breaks; an untitled FAQ group has no heading; FAQ items can carry an `id`.
- New props: `section` (scroll to a doc section), `question` (open and scroll to an FAQ item), `architecture` (a snippet the Architecture tab shows in place of a doc, filling the screen between the header and the footer, inset only for its rounded corners). `learnPagesOf` takes the doc pages the host gives itself.
- A doc's sections can be nested (`depth` on `LearnDocSection`; `docOutline` numbers them 01, 2.1, 3.4.1). The contents list shows the top level, with a toggle on a section that has sub-sections: the ones on the way to the section being read open by themselves and close as the reader moves on, one opened by hand stays open until closed, and one closed while being read stays closed until the reader moves on (`TocOpen`). The list scrolls on its own, and sub-sections grow open and shrink closed on the duration and easing tokens; sub-section headings are `h3`.
- None of this was designed: to go back to the design export (the app's `GAPS.md` lists it).

## 2026-10-19 — Landing's section links glide, by hand
- Landing's header links to its sections (`#landing-features` …) and the hero's native app link scroll smoothly to their section (`scroll-behavior: smooth` on the document while Landing shows), unless motion is reduced. A host's own scroll that should stay instant asks for `behavior: 'instant'` (`'auto'` follows the page's smooth scrolling).
- Landing's header stays at the top while the page scrolls: the page clips its horizontal overflow (`overflow-x: clip`) rather than hiding it, which made the page its own scroll container and left the sticky header nothing to stick to.
- Landing's "Browse all communities" sits at the far end of the Communities heading row (`margin-inline-start: auto`), where the heading's `max-width` had left it beside the heading.

## 2026-10-19 — Learn review fixes, by hand
- A link in Learn's content to the page exactly as it shows (the same `?section=` or `?q=` again, after reading on) follows its deep link again (`sameLocation`): the host's props don't change, so nothing else would scroll.
- The contents list opens sections by itself only beside the doc; below 860px, where it sits above the doc, only the reader opens it, and it has no scroll box of its own. A section the reader closed opens again when they come to it (`TocOpen`), and an unchanged reading path updates nothing.
- FAQ answers take an image paragraph (`![alt](src)`) as posts do. FAQ search leaves image paragraphs out (`searchText`).
- Deep links scroll with `behavior: 'instant'`.

## 2026-10-20 — the floating rail's width, by hand
- Tokens: `--rail-floating: 320px`, the expanded nav rail's width while it floats over the app's island (below 1876px, Fix Brief - App Shell Layout). Pushing the layout, it is `--rail-expanded` (283px) as before. The app's shell sets `--rail-expanded` to it while the rail floats, as NavRail reads `--rail-expanded`.
- Not in the design export: to go back to it (the app's `GAPS.md` lists it).

## 2026-10-20 — messages for the app's conversation, by hand
- `GroupMessage` takes an optional `id`: `MessageGroup` keys its rows by it (a message keeps its row when messages are added before it) and writes it to the row's `data-msg`. The callbacks are still by index.
- `ChatBubble` takes a `body` snippet, shown in place of `text`: the host renders the text itself (the app's markdown, mentions, links, custom emoji). `text` still sizes emoji-only messages. The body's root, and a paragraph that closes it, flow inline so the time stamp stays on the last line (a body ending in a list keeps the stamp's measured room at the end of its last item instead; one ending in a code block still puts it on a line of its own, as the block's text ends in a line break).
- `MessageGroup` takes `avatarSpace` (with `showAvatar` off, keeps the avatar's space) and `endsRun` (off: the last message isn't the end of the sender's run, so it doesn't get the last-in-group shape), for a host that renders a sender's run as several groups (the app's list renders one message per row).
- Not in the design export: to go back to it (the app's `GAPS.md` lists them).

## 2026-10-20 — the rail's local pick, by hand
- `NavRail` drops the item a click picked when the host's `items` change, not only when `activeIndex` does: a host that shows a different set of items (the app hides Favourites without favourites) moves their indexes, and the old pick could point past the end, leaving no item active.

## 2026-10-20 — ActivityPanel's back button, by hand
- `ActivityPanel` takes `onBack`: a back button beside its title, for a host that opens the panel over another page (the app's `?panel=activity`, ROUTES.md decision 7). Hidden without it.
- `ActivityPanel`'s tab badges count the tab's new (unread) activity, and show none at zero; they counted every item, so read activity kept a badge. Its empty state no longer shows under the loading skeleton.
- `ActivityPanel`'s All tab, empty, said "No payments" (the Payments tab's words). It has its own now: `ui.activityPanel.noActivity` / `noActivityBody`.
- Not in the design export: to go back to it (the app's `GAPS.md` lists it).

## 2026-10-20 — the composer's draft, by hand
- `MessageComposer` takes `text`, the draft to start from (read when it mounts; a host keys it to start another), and `onInput`, the draft as it changes while it's being written (typed, an emoji picked, cleared on send; not while editing). `ComposerBar` passes both through.
- `MessageComposer` takes `enterSends` (default on): off, Enter adds a line and Ctrl/⌘+Enter sends, for a host with an Enter-to-send setting. `ComposerBar` passes it through. A draft the composer starts from (`text`) takes its height on mount, as typed text does.
- `MessageComposer` shows "+" only with `onAttach`, and the GIF tab only with `onGif` (as the mic only shows with `onVoice`), so a host that doesn't take them has no dead controls. The docs' demo states still show them.
- Not in the design export: to go back to it (the app's `GAPS.md` lists them).

## 2026-10-21 — the rail tells the host it was toggled, by hand
- `NavRail` takes `onExpandedChange`, called when the user expands or collapses it with its toggle (not when a floating rail closes itself on a pick or a click elsewhere), so a host can remember the choice. The app keeps it across visits where the rail pushes the layout.
- `NavRail` takes `floating`, the host saying whether the expanded rail floats. Without it the rail measures its slot, which reads as floating for the moment a pushing rail is still widening, so a click then closed it (and a remembered "expanded" no longer matched). Its collapse toggle now works with Enter and Space too.
- Not in the design export: to go back to it (the app's `GAPS.md` lists it).

## 2026-10-21 — the app's virtual lists move in, by hand
- `VirtualList` and `VirtualChatList` (with `virtualListUtils` and the `vclDebug` scroll diagnostics) moved here from the app's `components_shared`, unchanged apart from what tied them to the app. They live in `src/lib/virtual`, not `components`: they have no look and no docs demo.
- `VirtualChatList` requires `iOS` (the host's platform check, which turns on touch tracking and its own momentum handling) and `onRowError` (a row threw while rendering). The app passed neither before; it read them from its own modules.
- `VirtualList` uses `$effect` where the app used its development-only `trackedEffect` loop warning.
- Not in the design export.

## 2026-10-21 — token fallbacks removed, by hand
- Every `var(--token, #…)` fallback for a token `tokens.css` defines on `:root` is gone (3,813 of them). They never rendered: both hosts load `tokens.css`, and the light theme only overrides tokens. They were the export's copies of the values, already drifting. A docs pixel diff in dark/pink, light/pink and dark/blue showed no change.
- Fallbacks on names `tokens.css` doesn't define (`--overlay-3`, `--surface-3`, `--status-error`, `--ink-5`, `--oc-veil`, …) stay: they are what renders.
- `src/lib/styles/tokens.spec.ts` fails if a fallback for a defined token comes back.

## 2026-10-21 — one dialog veil and layer, by hand
- The 18 hand-built dialogs that each copied the same veil (blur, `oc-veil-in`, `oc-veil-out` while closing) use `.oc-veil` from `global.css`; 17 of them use `.oc-dialog-layer` for the fixed, centred layer that stops catching clicks while closing, and keep only their `z-index`. Pixel-identical in the docs, dark and light. `GroupSettingsDialog`, `InviteDialog` and `DialogShell` have veils of their own and are unchanged.

## 2026-10-21 — sign-up asks for the terms to be agreed to, by hand
- `AuthDialog`'s sign-up has an "I agree to the terms and conditions" checkbox (`ui.authDialog.termsAgree`, the link as before), in place of "By creating an account you agree to…". Continue stays disabled until it's ticked, and `SignupDetails.termsAccepted` says it was. Every OpenChat tree now requires it, as the mobile app did.
- Not in the design export: to go back to it.

## 2026-10-22 — DialogShell opens animated, by hand
- `DialogShell` fades its veil in (`oc-veil-in`) and lifts its card in (`oc-dlg-in`), with the hand-built dialogs' durations and easing. It had no animation, so dialogs built on it (`ChatPicker`, the app's) popped in while the hand-built ones rose. It still has no closing animation: it unmounts as soon as its host closes it.
- Not in the design export: to go back to it (the app's `GAPS.md` lists it).

## 2026-10-22 — the composer can take focus as it mounts, by hand
- `MessageComposer` takes `autofocus` (default off): its text box takes focus when it mounts, without scrolling, unless a dialog (`aria-modal`) is open, which keeps it. `ComposerBar` passes it through. The app keys the composer per chat and turns it on where the old UI focuses its entry on opening a chat (992px and up, not on touch-only devices).
- Not in the design export: to go back to it (the app's `GAPS.md` lists it).

## 2026-10-22 — ProfileDialog: the sections a host offers, edit buttons with their callbacks, by hand
- `ProfileDialog` takes `sections`, the sections its nav offers (default: all), so a host can open it with only the ones it has built. A section it doesn't offer is never shown: the nav leaves it out (and a group left with none), and the links to it (the CHIT tag) do nothing.
- The cover and photo edit buttons show only with `onCoverEdit` / `onPhotoEdit`, as the header says of every action ("Actions whose callback is absent are hidden").
- `engagement` counts may be numbers, shown in the host's locale like the other figures.
- `memberSince` is optional: without it, the profile shows the date of `joined` in the host's locale.
- A chats & calls toggle shows its new value until `onChatSettings` settles (it may return a promise); then the host's `chatSettings` show. The overrides used to stay for the dialog's life, so a setting the host didn't take (a notification permission refused or dismissed, a restricted-content flag that didn't save) kept showing the user's choice. `onChatSettings` gets the host's settings with the one change, not other toggles still waiting.
- Not in the design export: to go back to it (the app's `GAPS.md` lists them).

## 2026-10-22 — scrollbars styled everywhere, by hand
- `global.css` styles every scrollbar as the design's docs do (`Docs.svelte`): thin, a grey thumb (`rgba(128,128,140,.35)`) on no track. Before, only the docs chrome had it, so a host's dialogs and panels (`ProfileDialog`'s chats & calls, say) showed the browser's default.
- Components that hide their scrollbar (`scrollbar-width: none`) or set it thin keep doing so. The two that hide it (`MemeFighterDialog`'s narrow vibes, Learn's narrow tabs) also hide it with `::-webkit-scrollbar { display: none }`, which is all Safari before 18.2 reads.
- Not in the design export: to go back to it (the app's `GAPS.md` lists it).

## 2026-10-23 — ProfileDialog's edit buttons keep their surface on hover, by hand
- The cover and photo edit buttons' hover was `--btn-hover` alone, a see-through tint, so on hover the button lost its surface and the avatar or cover showed through it. The tint now goes over the button's own surface (`--card-2`).
- A small visual fix the app needed, not in the design export: to go back to it (the app's `GAPS.md` lists it).

## 2026-10-23 — ProfileDialog: a host-drawn QR code, the report row with its callback, the About pages a host has, by hand
- `qrCode` (a snippet given the invite link) draws the invite's QR code. Without it the dialog still draws one with a global `qrcode` library, which a host has to load itself; the app has its own QR component.
- The storage section's "report a problem" row shows only with `onReportIssue`, as the header says of every action (it was always there, and did nothing without it).
- The storage meter shows only with an allowance (`storageLimitMB` above 0): a user without one (no Diamond) gets the upsell, not a meter divided by 0.
- With no communities, the communities section says so (`ui.profileDialog.communities.none`), rather than "No communities match “”".
- `onSectionChange` reports the section shown, as the dialog opens and as the user moves, for a host that loads a section's data only when it's seen (the bot configuration).
- `aboutPages` lists the About pages the host has, so the dialog doesn't link to one it hasn't (default: all). A group left with none isn't shown.
- Not in the design export: to go back to it (the app's `GAPS.md` lists them).

## 2026-10-23 — UserDialog: a moderator action, by hand
- `UserDialog` takes `moderatorAction` (`{ label, onAction }`), shown in its footer beside Block for anyone but yourself. It closes the dialog (with its exit animation) and then calls `onAction`. The app uses it for a platform moderator's suspend and unsuspend, which the design has no place for.
- Not in the design export: to go back to it (the app's `GAPS.md` lists it).

## 2026-10-23 — MessageGroup: the sender's avatar and name can be clicked, by hand
- `MessageGroup` takes `onSenderClick`, called with the element when the sender's avatar or name is clicked, or focused and pressed with Enter or Space. Only those two elements: a click on a message doesn't call it. Without it both stay as they were. The app opens the sender's profile card, as the old UI does.
- Not in the design export: to go back to it (the app's `GAPS.md` lists it).

## 2026-10-23 — UserDialog's About can be the host's formatted text, by hand
- `DetailSection` takes `children` for its prose variant, shown in place of `value`; `value` still decides whether the text is long enough to clamp. `UserDialog` takes `aboutContent`, passed through to its About section. The app renders a user's bio as Markdown there, as the old profile cards do.
- Not in the design export: to go back to it (the app's `GAPS.md` lists it).

## 2026-10-23 — AccessGates offers only the gate types a host names, by hand
- `AccessGates` takes `types`, the gate types its "add a gate" list offers (default: all). A rule of another type already in `value` still shows. The locked explainer's example gates follow it too. The app leaves out the unique-person gate (that concept is suspended) and the credential gate (there's no way to pick a credential yet).
- Not in the design export: to go back to it (the app's `GAPS.md` lists it).

## 2026-10-23 — GroupPanel: the host says what can be done to each member, by hand
- A `Person` in `members` can carry `actions` (`{ roles, remove, block }`): the roles the viewer may give that member, and whether they may remove or block them. When a row has them, they replace the panel's own role ladder for that row (which went by `viewerRole`, `canModerate` and `canChangeRoles`, and couldn't know a group's own permission settings). `GroupPanel` also takes `onBlockMember`, offered as "Block member" (`ui.groupPanel.block`) where a row's `actions` allow it. The app fills `actions` from the chat's or community's permissions.
- `MemberRow`'s icon test no longer narrows through a `$derived` flag, which TypeScript couldn't follow (a type error only; nothing shown changes).
- Not in the design export: to go back to it (the app's `GAPS.md` lists it).

## 2026-10-23 — GroupPanel's cover close calls onClose, and can be Back, by hand
- The cover's × had no handler unless the host passed `coverHandlers.close`, so it did nothing for a host that only gave `onClose`. It now calls `onClose` (a host's `coverHandlers` still win).
- `GroupPanel` takes `back`: the cover shows a back arrow (`PanelCover`'s new `back` action, `--icon-back`, "Back") instead of × when closing returns to an earlier panel, as the old panels did. The app sets it when the right column has a panel to go back to.
- Not in the design export: to go back to it (the app's `GAPS.md` lists it).

## 2026-10-23 — ProfileDialog: "Just linked" only for a method linked here, by hand
- A sign-in method without a `used` line said "Just linked", so every method a host listed without one (the app has no last-used date for them) looked new. "Just linked" is now only for a method linked in this dialog; another without `used` shows no line.
- Not in the design export: to go back to it (the app's `GAPS.md` lists it).

## 2026-10-23 — ProfileDialog: no empty "last used" line, and a delete step for a user without CHIT, by hand
- The signed-in method's id, when it's a principal (whatever the method), is shortened to its first two and last two groups (`bhnj4-strvt-…-s3iwt-pae`, as the design's samples are), on one line, the whole id on hover; anything else (an email address) shows as it is. A real principal ran onto a second line.
- A sign-in group's last row has no rule under it (the rule separates a row from the "add" row, when there is one), and a group with no method linked shows its note in a row as tall as a method's, centred.
- A sign-in method shows its "last used" line only when there's something to say (`used`, or "Just linked"). An empty line (and its gap) pushed the method's name off centre.
- The delete flow's third step ("Think of your CHIT!") tells a user who has never earned any CHIT (`balance` and `chitEarned` both 0) that they haven't discovered it yet, instead of "you'll lose 0 CHIT and your 0-day streak", and leaves out the zeroed streak and balance (new keys `ui.profileDialog.delete.step3NoChit*`).
- Not in the design export: to go back to it (the app's `GAPS.md` lists them).

## 2026-10-23 — DmPanel and DmChatSettings: CHIT optional, a formatted bio, read receipts only with a handler, by hand
- `DmPanel`'s `chit` is optional: without it the CHIT card is left out, for a viewer who has turned CHIT off. It also takes `aboutContent`, as `UserDialog` does, so the host can render the bio as Markdown.
- `DmChatSettings` shows its read receipts row only with `onReadReceiptsChange`. It always showed it, and OpenChat has no read receipts setting, so the toggle saved nothing.
- Not in the design export: to go back to it (the app's `GAPS.md` lists it).

## 2026-10-23 — ProfileDialog: a sign-in step the host turns down can say why, by hand
- A host step in the sign-in "add" form (`onLinkMethod`, `onRequestEmailCode`, `onVerifyEmailCode`) that rejects with `{ reason }` (a resource key or literal text, as `AuthDialog`'s `AuthFailure`) shows that reason in place of the step's generic failure line. One that rejects with `{ cancelled: true }` (the user gave the step up) goes back to the form with nothing said. The app says why linking failed, e.g. the sign-in provider limit.
- Not in the design export: to go back to it (the app's `GAPS.md` lists it).

## 2026-10-23 — ProfileDialog hands off to Diamond and CHIT without an exit, by hand
- `DialogFlow` has `handOff(then)`: a step that opens another dialog in this one's place runs `then` at once, with no exit (still ignored while a call is pending). `ProfileDialog`'s Diamond (nav item and upsell) and CHIT claim use it, where they played the dialog's exit first: the backdrop faded out, then the next dialog's faded back in. Now the host can keep the backdrop and only the next dialog animates in. The CHIT claim day is inert (no click, default cursor) without `onChit`, where it was a button that did nothing.

## 2026-10-23 — DeleteGroupDialog: a DM's delete, without typing a name, by hand
- `noun` takes `'chat'` (new `chat` branches in the `ui.deleteGroupDialog.*` strings: "Delete a chat", "Delete your chat with {name}"), and `typeToConfirm` (default true) can turn off the type-the-name step, so Delete arms at once. The app confirms deleting a DM with it; the library had no confirm for a DM.
- Not in the design export: to go back to it (the app's `GAPS.md` lists it).

## 2026-10-23 — ChatRow: picking a menu item doesn't also open the chat, by hand
- The row's `ContextMenu` sits inside the row, so a click on an item bubbled to the row's `onclick` and opened that chat as well. Opening it closed any dialog the item had just opened, and opening an archived chat un-archives it, so Delete, Leave and Archive did nothing. The menu is now wrapped in a `display: contents` element that stops clicks and pointer events reaching the row.
- Not in the design export: to go back to it (the app's `GAPS.md` lists it).

## 2026-10-23 — GroupSettingsDialog: parts the viewer's role can't change, by hand
- `readOnlySections` (`'gates' | 'rules' | 'permissions' | 'disappearing' | 'history' | 'visibility'`, exported as `ReadOnlySection`) makes those parts read-only while the rest stays editable. The Gates, Rules and Permissions pages show plain On/Off status as `readOnly` does for the whole dialog, and `'disappearing'`, `'history'` and `'visibility'` lock those switches on the Group page (no Diamond banner). The app makes permissions, disappearing messages and Public read-only to a non-owner, and locks history, which can't change after a group is made. `readOnly` could only make the whole dialog read-only.
- A read-only Permissions page (either way) keeps its General / Messages / Threads tabs usable, and shows the roles as plain pills with no chevron and no "Reset to defaults". The whole page used to be `inert`, so only General could be seen.
- Not in the design export: to go back to it (the app's `GAPS.md` lists it).

## 2026-10-23 — GroupPanel: settings for everyone, as About without edit rights, by hand
- The menu's settings item was only offered with `canEdit`. It's now offered to everyone, labelled "About the group / channel / community" (`ui.groupPanel.menu.about`) without `canEdit`, and still calls `onDialog('settings', …)`. The host opens the About page for it.
- Not in the design export: to go back to it (the app's `GAPS.md` lists it).

## 2026-10-23 — ProfileDialog's CHIT section: the puzzle setting optional, "Ways to earn more" only with onEarn, by hand
- `ProfileDialog` takes `puzzleSetting` (default true): false leaves the daily puzzle block out, for a host that has no such setting (`meta.json` updated). "Ways to earn more" shows only with `onEarn`: without it, a click closed the dialog and opened nothing.
- Not in the design export: to go back to it (the app's `GAPS.md` lists it).

## 2026-10-23 — ProfileDialog's calendar: claiming in place, and nothing missed before joining, by hand
- `ProfileDialog` takes `onClaim` (as `ChitDialog`'s): the calendar's Claim claims there, and the day says "Claiming…" (`ui.profileDialog.calendar.claiming`) until it settles, where it otherwise opens the CHIT dialog (`onChit`). `meta.json` updated.
- A day before `joined` is shown as a future day is (no claim, no "not claimed"), where it counted as missed.
- Not in the design export: to go back to it (the app's `GAPS.md` lists it).

## 2026-10-24 — ChitDialog: the default tiers keep their spacing, and a claim made here clears for the next day, by hand
- Passing `milestones` always spaced the bar's notches evenly, so a host passing the default tiers (3, 7, 14, 30, 100, 365) lost the hand-spaced positions (3 at 8%, 100 at 67% …). The default tiers now keep them, whoever passes them; other tiers are still spaced evenly.
- A claim made in the dialog kept it in the claimed view for as long as it stayed open, so once the next claim opened it said "Come back in" with no countdown and no Claim button. It now clears when `claimable` comes back on.
- Not in the design export: to go back to it (the app's `GAPS.md` lists it).

## 2026-10-24 — ChitDialog: a claim with nothing to claim plays no claim, by hand
- `onClaim` may resolve with `false` when there was nothing to claim (today's already claimed, on another device or before the dialog knew): the claim animation doesn't play, and the dialog follows `claimable`. It played as if CHIT had been added.
- Not in the design export: to go back to it (the app's `GAPS.md` lists it).

## 2026-10-24 — StreakInsuranceDialog: "Your cover is full", and a week of cells at a time, by hand
- With no room left, the summary said "Covered for a full week" (`fullWeek`), but cover is capped by the length of `prices`, which for OpenChat is 30 days. It now says "Your cover is full" (`ui.streakInsuranceDialog.coverFull`).
- The ladder drew one cell per position of `prices`, all in a row, so 30 of them crushed the prices into each other. It now shows a week of cells at a time, sliding so the last covered day, the days being added and the next to add stay in view.
- Not in the design export: to go back to it (the app's `GAPS.md` lists it).

## 2026-10-24 — StreakInsuranceDialog: Back hands off to the CHIT dialog, by hand
- Back played the dialog's exit (its backdrop fading out) before calling `onBack`, so the CHIT dialog it went back to faded its own backdrop in. With `onBack` it now hands off with no exit (`DialogFlow.handOff`), as `AchievementsDialog`'s Back already did, so the host keeps the backdrop and only the dialog changes. Without `onBack`, Back still closes with the exit.
- Not in the design export: to go back to it (the app's `GAPS.md` lists it).

## 2026-10-24 — StreakInsuranceDialog: a host's cap, and a purchase backed out of, by hand
- `cap` (default: the length of `prices`) is what the foot's "cover caps at {max} days" says. OpenChat's `prices` count what can still be held after missed days, so the label read a cap that dropped with each miss; it now shows the 30 days that can be bought. `meta.json` updated.
- `onBuy` resolving `false` is nothing bought by choice (the user backed out of the PIN prompt): the dialog stays open with no error, where it closed as if bought.
- Not in the design export: to go back to it (the app's `GAPS.md` lists it).


## 2026-10-24 — GroupSettingsDialog: community mode shows only what a community has, by hand
- With `noun: 'community'` the dialog showed group-only settings, which a community doesn't have, so editing them saved nothing:
  - the message-related general permissions (delete, pin, react, @everyone, calls);
  - the Messages and Threads permission tabs;
  - the history and disappearing-messages switches, and their About facts;
  - the moderator and nobody roles.
- Those are now left out for a community. The `GENERAL` rows carry `only: 'group'` the way the channel rows carry `only: 'community'`. The role picker offers member, admin and owner, and the "changed" count counts only general permissions.
- A community's permissions all default to admin (`communityDef` on the shared rows), as the backend's `CommunityPermissions::default()` has them. "Reset to defaults" set Remove members to moderator, a role a community can't hold, and let every member invite and create private channels. A fresh community also showed four permissions "changed from the defaults".
- Save waits for a name check that's still running (400ms after typing) instead of ignoring the click. Saving straight after renaming did nothing until a second click.

## 2026-10-24 — DailyPuzzleCard: a host's title and menu, and ChitDialog passing them on, by hand
- `title` (resource key or literal text) is the new / progress title, which was always "Today's puzzle · Bridges" (`ui.dailyPuzzleCard.title`, still the default), for a host whose puzzle is another game.
- `menu` lists the "⋯" menu's items by their action (`puzzleRemindOn` stands for the reminder either way); left out, all three show, as before. With none, there's no "⋯".
- `state: 'unavailable'`: no puzzle today. The card says so (`title`, default `ui.dailyPuzzleCard.titleToday`; `sub`, default `ui.dailyPuzzleCard.unavailable`) with no button and no "⋯", so there's nothing to press.
- `ChitDialog` passes them on as `puzzleTitle` and `puzzleMenu`, and takes the new state as `puzzleState`. Its `puzzleCountdown` is the solved card's "Next puzzle in" (it was `countdown`, the next claim, which is empty while a claim is due); left out, still `countdown`. `meta.json` updated.
- Not in the design export: to go back to it (the app's `GAPS.md` lists it).

## 2026-10-24 — ChitDialog: a claim bursts confetti, by hand
- A claim made in the dialog (`onClaim` resolving with anything but `false`) bursts the library's `Confetti` from the claim area as the ring pops, as `AchievementToast` and `PrizeMessage` do theirs. The old CHIT modal rained coins on a claim; the design had nothing.
- Not in the design export: to go back to it (the app's `GAPS.md` lists it).

## 2026-10-24 — A back arrow only for a dialog opened from another, and one for DialogShell and ProfileDialog, by hand
- The app's rule for a dialog opened from another: it has a back arrow, the only way back to the one it was opened from; ×, the backdrop and Escape close them all.
- `AchievementsDialog`, `LeaderboardDialog` and `StreakInsuranceDialog` drew their back arrow always, falling back to `onClose` (the insurance dialog to its exit). It now shows only with `onBack`; `LeaderboardDialog` keeps its place empty, so the title doesn't move.
- `DialogShell` takes `onBack`: a back arrow before the title. `ProfileDialog` takes `onBack`: one before the section's title, which hands off with no exit (`DialogFlow.handOff`), so the backdrop stays.
- `meta.json` updated.
- Not in the design export: to go back to it (the app's `GAPS.md` lists it).

## 2026-10-24 — InviteDialog: the host searches, by hand
- `onSearch?: (query, tab: 'add' | 'invite') => Promise<InvitePerson[]>`. As the Add or Invite query changes, the host searches (250ms debounce, latest query wins), and its results stand in for filtering `communityMembers` / `people`; a failed search falls back to that filter. A picked person found by a search stays shown in the chips. The dialog could only filter the lists it was given, so it couldn't find anyone the app hadn't loaded.
- The footer (Send / Add) is shown on the Add tab with `canAdd` and on the others with `canInvite`; it followed `canInvite` alone, so someone who could add but not invite couldn't send. "Frequently contacted" isn't shown over an empty list.
- Not in the design export: to go back to it (the app's `GAPS.md` lists it).

## 2026-10-24 — The claim calendar in a dialog of its own (the design's changes of 2026-10-22), by hand
- Built from the design's brief (no export of the changes yet): the claim calendar moves out of Profile → CHIT into `ClaimHistoryDialog`, opened from the CHIT dialog.
- `ClaimCalendar` (new): the calendar `ProfileDialog` drew, taken out of it. Always six weeks (42 cells), so its height doesn't change between months; the months either side show dimmed (40%), inert, with no claims. Cells 58px, `--radius-md`, the day 13.5px semibold, the amount mono 11px, weekday initials 11.5px; a claimed day is accent-tinted, today ringed. A claimed or insured day's popover shows on hover, and on a tap (touch has no hover; the pointer is told by its `pointerdown`). A claim's local time is that day's (`ClaimDay.at`), not today's offset, so daylight saving doesn't move past claims; a host's `utcOffsetMinutes` still overrides it. A day with something to do (today's Claim, a claimed or insured day's popover) is a real `<button>`, so Enter / Space work and it takes the shared focus ring, and its popover closes as focus leaves; missed and future days are plain cells, out of the tab order. The month steps and the Local / UTC options are buttons too. Props: `claimHistory`, `today`, `joined`, `claimable`, `utc`, `utcOffsetMinutes`, `onClaim`, `onUtcChange` (the brief's `streak` / `claimMinute` are its demo data). `ClaimDay` moves here from `ProfileDialog`.
- `ClaimHistoryDialog` (new): max width 600px, padding 20px, 28px between blocks; title bar with a back arrow (`onBack`, `backLabel`), the calendar icon, "Claim history" and the streak, close; `ClaimCalendar`; a streak insurance row (`insured` / `used`, `onInsurance`). Back and the insurance hand off with no exit. A claim from the calendar runs through the dialog (`DialogFlow.run`): back, the insurance and close wait on it, and a failure shows under the calendar (`ui.claimHistoryDialog.claimFailed`).
- `ChitDialog`: under the Claim button and its note, "View claim calendar" (after claiming, "Claimed · view calendar") with a CHIT-coloured calendar icon → `onAction('calendar')`. A real `<button>` sized to its content: 32px tall, 0 × 10px, 7px gap, `--radius-sm`, semibold `--text-sm` in `--ink-2`, `--overlay-1` and `--ink` on hover; the shared focus ring and Enter / Space come with the button, and on touch its hit area is padded to 44px.
- `ProfileDialog`: the CHIT section's calendar is gone, and with it `claimHistory`, `today`, `claimable`, `chitUtc`, `utcOffsetMinutes`, `onChit` and `onClaim`; a "Claim history" row (`onChitHistory`) takes its place.
- Icons: `calendar` (icons.js, icons.css, the manifest's count). The brief's `minus` is left out until something uses it.
- `meta.json`, the docs' samples and the Rewards section updated.
- Not in the design export: to go back to it when the export has these (the app's `GAPS.md` lists it).

## 2026-10-24 — MemberRow: its buttons don't also click the row, by hand
- The ⋮ menu, the action button and the trailing icon sit inside the row, so a click on one bubbled to the row's `onClick` as well. In GroupPanel the user group row's ⋮ opened the group instead of its Edit / Delete menu, a member's ⋮ also opened their profile, and the trailing icon ran `onClick` twice. Each now stops the click reaching the row.

## 2026-10-25 — LeaderboardDialog: the joystick plays the host's game, by hand
- `game` (a snippet): the joystick, until now a "coming soon" placeholder, becomes a button ("Play Invaders") that shows the host's game in the boards' place, and a trophy in its place ("Back to the high scores") brings the boards back, as the old hall of fame's 🕹️ / 🏆 did. Focus moves to the game as it opens (its keys are the game's, and a focused button would wear its ring the whole game) and back to the joystick after. Without `game`, the joystick is the placeholder it was. `meta.json` updated.
- Not in the design export: to go back to it (the app's `GAPS.md` lists it).

## 2026-10-25 — DiamondDialog: its body as DiamondContent, prices per token, the approval fee, by hand
- `DiamondContent` (new): everything `DiamondDialog` drew inside its card (compare, plans, confirm, the member view, header and footer) and all its logic, for a page to render too (the `/diamond` page). It takes an optional `flow` (`DialogFlow`), the dialog's, which its paying and closing go through. `DiamondDialog` is now the dialog layer, veil and card around it, taking `DiamondContent`'s props; its types (`PlanKey`, `DiamondPurchase`, `DiamondLimits`) come from there and are re-exported.
- `tokenPrices`: each plan's price per token, the backend's own. Only those tokens are offered, at those prices, with no USD conversion (the backend checks the price and rejects any other). `prices` / `chatUsd` stay for a host without it.
- `approvalFees`: the approval a wallet payment makes on top of the price, per token. It counts towards what a token can afford ("Need … more", insufficient funds) and shows on confirm ("Approval fee", and in the balance after payment).
- `depositAddresses`: the top-up address per token, as each token has its own.
- `shortfall`: how much each token is short of each plan (0 when it can pay), as the host works it out exactly in the ledger's units. Whether a plan can be paid and its "Need … more" both come from it, and "You need at least …" shows the cheapest plan's price and fee as exactly, in place of a floating point sum of price and fee against the balance here (0.1 + 0.0002 isn't 0.1002, and a plan the exact check refuses could read "Need 0 … more"). Prices, the approval fee, the shortfall, the least a plan costs and the balance after payment are shown exactly, to the 8 places CHAT's and ICP's ledgers keep ("15.001 CHAT", not the "15.00 CHAT" two places gave).
- `pricing` (`'loading' | 'failed'`) and `onRetryPricing`: while the prices load, the plans step says so; if they failed, it says that and offers to try again. Upgrade is offered meanwhile.
- `defaultToken`: the token chosen at first.
- `onUpgrade` may resolve `false`: nothing bought and nothing to say (the user backed out, or the host said why); it stays on confirm with no error.
- The first step's Back (`onBack`) hands off with no exit (`DialogFlow.handOff`), so the dialog it goes back to keeps the backdrop.
- `meta.json` updated (`DiamondDialog`'s props are `DiamondContent`'s, so its own list is empty; the docs sample gives its defaults).
- Not in the design export: to go back to it (the app's `GAPS.md` lists it).

## 2026-10-26 — ManageDialog: new, by hand
- Manage for a group, channel or community, built from the App prototype's Manage dialog (`_manageVals` and its template in `OpenChat App.dc.html`, 2026-10-21); the design export has no component for it. A 1040×760 card: a 250px nav (the chat's avatar, name and subtitle, an optional back arrow, groups of items with the design's icons, one danger action in the footer: Delete for the owner, Leave otherwise) and the host's page beside it as `children` (GroupSettingsDialog / InviteDialog / GroupPanel, each `embedded`, with their own title bar and close). `confirming` shows the design's "Discard changes?" over it (Keep editing / Discard); the host decides when. The veil and Esc call `onClose`; Esc keeps editing while confirming. Below 768px it fills the screen with a 200px nav (not designed).
- `meta.json`, the docs' samples and the group dialogs section updated; strings under `ui.manageDialog`.
- Not in the design export: to go back to it when the export has one (the app's `GAPS.md` lists it).

## 2026-10-26 — ConversationHeader menu strings, by hand
- `ui.conversationHeader.menu` gains `manageGroup`, `manageChannel`, `groupDetails`, `channelDetails`, `markAsRead` and `chatSettings`, for the design's chat menu (the App prototype's `_chatMenu`) with the Manage item the app adds.

## 2026-10-26 — ManageChannels: new, by hand
- Manage's Channels page for a community, from the App prototype's Manage dialog (its Channels section, `isManageChannels`); the design export has no component for it. A title bar (Channels, New channel with `onNew`, close) over channel cards: a round `#` avatar, the name with a "You're here" chip on the open one, its description, members and visibility, and a chevron. Strings under `ui.manageChannels`; `meta.json` and the docs updated.
- Not in the design export: to go back to it when the export has one (the app's `GAPS.md` lists it).

## 2026-10-26 — CreateGroupDialog: channel names as typed, by hand
- A channel's name (and a new community's channel list) was slugged as you typed: lowercased, spaces to hyphens, anything else dropped. Nothing requires that, so names are now kept as typed (trimmed; the channel list still caps each at its length and rejects duplicates), and the channel name's and the channel list's hints no longer say "Lowercase, no spaces"; a new community's first channel is "General". The people list's heading is hidden over an empty list (as InviteDialog's).
- Not in the design export: to go back to it (the app's `GAPS.md` lists it).

## 2026-10-26 — CreateGroupDialog: a community's permissions, by hand
- A community's permissions default to admin (`communityDef`, and private channels and user groups), as the backend's and GroupSettingsDialog's do; the dialog offered invite and private channels to every member and roles and user groups to the owner only. A community shows no message permissions (delete, pin, react, @everyone, calls) and no Messages / Threads tabs, which a community doesn't have. `communityDefaults` lets the host pass its own community defaults (the app passes its own), so a re-export that loses the built-in ones can't change who runs a new community.
- Not in the design export: to go back to it (the app's `GAPS.md` lists it).

## 2026-10-26 — CreateGroupDialog: locked while creating, by hand
- While the host's create is in flight the tabs and the form are `inert` and dimmed, so nothing can be changed or switched until it resolves or fails; Cancel and close were already held. The form used to stay editable while creating.

## 2026-10-26 — ChatPicker in sections with the host's search; InviteDialog's share to a chat; Avatar's gradients, by hand
- `ChatPicker`: a long item line (an invite link) no longer widens the picker past its card (the dialog body's grid column grew to it); it's cut with an ellipsis, as meant. Section labels are uppercased, as the design's "RECENT CHATS" is, so a host's names (Group chats, a community's) read the same.
- `ChatPicker`: a chat's `sub` (literal text under its name, in place of `kind`: a DM's last seen, a group's description) and `group` (the section it's listed under, literal text shown as given: a community's name isn't run through the translator). When the chats have sections, a header starts each, in place of "Recent chats" / "Results"; the host gives them in order. `filter`: the host's search (a name, a @username, a community's name), in place of matching `chats` by name and kind. `emptyLabel` (default `ui.chatPicker.noChats`, "No chats available"): what an empty list says with nothing searched for.
- `InviteDialog`: `filterChats`, passed to its picker as `filter`; its chats take `sub` and `group` too. `onShareToChat` may resolve `false`: nothing sent and nothing to say (the user backed out), so the picker stays open with no toast.
- `Avatar`: its gradients exported as `AVATAR_GRADIENTS` (a module script), for a host drawing a face the same colour elsewhere (the picker's tiles).
- `meta.json` updated.
- Not in the design export: to go back to it (the app's `GAPS.md` lists it).

## 2026-10-26 — WebhookDialog: delete, by hand
- `onDelete` adds "Delete webhook" to edit mode (beside Cancel). It swaps the body for a confirm step (the name, the URL struck through, "anything posting to its URL will stop working"), as Regenerate's does, and closes once the host's promise resolves; a rejection keeps it open with "Couldn't delete the webhook". The design has no way to remove a webhook; the old pages did. Strings under `ui.webhookDialog.delete*`, `meta.json` updated.
- Not in the design export: to go back to it (the app's `GAPS.md` lists it).

## 2026-10-26 — BotDialog: the host's permissions, by hand
- `permissions` (`BotPermissionInfo[]`: key, label, group, risky) replaces the built-in eleven-permission vocabulary: the bot's `perms`, its commands' `needs` and `granted` use the host's keys, the toggles are listed under the host's headings in its order, and the summary sentence lists the host's labels (risky ones highlighted). The app's bots ask for some thirty permissions, for commands and for acting on their own apart, which the built-in set can't express without granting by guesswork. Without `permissions` the dialog behaves as before. `BotDefinition.perms` / `needs` / `granted` and `BotInstall.granted` are keyed by string; `meta.json` updated.
- Not in the design export: to go back to it (the app's `GAPS.md` lists it).

## 2026-10-26 — VoiceMessage: the recording's waveform, by hand
- `levels` (0–1 per bar) draws the recording's own waveform; without it the placeholder bars show as before. The design's bars are made up. `meta.json` updated.
- Not in the design export: to go back to it (the app's `GAPS.md` lists it).

## 2026-10-26 — LinkCard and ChatBubble previews, by hand
- `LinkCard` is `LinkPreview`'s card, taken out unchanged (large or compact, links only to http(s)) so `LinkPreview` and `ChatBubble` share it; `LinkPreview` renders one.
- `ChatBubble` takes `previews`, a `LinkCard` each under the text. With any, the bubble takes `LinkPreview`'s shell: 320px wide, a 4px inset the cards sit flush to, the text, quote and forwarded tag padded as `LinkPreview`'s text, and the time and tick in a footer under the cards rather than at the end of the text. A message with link previews keeps its markdown, edit, quote, thread and reactions; `LinkPreview` as a message kind of its own has none of them. `onRemovePreview` puts an X on each card (shown on hover or focus, always on touch), for the sender to remove it, as the old trees allow. `meta.json` updated.
- Not in the design export: to go back to it (the app's `GAPS.md` lists it).

## 2026-10-27 — TransferMessage: direction and recipient, by hand
- `direction` (`in` / `out` / `other`) replaces the side as what sets the sign: a transfer between two other people in a group has no sign and no green, where the side alone would show it as received by the reader. `recipient` adds "to Bob" after the USD value. Without either it behaves as before. String `ui.transferMessage.to`; `meta.json` updated.
- Not in the design export: to go back to it (the app's `GAPS.md` lists it).

## 2026-10-27 — PollMessage: readonly and showResults, by hand
- `readonly` locks the poll for a reader who may not vote at all (a DM, a read-only chat); the design locks it only once closed or voted without "change vote". `showResults` lets the host say when the counts show: the poll's sender sees them before voting, and a poll that hides its votes until the end doesn't show them after a vote. Without either it behaves as before. The footer counts votes whenever the results show, and "View votes" shows only with `onViewVotes`. `meta.json` updated.
- Not in the design export: to go back to it (the app's `GAPS.md` lists it).

## 2026-10-27 — PrizeMessage: the claim's click and canClaim, by hand
- `onClaim` gets the click: the app claims only from a trusted one. `canClaim` (default true) leaves Claim out where the host doesn't offer it (the sender's own prize, a DM, all taken); the design offered it to everyone. Without `wonAmount` a win says "You won" (`ui.prizeMessage.youWonIt`): a prize message carries no amount. `meta.json` updated.
- Not in the design export: to go back to it (the app's `GAPS.md` lists it).

## 2026-10-27 — SwapOffer: pending and cancelled, by hand
- `state` gains `pending` (taken, not yet settled: `doneText` says how, in a quiet segment with no check) and `cancelled` (dimmed like `expired`, headed "Cancelled"); the design had only open, done and expired, so a cancelled offer would have read "Expired" and one being settled had nothing to show. Strings `ui.swapOffer.cancelled` and `ui.swapOffer.inProgress`. `caption` shows the offer's message under the card, as `TransferMessage` does; the design had none. `canAct` (default true) leaves the action out for a reader who can't take it (previewing the chat). `meta.json` updated.
- Not in the design export: to go back to it (the app's `GAPS.md` lists it).

## 2026-10-27 — pass 5, ported by hand
- From the pass 5 export (13 components and the icon set); its `.logic.js` and demo data not taken. `WalletPanel`'s rows are ported with the wallet (6a).
- Icons: `backspace`, `keyboard` and `minus` added; `screen-share` and `phone-off` redrawn; `calendar`, `video-off`, `maximize` and `minimize` take the export's path order. Ours keeps `moon`, `sun`, `smartphone`, `pause-filled` and `play-filled`, which the export doesn't have (154 icons).
- `Button`: labels never wrap (ellipsis; the full text is the tooltip only when it's cut off); `size` (`md` 40px, `lg` 52px with a 14px radius); `icon` before the label, an icon-only button (empty label) is square with the icon centred; `ariaLabel` (an icon-only button's accessible name and tooltip). A disabled button is `role="button"` with `aria-disabled`.
- `ChatRow`: the pin is accent; `locked` puts a lock before the title (private channels and groups). `ChatListPanel` passes a row's `locked` through.
- `ActivityRow`: an unread row has no tint; its dot alone marks it.
- `ChatBubble`: `mirror` puts the grouped / tail corners on the inline-end side (right-aligned layouts), a deleted message's too. Web unchanged.
- `Confetti`: `within`, a CSS selector of an ancestor to clip the burst to (the clip and the pieces follow it if it moves during the burst; an invalid selector clips to nothing).
- `AchievementToast`: `speed` (every duration, delay and timer) and `outroSpeed` (the collapse and fade only), both 1 by default.
- `PuzzleDialog`: the solved screen's trophy is 80px; `holdSolved` + `solvedReady` keep a solve on the (locked, no hints) board after `onSolved` until the host is ready; it's revealed from the board only, so How to play opened meanwhile isn't cut short, and stays revealed whatever `solvedReady` does next; the clock stops while a solve is checked or held.
- Already in place from the hand ports of 2026-10-24: `ClaimCalendar`, `ClaimHistoryDialog`, `ChitDialog`'s calendar link and cog, `ProfileDialog`'s Claim history row (ours keep the real claim data in place of the export's demo props).
- Not ported, as nothing on the web uses them (native layouts): `MessageComposer`'s sizing variables, `emojiPlacement` / `plusPlacement`, host-owned panels (`onPlus` / `plusActive`, `onEmoji` / `emojiActive`, `onInputFocus`, `insert`) and its markup fix around the + button (ours is a separate hand conversion without that nesting); `PuzzleDialog`'s `layout="screen"`, `topInset`, `backIcon` and `backFlip`.
- `meta.json` and the strings (`ui.chatRow.private`) updated. `features/index.ts` exports `ClaimDay` from `ClaimCalendar`.

## 2026-10-27 — The wallet's tokens keyed by id, their actions and logos, the token page's history, by hand
- `WalletToken`: `id` (the token's identity in callbacks, requests, the selection, the hidden list and activity; defaults to the symbol, as several ledgers can share one), `actions` (what its menu and its page's buttons offer: `send`, `receive`, `swap`, `refresh`, `hide`; all of them without it, Hide in a manual wallet only) and `logo` (an image URL, shown in place of the mark; `grad` stays its colour in the bars).
- `WalletPanel`: rows, menus, `onToken`, `onRefresh`, `onRemoveToken`, `onAction` (`send:<id>` …), `hidden` and `selectedToken` use the id. `rates`: USD per display currency (BTC, ETH, ICP) from the host, in place of the price of a token with that symbol.
- `WalletMain`: the token page and activity match on the id; Send, Receive and Swap are given the token's symbol, as they still pick by it. `history` (`loading`, `failed` with `onRetryHistory`, `loaded` with `more` / `loadingMore` and `onMoreHistory`, `unavailable` for a token whose transactions can't be listed), `onActivity` (a token page row clicked) and `allActivityNote` (shown in place of All activity's list). `WalletActivity`: `token` (the id), `party` (the other side: the title is worded from it and the kind when there's no `title`) and kind `own` (between your own wallets: listed under All only, unsigned). Strings `ui.walletMain.betweenYourWallets`, `historyFailedTitle` / `Body`, `noHistoryTitle` / `Body`, `loadOlder`, `loadingOlder`, `allActivityUnavailableTitle` / `Body`.
- `TokenAvatar`: `logo`, on no backdrop. `PageHeader`: `avatarLogo`.
- `meta.json` updated.
- Not in the design export: to go back to it (the app's `GAPS.md` lists it).

## 2026-10-27 — pass 4 (wallet empty state, split token list, token page hero), ported by hand
- From the 2026-10-27 export of `BalanceCard`, `WalletPanel`, `WalletMain` and `PageHeader` and its brief; the export's `.logic.js` and demo data not taken.
- `PageHeader`: `titleTag`, a pill right after the title (the title still truncates first).
- `BalanceCard`: `empty`: a plain 8px track in place of the allocation bar; Receive is primary and first, Send and Swap disabled ("Add funds first", `aria-disabled`).
- `WalletPanel`: `tokens` is the catalogue, held or not. Empty wallet: the card `empty`, no All activity row or sort controls, "SUPPORTED TOKENS" with "View all · N" (`onAction('browse')`) and the first five supported tokens (avatar, symbol, name, price; `onToken`). Funded: your tokens as before (manual `settings.tokens` are ids), owned tokens under the minimum value folded into one "N small balances" row that expands in place, and a folded "Supported tokens · N tokens you can receive" row last (`onAction('browse')`). The token kebab ends with a separator and Copy ledger ID (`onAction('ledger:<id>')`, only for a token with a ledger). New `supportedCount`. By hand: the total is what's listed (your tokens and small balances).
- `WalletMain`: `tokens` is the catalogue; a token you don't hold has its page at zero (the design specs for a whole-balance send and a token-less flow updated to match). Empty wallet: All activity is "Wallet" with the welcome (144px wallet tile, "Your wallet is ready", the "Receive tokens" card opening the Receive picker and "Get paid in chats" copying `handle`). Token page: the price as the header's `titleTag` and a kebab (its flows, Receive only at zero, then Copy ledger ID when it has a ledger); the facts grid and the "today" pill gone; the amount with an eye (`onBalanceHiddenChange`, the shared veil) and "≈" its value; share of wallet in the hero, only when held; at zero Receive leads and Send / Swap are disabled ("Add funds first"). Requests `browse` (the token picker titled "Supported tokens": yours, then the rest of the catalogue, then the receivable extras, no symbol twice; a catalogue token opens its page, anything else Receive) and `ledger` (copies that token's ledger ID with a toast, the view unchanged; one place copies for both kebabs). By hand: `flows`, the flows the host offers: requests, picks and menu items for the others are left out, and their buttons (the token page's, the welcome's Receive card) show as designed and do nothing.
- `meta.json` and the strings updated (`ui.balanceCard.addFundsFirst`, `ui.walletPanel.*` and `ui.walletMain.*` for the above).

## 2026-10-27 — pass 5: WalletPanel's small balances and supported tokens rows, ported by hand
- From the pass 5 export's `WalletPanel` (the rest of pass 5 is ported separately). Small balances and Supported tokens are token-shaped rows with no background (the token rows' padding and hover) and a 40px `--overlay-1` circle with the `coins` / `search` icon. Small balances: "Under $X each", the total on the right, and a down chevron; it expands in place into a compact list indented to the text column (24px avatars, 40px rows: symbol, amount, value), each opening its token. One 1px `--line-1` divider between the two rows. Supported tokens: "N you can receive" and a right chevron. Both chevrons sit in the token kebabs' 24px column.

## 2026-10-27 — wallet review fixes, by hand
- `WalletMain`: a token page asked for by an id that isn't in `tokens` says "Token not found" (`ui.walletMain.tokenNotFoundTitle` / `Body`) instead of showing another token's page. The token picker's rows carry each token's id, so two tokens sharing a symbol both show and each opens its own page. An `own` activity row has its own kind (not swap).
- `TokenPicker`: `TokenOption.id`, reported by `onSelect` (else the symbol). `TransactionRow` and `TokenAvatar`'s badge: kind `own` (the refresh glyph).
- `TokenAvatar`: a logo that fails to load falls back to the mark on its gradient.
- `lib/wallet.ts`, spec'd: `returnPlace` (where an open flow goes back to), `flowReturn` (where a newly opened one goes back to: where it was opened; one of the wallet's tokens over an open flow, its page) and `pickedFlow` (WalletMain's state after a token is picked for Send or Receive: the token shown or an extra, the way back, no earlier address). A host request naming one of the wallet's tokens goes back to its page, as the design has it; an extra token's uses `flowReturn`.
- `PageHeader`: the `titleTag` pill is larger (24px, `--text-md`), a small visual fix against the design (22px, `--text-xs`).
- `types.ts`: `WalletToken`'s description back on `WalletToken`.

## 2026-10-28 — WalletReceive: the host's networks, by hand
- `networks` (`ReceiveNetwork[]`: `id`, `label`, `short`, `time`, `address`, `failed`, `note`), the host's networks for the shown token in place of the token's `nets` and `addresses`, with `network` (the chosen id) and `onNetwork` (a pick). The address card says "Generating your address…" while the chosen network's address is coming and that it couldn't be generated when it failed; `note` (what depositing costs or needs) shows under the warning. Any token works with them, `nets` or not. Without them, Receive is as it was. `onShare`'s `network` is a string. The header shows the token's logo.
- `WalletMain`: `receiveNetworks`, `receiveNetwork` and `onReceiveNetwork`, passed to Receive.
- Strings `ui.walletReceive.generating`, `addressFailed`; `meta.json` updated.
- Not in the design export: to go back to it (the app's `GAPS.md` lists it).

## 2026-10-28 — WalletReceive review fixes, by hand
- `WalletReceive`: `token` is an id (or a symbol), so with two tokens sharing a symbol the header matches the host's networks; `ReceiveNetwork.token`, the token arriving on a network when the network names it (BTC or ckBTC; the token's symbol without it), is what the warning names. `WalletMain` gives Receive the token's id.
- `meta.json` updated.

## 2026-10-28 — WalletSend: the host's PIN, exact amounts and the token's id, by hand
- `hostPin`: the host asks for the PIN itself (or none is set), so Send has no PIN step: Send makes the transfer straight away and a failure shows under the form (`ui.walletSend.sendFailed`); `onSent` resolving `false` means nothing was sent and there's nothing to say, and the form stays as it was. The hint under Send reads `ui.walletSend.confirmHintHostPin`.
- `checkAddress(address, symbol)`: the host's say on an address (e.g. not the user's own, on a network the send can reach), on top of the detected network and the token's `nets`.
- `WalletSendRequest`: `token` (the token's id), `amountText` (the amount as a plain decimal, for exact ledger units: the digits typed, when typed in the token) and `max` (Max was picked); `to` is trimmed. Send picks its token by id (`token` is an id or a symbol), so two tokens sharing a symbol stay apart; a user-mode send's fee is `WalletToken.userFee` when given.
- `btcRoutes`: the routes the host can send BTC to a Bitcoin address over (both without it); the route picker lists only those.
- `WalletMain`: `sendHostPin`, `checkAddress` and `btcRoutes`, passed to Send; Send is given the token's id, and the pending row and the way back use the request's `token`.
- `lib/networks.ts`: an ICRC-1 account with a subaccount (`<principal>-<checksum>.<hex>`) is an ICP address. `lib/amount.ts` exports `plain`. `types.ts`: `WalletToken.userFee`.
- `lib/behaviours/dialog.spec.ts`: the one-run-at-a-time test is named after the app's 6b invariant 4 (one send per confirm), which it covers.
- `meta.json` updated.
- Not in the design export: to go back to it (the app's `GAPS.md` lists it).

## 2026-10-29 — ProfileDialog: "Just linked" over the host's last used line, by hand
- A sign-in method linked in the dialog says "Just linked" even once the host lists it with a `used` line, which would say the day it was linked.
- Not in the design export: to go back to it (the app's `GAPS.md` lists it).

## 2026-10-31 — ProfileDialog: the host can ask before the user id is copied, by hand
- `CopyButton` takes `onPress`: called on a click in place of copying, with the copy to run, so the owner can ask first.
- `ProfileDialog` takes `onCopyUserId`, the user id's `CopyButton`'s `onPress`: tokens sent to a user id are lost, so the app says it isn't a wallet address first. `meta.json` updated.
- Not in the design export: to go back to it (the app's `GAPS.md` lists it).

## 2026-10-29 — WalletRecipients and WalletSettingsDialog for the app's address book and settings, by hand
- `WalletRecipients`: `checkAddress(address, id)` (the host's say: the network's name, or why it can't be saved; rows show the network it names), `checkName(name, id)` (why a name can't be saved), `editAddress` (false: an edit only renames, the address read-only), `tokenLocks` and `lastSent` (false hides the token lock and "last sent"), `maxNameLength`. A recipient the host's new list already holds isn't added a second time after a save (it was, as a duplicate key).
- `Recipient`: `networkName` (the host's name for the address's network, shown on the row in place of checking each row) and `sendToken` (the token Send opens on for it). The default name is cut to `maxNameLength`.
- `WalletMain`: `recipientOptions`, passed to Recipients; a recipient's Send opens on its `sendToken` first.
- `WalletSettingsDialog`: hand-picked tokens are ids (`id`, else the symbol), so two tokens sharing a symbol stay apart.
- `meta.json` updated.
- Not in the design export: to go back to it (the app's `GAPS.md` lists it).

## 2026-10-29 — WalletSend: the saved-address picker knows the token, by hand
- `onPickSaved(token)`: Send passes the id of the token being sent, so the host's picker can offer only the saved addresses that token can reach. `WalletMain`'s `onPickSaved` takes it too.
- `meta.json` updated.
- Not in the design export: to go back to it (the app's `GAPS.md` lists it).

## 2026-10-29 — WalletMain: All activity's loading and empty state, by hand
- `allActivityLoading`: a skeleton on All activity while the host is still loading `activity` and nothing is listed yet.
- `tokensLoading` holds All activity too, not only a token's page: while the host is loading the tokens and their balances, both show a skeleton rather than the welcome, an empty list or a balance of 0.
- All activity with nothing in it (the All tab) shows the empty state ("No activity yet", `ui.walletMain.emptyAllBody`) in place of the one-line "No transactions of this type yet", which the other tabs keep.
- `meta.json` updated.
- Not in the design export: to go back to it (the app's `GAPS.md` lists it).

## 2026-10-29 — Loading states: a delayed skeleton, and the total balance's spinner, by hand
- `Skeleton`: `delay` (ms): invisible that long, then a short fade in, so a load that finishes sooner never shows it. WalletMain's skeletons use 500 ms.
- `BalanceCard`: `loading`, a small spinner by the label while the balances load. `WalletPanel`: `balancesLoading`, passed to it; while it's on, the panel doesn't take the empty wallet's layout. `ratesLoading` shows the same spinner without holding the layout.
- `meta.json` updated.
- Not in the design export: to go back to it (the app's `GAPS.md` lists it).

## 2026-11-02 — WalletSwap for the app's swaps, by hand
- Tokens by id (`token` is an id or a symbol; `SwapRequest.from` / `to` are ids), so two tokens sharing a symbol stay apart. `SwapRequest.amountText`: the digits typed, for exact ledger units.
- `payable` (the tokens that can be paid with), `targets` (what the token paid with can be bought with; null while the host finds out, and the Get card says so) and `onPay` (the token paid with, as it's chosen): the host's lists in place of "any token with a price".
- `onQuote(request, progress)`: each DEX's answer (`DexQuoteRow`) shows as it comes in and stays under the quote, the best marked. `SwapQuote.quotes`, `SwapQuote.warning` (to confirm with a toggle before Swap; `onSwap` gets `warningConfirmed`).
- `SwapQuote.expiresAt`, `dexFee`, `impactPct` and `networkFeeUsd` are optional: no countdown without an expiry, and no fees or price impact row without them.
- `onSwap` resolving `false`: nothing was sent (the host's PIN prompt was dismissed), back to the quote.
- `restricted`: a notice, and no quote.
- A rejected `onQuote` / `onSwap` shows a `SwapFailed`'s message (text) in the error line; any other rejection, Swap's own. `onPay` is called with only the token paid with tracked. After a dismissed PIN, an expiring quote's countdown carries on. A fallback target is one Swap can list.
- `WalletMain`: `swapOptions` (payable, targets, onPay, restricted) passed to Swap, which is given the token's id.
- Strings `ui.walletSwap.restricted`, `findingTargets`, `noTargets`, `dexQuotesLabel`, `dexQuoting`, `dexNoQuote`, `dexFailed`, `best`, `confirmWarning`; `meta.json` updated.
- Not in the design export: to go back to it (the app's `GAPS.md` lists it).

## 2026-11-03 — pass 6 (with the native export), ported by hand
- From the 2026-11-03 export (`openchat-ui-with-native`: pass 6's changed components, plus `src/native/NativeApp.svelte` and `docs/native/`); its `.logic.js` and demo data not taken. The native app itself isn't taken: it's the reference for the native screens, built separately (`src/native`, the native epic).
- Tokens: `--surface-3` and `--overlay-3` (dark and light). The 23 places that read them with a literal fallback (a dark value, as the tokens weren't defined) now read the tokens: light mode gets light values, and dark mode's overlays are .16 where the fallbacks said .12–.14. The export's rail widths (76 / 282px) are older than ours (60 / 283 / 320px, 2026-10-16 and 2026-10-20); ours stay.
- Icons: `chart`, `headphones`, `phone-ear`, `volume`, `zoom-in`, `zoom-out` (160). `zoom-in` / `zoom-out` were missing from the export's `icons.css`, so their masks are generated from `icons.js`.
- `global.css`: `oc-menu-pop` and its `[data-oc-menu]` reduced-motion rule; the `[data-oc-dot]` reduced-motion rule for the typing dots.
- Menus open with `oc-menu-pop` (`Menu`, and the hand-built menus in `DailyPuzzleCard`, `WalletRecipients`, and the permission menus of `CreateGroupDialog` and `GroupSettingsDialog`).
- `TimedToggle`: the expanded choices sit 12px under the row and 16px under the dashed divider.
- `ChatRow`: `previewIcon`, a 13px glyph before the preview (`forward`: "Forwarded" to screen readers, `ui.chatRow.forwarded`). `ChatListPanel` passes it on; its default section is "Chats" (`ui.chatListPanel.chats`; `ui.chatListPanel.recent` is gone), and the first section has 10px above it.
- `NavRail`: a pin's `menu`, opened by right-click at the pointer or Shift+F10 / the Menu key under the pin (the export has right-click only), `aria-haspopup="menu"`.
- `ComposerBar`: who is typing is a 24px strip resting on the bar (over its top padding, rising into the messages), so the bar never changes height; it fades and slides 8px, keeping the last names as it goes. `ui.typingIndicator.typing` has the two-name case ("A and B are typing"), which `TypingIndicator` uses too. ComposerBar passes the composer's native props on.
- `MessageComposer`: the ring is drawn outside the field (`--line-3` focused or with a menu open, never accent while editing), rows 6px apart, the media tray padded `6px 6px 0`, the tray's and the reply / edit card's radii concentric with the bar, the quoted original clamped to 2 lines. Native: `--composer-radius`, `--composer-min-h`, `--composer-pad`, `--composer-btn`, `--composer-btn-radius`; `plusPlacement` / `emojiPlacement`; `onPlus` + `plusActive` and `onEmoji` + `emojiActive` (the host's panels; the emoji button then offers "Show keyboard", `ui.messageComposer.showKeyboard`); `onInputFocus` (on `focusin`, as the export's `focus` on the root never fires); `insert` (`"\b"` deletes the whole character before the caret, by grapheme: an emoji with its skin tone, a flag, a family; `lib/textEdit.ts`, spec'd, which the picker's insert uses too). The + and emoji buttons are snippets placed before or after the text.
- `CreateGroupDialog` and `ExploreCommunities`: a flag by each language (the trigger's 19px, the options' 17px in a 22px cell), from `lib/languages.ts` (`languageFlag`: by code, the language's own name or the English key; the white flag otherwise; spec'd). The export keys them by name; ours by code, and a host's `languages` can bring its own `flag`. Explore shows them in both of its language menus (the export in one).
- `AccessGates`: all / any moves out of the header into a MEMBERSHIP section above the re-check toggle: "Members must meet" with its help line and a 230px All gates / Any one gate switch, always there and dimmed (`aria-disabled`) below two gates. Credential gates are retired (not offered; one already in `value` still shows) and NFT gates are gone, in `AccessGatesCards` too. Strings `ui.accessGates.membership`, `membersMustMeet`, `allGates`, `anyGate`, `joinerAllHelp`, `joinerAnyHelp`, `joinerNeedsTwo`; `all`, `any` and the NFT strings removed.
- `AuthDialog`: the referrer from the invite link is labelled "Invited by", with "Picked up from the invite link you opened." under it, until it's removed. With `resolveReferrer(code)`, sign-up offers "Got an invite link? Paste it": a pasted link's `ref` (`lib/referral.ts`, `referralCode`, spec'd) is looked up at once when pasted, or once typed text stops changing (as the search is), and becomes the referrer; Continue waits while a link is being looked up ("Checking the link…" by the field, `ui.authDialog.checkingLink`; at most 10 s, then it counts as naming no one), so a referral isn't left out; a referrer set any way (picked, found from a link, or the host's arriving late) empties the field and drops the lookup, so removing that referrer never brings back a link that wasn't looked up (`lib/referralLookup.svelte.ts`, `ReferralLookup`, spec'd); a link without one says so, as does one naming no one. The export matches a handle in a demo list; real links carry the referrer's user id.
- `WalletSwap`: only the best quote shows, with a "Best rate" row ("ICPSwap · of 3 checked", `SwapQuote.checked`); `DexQuoteRow`, `SwapQuote.quotes` and `onQuote`'s `progress` are gone (the 2026-11-02 hand edit). Swap's hover is `--accent-hover`. Strings `ui.walletSwap.row.bestRate`, `bestRateValue`; the per-DEX strings removed.
- Not taken (left out on purpose): `ConversationHeader`'s `typingNames` (not used); `Menu`'s `color: 'danger'` alias; `ChatRow`'s `fav` (always off in the export).
- Still to port: `ChatPicker`'s `multi` (forward to several chats), `ChatListPanel`'s grouped search (people, messages, search tabs), `MediaViewer` (new), `MessageGroup`'s `onMediaOpen`, `PuzzleDialog`'s `layout="screen"` (`topInset`, `backIcon`, `backFlip`).
- `meta.json`, the docs' samples and the strings updated; `export-manifest.json` and EXPORT.md carry the source hashes of everything now ported (passes 4–6).

## 2026-11-04 — component styles in SCSS, by hand
- Every component's `<style>` is `<style lang="scss">` (149 in the library, and `src/web`'s 32), checked by `scss.spec.ts` in each (one check, `styleBlocks.ts`'s `hasPlainStyle`, which takes any quoting of `lang` and ignores a `<style>` inside a string or comment). Plain CSS is valid SCSS: the compiled CSS is the same, apart from Sass's own equivalent rewrites (double quotes, unquoted attribute values, a `calc()` inside `min()` / `max()` unwrapped).
- `src/lib/styles/_mixins.scss`: `truncate`, `line-clamp($lines)`, `flex-center`, `icon($name, $size, $colour)`, `reduced-motion`; mixins only (the spec compiles it to empty CSS). A component that uses them imports them itself, relatively (`@use '../styles/mixins' as *;`), so the library compiles anywhere with no host configuration. `src/web` imports them as `@openchat/ui/src/lib/styles/mixins` (the app's Sass importer mirrors the TypeScript alias).
- The app's `svelte.config.js` gives the legacy trees (and component-lib) their own `src/styles/mixins.scss` prelude and nothing else gets one, so the library and new trees (`src/web`, a future `src/native`) never see the legacy mixins. Rollup's production build now uses that config too.
- `sass` is a dev dependency of the library itself.
- `ChatRow`'s preview text uses `truncate`. Using nesting and the mixins across the components is a follow-up.

## 2026-11-04 — nesting and mixins in the library primitives' styles, by hand
- The style blocks of 63 components (62 in `src/lib/components`, and `VirtualChatList` in `src/lib/virtual`) use nesting: states (`&:hover`, `&:focus-visible`), modifiers (`&.sent`, `&.last`), children that were already descendants or compounds of their parent, and the context a rule depends on written from the element (`.sent & {}` for `.sent .bubble`). Selectors that stood alone stay top-level; `:global(...)` rules and grouped selector lists stay as they were. `src/features`, `src/pages` and `src/docs` are a later batch.
- Mixins across them: `truncate`, `line-clamp`, `flex-center`, `icon`, `reduced-motion`, and new in `_mixins.scss`:
  - `focus-ring`: the keyboard ring as a shadow, in place of the outline.
  - `message-shell($bg)`: a message card's bubble (poll, prize, proposal, transfer, swap offer, file, media, link preview), with the `.last` tail corner.
  - `flex-center($display)`: takes `inline-flex`.
  - `icon(…, $flex)`: `$flex: null` leaves `flex` unset, for the icons that had no `flex: none`.
- A pure refactor. Each changed file's compiled CSS was compared with origin/master's, rule by rule in order. The only differences are declarations reordered within a rule where none overrides another (`truncate`'s order; `flex-center`'s `display` and `icon`'s `flex` first), and a few nested modifiers and `reduced-motion` blocks moving ahead of neighbouring rules that set none of the same properties. The docs build's CSS has the same 5712 rules, with those differences and no others.
- Left as they were: components with nothing to nest and no repeated pattern (Banner, Confetti, ContextMenu, Countdown, Icon, Logo, Menu, Pill, RequirementChip, ShareBar, SideCard, SnapFloat, StatCard, Tooltip, VirtualList), and hand-written clamps without the `line-clamp` property, which the mixin would add.

## 2026-11-04 — native platform tokens (native N1, #10364), by hand
- From the native design notes (§1 Surfaces and theme, §3.5 calls) and Component Changes ("tokens.css / icons"); the values the notes don't give are read from `NativeApp.svelte` / `NativeApp.logic.js`. The web resolves to the same tokens as before (`platform.spec.ts` runs tokens.css's cascade, var() substituted, for every mode × accent with and without the native attributes; checked once against the previous tokens.css for every root and nested combination). The one difference: a root with `data-accent` but no `data-mode` now takes that accent (it took pink); nothing sets one without the other.
- `[data-platform="native"][data-mode="light"]`: `--surface-0` / `--surface-1` #FFFFFF, `--surface-2` / `--field` #F4F3EF (the notes).
- `--hero-base` (dark #14141a, light #FFFFFF), `--tint-row` (dark rgba(0,0,0,.22)), `--tint-pill` (dark rgba(0,0,0,.28)), for the accent hero cards (the prototype blends 22–26% accent into `--hero-base`, inline). The dark values are the prototype's fallbacks; it defines none of the three, so its light theme painted them dark. Light `--tint-row` / `--tint-pill` (black at 5% / 8%) are ours, to be checked against the design. Not accent-dependent.
- Safe areas, on `:root` (0 where there are none, so a component can use them anywhere): `--safe-top`, `--safe-right`, `--safe-bottom`, `--safe-left` (`env(safe-area-inset-*, 0px)`), in place of the prototype's fixed `topPad` (iOS 54px / Android 4px) and `botPad` (34px / 12px); `--scroll-end` (`--safe-bottom` + 48px, the prototype's `scrollEnd`, the notes' end padding of a pushed screen).
- Text scale: `--text-scale` (1 on `:root`), and each `--text-*` size is declared once as its designed size times it, on `:root` and the native root (so a scale set on a native subtree reaches it). The app sets `--text-scale` on `<html>`, only while the native tree is mounted (it removes it on teardown, so the web tree never inherits a scale), so a portal to `<body>` (the call screen) follows it too (`textScaleOf`, the app's `logic/profile/appearance.ts`: the font size setting's factor times the platform's font scale, within 0.75–2).
- Accents: each `[data-accent]` element declares its dark family as `--dark-*` (`--dark-accent`, `--dark-on-accent`, `--dark-bubble-send-bg` …), and a dark root reads `--accent` … from it; the values are unchanged, only declared once.
- `[data-always-dark]`: an element gets the dark tokens (the dark colour, accent and shadow selectors list it) with the accent of its nearest `[data-accent]` root, or its own `data-accent` (outside any themed element, `<html>`'s), the dark hero tints, and the call colours, which exist only there: `--call-bg` #050507, `--call-ink` #FFFFFF, `--call-ink-2` rgba(255,255,255,.65), `--call-chip` rgba(255,255,255,.08), `--call-control` rgba(255,255,255,.12), `--call-control-on` #FFFFFF, `--call-control-on-ink` #0b0b10, `--call-tile` #0b0b10 and `--call-tile-mix` #101016 (the video tile's gradient), `--call-pill` #15151b (minimised voice pill), `--call-badge` #2a2a33 (muted badge), `--call-label` rgba(0,0,0,.45) (labels over video). The prototype marks its minimised call `data-mode="dark"`, which keeps the light accent family; `data-always-dark` doesn't.
- `tokens.spec.ts`: the fallback check still covers the tokens defined on `:root`, the safe areas and `--text-scale` now among them. The scoped ones (`--hero-base`, `--tint-*`, `--call-*`) exist only in their scope, so a component that can render outside it may give them a fallback.
- `global.css`: the standalone body backgrounds (`body:has([data-mode=…])`) are gone. The docs put their theme on `<html>` as the app does, so the body's `var(--surface-0)` follows it; in the app `<html>` carried the theme already, and the colours were the same.
- Docs: Foundations › Native platform (new section `native`): native light and dark previews (a hero card with its tints, a field, a call pill in `data-always-dark`) with their tokens read live, the safe-area and text sizes in px (read through a probe element, as a token holding calc() or env() reads back as written) at the app's four font sizes, and the call colours; Scales' type sizes read through a probe too, now that they hold a calc(). `Foundations` takes the docs' `accent`.
- Left for N2 / N3 / N14 (the app's `GAPS.md`): putting the attributes on the native root and `--text-scale` on `<html>`, the platform font scale, `viewport-fit=cover`, status-bar glyphs on calls.

## 2026-11-04 — ExploreCommunities for the app's Explore (8a), by hand
- `ExploreCommunity.avatarUrl` / `coverUrl`: the community's avatar and banner images, over the colour swatches (through `cssUrl`, as `NavRail`'s pins), which still show without them.
- `languageOptions` takes `ExploreLanguage`s (`{ code, label, flag? }`, the shape of `CreateGroupDialog`'s `languages`): the filter shows the label and the flag (the code's without one) and picks by code, which is what `ExploreQuery.languages` then carries. Without it the options are the loaded communities' languages, as before. `ExploreLanguage` is exported from `features/index.ts`.
- `initialQuery`, `initialLanguages`: the search text and languages it opens with (the host's URL, `?q=&lang=`, or its saved filter). An initial text counts as asked, so the `communities` passed show as its results, not "Searching…"; neither sends a query on opening.
- `initialScroll` and `onScroll`: the list's scroll position, so the host can bring a later visit back to where the last one left off.
- `failed`: the host couldn't load the page last asked for. A first page shows "Couldn't load communities" with a Retry (asking for it again as things stand) in place of the page before it, which would otherwise pass as its answer: under the search box in search mode (the result count says so too), in the table at home (no Popular, no rows, and the hero's count says so too); the search box, sort and languages stay as they were. A later page keeps the list, and Load more becomes Retry with "Couldn't load more". Strings `ui.exploreCommunities.loadFailed`, `loadFailedBody`, `loadMoreFailed`.
- What was last asked of the host records the languages and sort as well as the text (`lib/exploreAsk.ts`, `askedFor`, spec'd), and the search it opens with counts as asked. A page counts as the answer only for the search as it stands: after a language or sort change the search shows "Searching…" and home shows Loading (the hero's count too) until the host answers, and a failure shows only for the search that failed, so changing the languages takes its error down at once. The export compared the text alone.
- `lib/languages.ts`: `languageFlag` reads the older codes a host may still use (`cn`, `jp`, `iw`: the app's own), spec'd.
- `meta.json` updated.
- Not in the design export: to go back to it (the app's `GAPS.md` lists it).

## 2026-11-04 — ExploreCommunities: the list refreshes in place, and the search stays open while focused, by hand
- A sort or a language picked is asked of the host at once, and so is the home list when the search is left (Back, Esc); typing waits for a pause (an emptied text too, as it may be typed over), and the search already asked for isn't asked again (`askTiming`). A sort no longer empties the home view: until the host answers, a small spinner shows by the table's title, the rows stay (dimmed) for a new sort or languages, and the hero's count and Popular stay for a new sort. For other languages the hero's count waits ("Loading…") and Popular stays, dimmed and titled with the page's languages, until the answer: it's never mounted again, so its intro animation doesn't replay when filters are applied or cleared. A page left from a search is still never shown as "All communities": its rows wait too (`homeRefresh`, `HomeList`, `sameLanguages`; `lib/exploreAsk.ts`, spec'd).
- A click, a key or any other text in the hero's search (AltGr or Option characters, a paste, a drop, autofill; an IME's word once it's composed: while composing, the view and the host see no text yet, and a composition ended by clicking elsewhere or cancelled leaves nothing) opens the search view and moves the focus to its input in the same event, the caret after the text (a phone keeps its keyboard); focus alone (Tab) doesn't, so the keyboard reaches Popular and the list. Leaving blurs the input first, so its focus style doesn't outlive it. Opened by the user (or by focusing the search's input), it stays open, even emptied (a prompt, `ui.exploreCommunities.typeToSearch`, in place of results) or when something else on the screen is clicked, until Back or Esc (which clears it; with the language menu open, Esc only closes the menu). Text alone (the host's, from a URL) shows it only while there is text (`searchViewShown`). The clear button keeps the input focused. The hero's own clear button is gone (unreachable).
- Not in the design export: to go back to it (the app's `GAPS.md` lists it).
- `showSort` (default true): the home list's sorts. The app hides them until the backend can sort Explore (#10405).

## 2026-11-04 — CommunityPreviewBar (ported by hand), JoinGateDialog and ComposerBar for the app's join gate (8b), by hand
- **CommunityPreviewBar**, ported by hand from the design's 2026-11-04 export (`lib/CommunityPreviewBar.dc.html`, source hash `61a2b9f0`) into `src/features/components`: plain Svelte 5 (typed `Props`, runes, scoped SCSS on tokens, the mixins' `icon` and `focus-ring`), real `<button>`s for Back and Join, `role="region"` named "Previewing {name}". Copy under `ui.communityPreviewBar.*` (the gated hint's count is an ICU plural). The export's demo fallbacks are dropped: `community` is required, and without `grad` the avatar is the accent's gradient (tokens), not the prototype's purple. Back shows when there's an `onBack` or while `showBack` isn't false, as the export had it. By hand on top: `avatarUrl` (the community's avatar over `grad`, as `ExploreCommunities`), `busy` (a join on its way: a spinner in Join, which takes no clicks; the design has no in-progress state) and `joinDisabled` (e.g. a locked community: Join greyed). Exported from `features/index.ts`; in `export-manifest.json`, EXPORT.md and `meta.json`; a docs demo under Explore & sign-in (preview, gated, guest, joining).
- **JoinGateDialog**: a gate's `id`, handed back with its payment in `onJoin`'s `paid` (only when the gate has one), so the host approves the gate's own amount and knows which branch of an "any" gate was paid; `lifetime: false` on a diamond gate for any Diamond membership ("Diamond member", met for any member, "Get Diamond"); kind `other` (`label`, `detail`, `met`, `icon`), a requirement the host checked itself, shown met or to do with its own icon. `Gate` moved to the module script so a host can import it. New copy: `ui.joinGateDialog.diamondMember`, `diamondMemberPitch`, `getDiamondMember`, `isDiamond`. The export's own spec is unchanged.
- **ComposerBar**: `onBannerAction`, passed to `Banner`'s `actionHandler` (it took `bannerAction` as a label only).
- `meta.json` updated. Apart from CommunityPreviewBar itself, none of this is in the design export: to go back to it (the app's `GAPS.md` lists it).

## 2026-11-05 — MessageGroup for the app's message actions (5b), by hand
- `GroupMessage.menu`: whether the message has a menu and hover bar (with the group's `onMessageMenu`); by default every message but a deleted one, as before. The host can give a deleted message one (to reveal or undelete it) or take it from one it can't act on.
- The hover bar offers the quick reactions only with `onReact`, the 🙂 only with `onReactPicker` (the divider only with either), and Reply / Edit only with `onReply` / `onEdit`: in a chat where the reader can't react or reply it showed buttons that did nothing.
- `GroupMessage.swipeLeft` (`'edit' | 'reply' | 'forward'`): the host's say on a left swipe, which then calls `onSwipeLeft` (with the hint's icon for what it does), and a right swipe replies. The app's rule (`messageSwipeAction`, the mobile app's): right replies to any message, left edits the user's own (or replies where it can't be edited) and forwards anyone else's. Unset, the group's own mapping is unchanged (own text: right edits, left replies).
- No props changed (`meta.json` lists the group's own); `GroupMessage` gained the two fields. Not in the design export: to go back to it (the app's `GAPS.md` lists it).

## 2026-11-05 — MessageComposer mounted mid-edit (5b review), by hand
- Mounted already in edit mode (`context.mode === 'edit'`), the composer takes `text` as what was being written before the edit, and puts it back in the box when the edit ends, as it does for an edit started while it's mounted. It started from an empty box, and reported that to `onInput`, wiping the draft the host had put back. `meta.json`'s `text` doc says so. Not in the design export: to go back to it (the app's `GAPS.md` lists it).

## 2026-11-05 — SegmentedTabs compact size (native N2, #10365), by hand
- `size` (`'md' | 'sm'`, default `'md'`): `sm` is the compact bar, 40px (`--control-lg`) with a 3px inset and gap, in place of the native prototype's per-screen override (`--control-xl: 40px; --space-4: 3px` on a wrapper, `NativeApp.svelte`: the Chats filter and the settings screens' segmented rows), as the native design notes' §5 Open asks. `md` is unchanged.
- Docs: General › Inputs & controls shows the compact bar. `meta.json` updated.

## 2026-11-05 — native shell kit: tokens, TabBar, NativePageHeader (native N2, #10365), by hand
- New folder `src/native` (entry `src/native/index.ts`): the native shell kit, built by hand from the patterns the native prototype builds inline (`src/native/NativeApp.svelte` + `.logic.js`, source hash `db4b562b`, the 2026-11-03 export) to the native design notes (§1 Structure, Sheets / menus / toasts, Spacing; §2). Plain Svelte 5, no `.logic.js`; app-agnostic like `src/lib` (the lint rule that keeps app imports out of `src/lib` covers `src/native` too). Recorded in EXPORT.md's "Native shell kit" table and `export-manifest.json`'s `native`.
- tokens.css, the native layer: `--touch-target` (44px; 48px under `[data-os="android"]`, the notes' 44pt / 48dp), `--bar-end` (the safe area at the bottom, at least 12px: the prototype pads 34px on iOS, the home indicator's inset, and 12px on Android), `--tab-bar-h` (10px + the touch target + `--bar-end`), `--veil-sheet` (black 55%), `--veil-lift` (black 42%), `--shadow-sheet`, `--shadow-menu`, `--shadow-lift` (the prototype's, the same in both themes). The root carries `data-os="ios" | "android"` for the platform (N3 sets it). `platform.spec.ts` lists them with the native tokens and checks both platforms.
- `_mixins.scss`: the function `text-size($px)`, a type size with no `--text-*` token (the prototype's 15px, 14.5px …) times `--text-scale`, so the kit's text follows the native interface size as the tokens do.
- `haptics.ts`: `haptic('light')`, the host's haptics once installed with `setHaptics` (N3: the Tauri plugin), else a 10ms vibration where the browser has one; spec'd.
- **TabBar**: five (any number of) icon-only tabs, 20px icons in touch-target cells, `10px 6px var(--bar-end)` padding on `--surface-0` under a hairline; the selected tab in `--accent`, the rest `--ink-4`; an unread count pill (18px, `--accent`, ringed in `--surface-0`) and a 9px dot, at the prototype's offsets (inline-start, so they mirror in RTL); the user's photo (26px, `--line-2` ring, a 2px gap and a 2px accent ring when selected) in place of the icon when there is one. A tap bounces the icon (0.78 → 1.16 → 0.96 → 1 over 600ms, `cubic-bezier(.3,.7,.4,1)`, Web Animations as in the prototype; not with reduced motion) and gives a light haptic (the notes'). `onSelect` fires on every tap, the selected tab's included (the prototype pops that tab's stack to its root). A `tablist` of `button`s with arrow keys, named by the tab's label with its unread count or "new" (the prototype's had no name for either).
- **NativePageHeader**: back, title, trailing icon buttons and the kebab, in touch-target cells, padded at the top by `--safe-top` (the prototype's fixed 54px iOS / 4px Android status bar). Back is the chevron (22px) on iOS and the arrow on Android, the kebab (20px) `more` on iOS and `kebab` on Android (`data-os`), both mirrored in RTL. A pushed page's title is 17px bold (`--text-xl`), padding `safe-top 8px 6px 4px`; `size="lg"` is a tab root's title row (21px extra-bold, `safe-top + 8px` / 20px start padding); with an `avatar` it's the conversation's header (gap 2px, name 15.5px bold, sub line 12px `--ink-4`, the title a button for the details, `divider` for its hairline). Actions' icons are 22px (the prototype draws the phone at 21px). Titles truncate.
- Docs: a new group, **Native** (`groups/Native.svelte`, sections `native-*`, `docs/i18n/native.json`): an iOS / Android switch and each demo in a phone-sized native root (`NativeFrame.svelte`: `data-platform="native"`, `data-os`, the docs' mode and accent, and a transform so the kit's fixed layers stay inside it). Search lists the group. `meta.json` has the components (group `native`), and `meta.spec.ts` checks `src/native` too.

## 2026-11-05 — native shell kit: BottomSheet (native N2, #10365), by hand
- **BottomSheet** (`src/native`), from the prototype's sheets (`grabSheet`, `closeSheet`, the pick, poll-settings and referrer sheets) and the notes' §1 Sheets: a 48 × 4px handle (2px radius, `--overlay-3`, 8px from the top), `--surface-1`, 22px top radius, `--shadow-sheet`, over `--veil-sheet` (fades in over 260ms). It slides up in 320ms and down in 280ms (`--ease-out`, the prototype's `cubic-bezier(.2,.8,.2,1)`); the export's `oc-sheet-in` keyframe is the dialogs' fade-and-rise, as the prototype's own was dropped with its helmet, so the slide is the notes'. The handle and header drag it (`sheetDrag.ts`, spec'd): down it follows the finger, up it rubber-bands at a quarter of the pull, 24px at most; on release, past 30% of its height or a flick down (over 0.5px/ms in the last 100ms, past 12px) closes it, otherwise it springs back over 280ms; the veil lightens as it goes down (to 35% at most). Buttons and fields in the header keep their taps. Optional title row (52px, 14px semibold `--ink-3`) with an action (Done, 15.5px semibold `--accent`) and a `header` snippet; `height` fixes one height across content states (else it fits its content, up to 82%, the pick sheet's). It pads the bottom by the safe area; a fixed layer at `--z-modal`. Esc and the veil close it (`use:modal`, so the library's focus trap and dialog stack apply); focus moves into it and back to where it was. Reduced motion: no slide, fade or spring.
- `presence.svelte.ts`: an overlay that stays mounted while it leaves (`Presence`, spec'd), for the sheet and the long-press menu.
- Docs: Native › Bottom sheet, a settings sheet that fits its content and a picker whose search and confirm steps keep one 72% height.
- Left for N3 (the app's `GAPS.md`): Android's system back closing an open sheet first.

## 2026-11-05 — native shell kit: AnchoredMenu, LongPressMenu, NativeMenu (native N2, #10365), by hand
- **NativeMenu** (`src/native`), the menus' card, from the prototype's `menuItems` and the notes' §1: `--surface-2`, 16px radius, 6px padding, `--shadow-menu` and a `--line-1` ring; 48px rows (11px radius, 12px padding and gap) of a 19px icon and a 15px semibold label; danger rows in `--status-danger`; a divider (1px `--line-1`, 5px 6px margin) above the rows that ask for one; the current value ticked (16px `--accent` check) with its label in `--accent-bright` (the prototype's value menu); a submenu row shows a 13px chevron and replaces the rows in place under a back row (the submenu's title, bold, `--ink-3`, a back chevron). The value menu's rows were 46px in the prototype; they're 48px here, as the notes say. A `role="menu"` of buttons (`menuitemradio` with `aria-checked` for values), arrow keys between rows. It takes focus itself (not its first row, whose focus ring would show after a touch).
- **AnchoredMenu**, from the kebab and value menus (`openXMenu`, `openAM`): 4px under the anchor with its end edge 4px inside the anchor's, or, when it doesn't fit below and there's more room above, 4px over it (the prototype opened above only within 300px of the bottom, estimating 46px a row); it scrolls past the room it has, 12px from the edges, inside the safe areas (`menuPlacement.ts`, spec'd; inline offsets, so RTL mirrors). It scales in from the anchor's corner over 160ms (`--ease-out`; the prototype's `oc-menu-in` keyframe wasn't exported, so it's ours: from 92% and transparent). Min width 230px (the prototype's kebab menus; its value menus were 200px, its Chats menu 220px). A transparent layer closes it on a tap outside, Esc too (`use:modal`); focus goes back to the anchor. `onSelect` comes after `onClose`.
- **LongPressMenu**, from the row long-press menu (`lpH`, `openRowMenu`): over `--veil-lift` with a 6px blur (fading in over 200ms), the pressed row's copy lifts in place (16px radius, `--surface-1`, `--shadow-lift`, the row itself hidden meanwhile), and the 240px menu opens 8px under it, 8px in from its start, when there's 24px to spare below, else 8px over it, at least 12px from the frame's edges; a target narrower than 200px (a strip avatar) lifts as a 240px card, 66px tall, kept on screen (`liftPlacement`, spec'd). The copy is the host's `row` snippet, or a clone of the row. The menu scales in from its corner over 200ms after 40ms; the copy doesn't fade in but lifts (its shadow grows: the export has no keyframe for it, and fading it while the row hides would blink). A tap outside or Esc closes it, the veil, copy and menu fading together over 180ms, unmounted after 170ms (`Presence`). `open` / `target` as the sheet's `open`.
- `longPress.ts` (`LongPressGesture`, spec'd, and `use:longPress`): held 450ms without moving more than 10px (|dx| + |dy|), or a context menu (a right click; Android's own long-press, which doesn't open it twice), calls back with the row after a light haptic; the click that ends that press is swallowed, only that one. The row gets no text selection or iOS callout.
- Reduced motion: no scale or fade.
- Docs: Native › Anchored menu (a header's kebab with a Mute submenu and destructive rows; two value rows, the lower one opening above) and › Long-press menu (chat rows lifting as themselves; strip avatars lifting as a card).

## 2026-11-05 — native shell kit: the settings row kit (native N2, #10365), by hand
- From the prototype's settings screens (`settingsVals`: `sec`, `T`, `P`, `N`, `C`, `A`, segmented, swatch and meter rows) and the You tab's lists, to the notes' §1 Spacing and §3.11. One component per kind, each row carrying its own 16px padding; text in `text-size()`, so it follows the interface size.
- **SettingsGroup**: an optional `ListSectionLabel` 4px in, 8px above the card (`--overlay-1`, 16px radius), full-width 1px `--line-1` dividers between rows (every row's root carries `.settings-row`), and an optional note (12.5px, `--ink-4`) under it.
- **SettingsSwitch**: label and help with the library `Toggle`, at least 72px, 12px 16px padding; a tap anywhere on the row flips it. The prototype's settings screens passed the label and help to `Toggle` itself (12.5px / 11.5px, the web's sizes); here they're the row's (15px medium / 13px `--ink-3`, the prototype's poll-settings sheet), as the other rows' labels are 15px.
- **SettingsLink**: an optional 19px `--ink-3` icon (the You lists), the 15px label with optional help (12.5px `--ink-4`), the value at the end (13px `--ink-2`, at most 45%), a 14px chevron (right, mirrored in RTL; or down); at least 60px, 10px 16px padding (the You lists' rows were 52px). **SettingsValue** is a SettingsLink with the chevron down that opens an `AnchoredMenu` of its options from the row, the current one ticked (the prototype's `openAM`).
- **SettingsCopy**: a 10px mono label (`.09em`) over the value in 13px mono (wrapping anywhere, or `nowrap`), and a touch-target copy button (18px icon, `--ink-3`) that copies through `clipboard.ts` and turns into a `--status-online` tick for 1.6s; `onCopy` for the host's toast. At least 64px, `10px 4px 10px 16px` padding.
- **SettingsSegmented**: the 15px label over the compact `SegmentedTabs` (`size="sm"`), 10px apart, 14px 16px padding.
- **SettingsSwatches**: the label, then 30px swatches 10px apart; the picked one ringed `0 0 0 3px var(--surface-1), 0 0 0 5px` its colour; a radio group with arrow keys. The colours are the host's (`colour`, any CSS colour), the library has no hard-coded ones.
- **SettingsMeter**: the label and the amount (13px semibold mono, `--ink-2`), a 6px `--overlay-2` bar filled in `--accent` (easing over 300ms, not with reduced motion), optional help; `role="meter"`.
- **SettingsAction**: a 19px icon and a 15px semibold label in `--accent-bright`, or `--status-danger`; at least 52px. Undo for a destructive one is the host's toast.
- Docs: Native › Settings rows, an Appearance screen (segmented, swatches, switches, values) and a Settings one (links, copy, meters, actions). The platform switch is now a floating pill at the bottom right, so it no longer covers the sections' headings.

## 2026-11-05 — native shell kit: CodeTiles and Toasts (native N2, #10365), by hand
- **CodeTiles** (`src/native`), from Link to your account's code (`v.au.codeBoxes`, `onCode`, notes §3.1): `length` (6) tiles in a grid 8px apart, 68px tall, 14px radius, `--overlay-1`, 28px bold mono, over one invisible input (16px, so iOS doesn't zoom; `autocomplete="one-time-code"`, `autocapitalize="characters"`), so autofill, paste and typing go through one field. Text is normalised to capitals and digits, at most `length` (`codeTiles.ts`, spec'd), and `onComplete` fires when it's full. Rings (`codeTiles`, spec'd): the next tile 1.5px `--accent` with a 2px × 28px accent caret blinking each second (steady with reduced motion; the export has no `oc-blink` keyframe, so ours: hidden for the second half), filled tiles 1px `--line-2`, every tile 1.5px `--status-warning` on a refused code (`error`). The hint and Paste under it stay the host's.
- **Toasts**, from the prototype's toast (`toast`, `v.toastBottom`) and the notes' §1: the library's `UndoToast`, 12px from the sides, above the tab bar (`--tab-bar-h` + 14px: the prototype's 102px on iOS; on Android 84px where it had 80px, its tab bar height having taken a 44px target), a footer (`--bar-end` + 64px: a conversation's composer, a pinned button) or the safe area (`--bar-end` + 4px), over the FAB and the sheets. Undo (with the trash icon) on a destructive action's; others have no icon (the prototype asked for `info`, which UndoToast doesn't draw). The × dismisses. A replacement plays in again; it plays out when `toast` turns null. Reduced motion: no slide or fade.
- `toastQueue.svelte.ts` (`ToastQueue`, spec'd): the prototype's timing for a host without its own: one toast at a time, the new taking the old one's place, gone after 2.6s, or 5s with Undo; Undo runs the undo once, and a replaced toast's undo is dropped.
- Docs: Native › Code tiles (K7Q2XM links, any other full code is refused) and › Toasts (above the tab bar, a footer or the safe area; Undo on Archive).

## 2026-11-05 — native shell kit: review fixes (native N2, #10365, PR #10415), by hand
- **CodeTiles**: no `maxlength` on its input: a pasted or autofilled code with spaces or a dash (" K7Q-2XM ") was cut to 6 characters before `normaliseCode` dropped them; `normaliseCode` cuts to `length` itself.
- **BottomSheet**: no transform at rest (only while dragged, springing back or leaving). A transform made the sheet the containing block of the fixed layers inside it, so a `SettingsValue`'s menu in a sheet was confined to the sheet, and a tap above the sheet closed the sheet rather than the menu. The docs' settings sheet now has a value row.
- **LongPressMenu** placement (`liftPlacement`, spec'd): when the menu fits neither below nor above the row, it takes the roomier side and scrolls past a `maxHeight` (applied to the menu), never covering the lifted row; before, it went above from the top edge regardless and could cover the row or run off the bottom.
- **LongPressMenu** focus: back to the row after the menu is gone and the row is visible again (it went to `<body>` while the row was still hidden). Tab closes it, as Tab closes **AnchoredMenu** (focus back to the anchor), rather than moving focus behind the open menu; the lifted copy is `inert`, so a cloned row's buttons can't take focus.
- `longPress.ts`: only a pointer press swallows the click that ends it, so a keyboard context menu (the Menu key, Shift+F10) no longer eats the next Enter on the row; and every context menu outside a press opens the menu (a second right click, or the Menu key again, did nothing before the next pointer press). Spec'd.

## 2026-11-05 — Landing: a featured card's onOpen, the Android card's copy (9b, #10133, PR #10419), by hand
- **Landing**: `LandingCommunity` takes `onOpen`, called as a card's link is followed (a card with an `href` is an `<a>`, one without a `<div>`, the body shared as a snippet), so the host can remember where the community was opened from (the app sets the preview's origin, as Explore does). `meta.json`'s `communities` doc says so.
- **Landing**'s Android card no longer says the app is in beta: `ui.landing.apps.sub` reads "The Android app is out now, in two builds. …" and the pill is `ui.landing.apps.available` ("Available", was `betaOpen`, "Beta open"), as the Play listing is public.

## 2026-11-05 — MessageComposer's + menu and media tray for the app's attachments (5c), by hand
- `attachKinds` (`ComposerAttachKind[]`, now in `types.ts`): what the + menu offers, in its own order; all of them by default, as before, and no + button with none. The app offers photo / video and file until its builders for the others land, and only those the chat permits. `ComposerBar` passes it through.
- The media tray's add tile shows only with `onAddMedia` (still under 10 items): a host that sends one photo or video a message gives none, and the tile did nothing. The docs' Preview demo passes one.
- `meta.json` updated. Not in the design export: to go back to it (the app's `GAPS.md` lists it).

## 2026-11-05 — MessageComposer's voice format and size limit for the app's voice messages (5c), by hand
- `voiceMimeType`: what the recorder records in, where the browser supports it (`MediaRecorder.isTypeSupported`), else the browser's own as before. The app asks for mp4, which every device plays.
- `voiceMaxBytes`: with it the recorder hands its audio over in 200ms slices, counts it, and stops the take for review once it holds that much, saying so under the bar (`ui.messageComposer.voiceCapped`, "Recording stopped at the size limit."). Without it, nothing changes.
- `ComposerBar` passes both through. `meta.json` updated. Not in the design export: to go back to it (the app's `GAPS.md` lists it).

## 2026-11-05 — MessageComposer's mention list for the app's @mention picker (5c), by hand
- `onMentionQuery(query)`: the "@word" that ends at the caret ("@" at the start or after a space, then no space or "@"), without its "@", as it changes, and undefined once there's none (`lib/mentionQuery.ts`, `mentionAt`, spec'd). The caret is followed on input, key up, click and focus.
- `mentions` (`ComposerMention[]`, `types.ts`: `key`, `handle`, `name`, `avatar`, `group`): the host's candidates for it, listed over the text box (where the + menu opens, up to 264px then scrolling) while the text box has focus and neither the + menu, the picker nor a recording is open. A listbox the text box drives (`aria-autocomplete`, `aria-controls`, `aria-activedescendant`): ↑ ↓ move (the highlighted row stays in view), Enter or Tab pick, Esc closes it for that word (until the word is gone), a click picks without taking focus from the text box. A pick puts "@handle " in place of the word (`insertMention`, a space after it not doubled). A row: a 28px avatar (the image, else the user or group icon), the name, and "@handle" when it differs. New copy: `ui.messageComposer.mentions`.
- The design has no mention list: drawn as the composer's other popups (`--surface-2`, `--shadow-panel`, `--radius-lg`), rows 40px on `--overlay-1` when highlighted. `meta.json` updated. To go back to the design export (the app's `GAPS.md` lists it).

## 2026-11-05 — MessageComposer: the voice take's state for the host (5c review, PR #10420), by hand
- `onVoiceActive(active)`: true when a take starts (recording, then its review), false once it's over (sent, deleted, or the composer unmounted mid-take). The app holds back attachments meanwhile, since sending the take posts the draft. `ComposerBar` passes it through. `meta.json` updated. Not in the design export: to go back to it (the app's `GAPS.md` lists it).

## 2026-11-06 — VoiceMessage's sent look and MessageGroup's hover bar, by hand
- `VoiceMessage`: `side="sent"` was the received bubble with mirrored corners. It's now the sent bubble's colours (`--bubble-send-bg`, `--bubble-text` / `--bubble-text-soft` for the clock, the play button, the speed chip and the waveform's played bars) with the same shape as a received one, as ChatBubble's: every bubble is left-aligned. `mirror` (new) flips the corners for a right-aligned layout (mobile, native). The design export has no sent variant for it. `meta.json` updated.
- `MessageGroup`: the group showing a message's hover bar comes forward (`.raised`, z-index 1). The bar sits over the message before it, which a chat list laid out newest first (`VirtualChatList`, column-reverse) puts later in the document, in its own group's stacking context, so it painted over the bar.
- `VoiceMessage`: while it plays, a halo spreads from the play/pause button and fades (gone by two thirds of the way), every 1.44s (`::after`, `--voice-halo`: the accent, the bubble's text colour on a sent one); none with reduced motion. Not in the design.
- `ReactionChips` (new): ChatBubble's reaction chips as their own component (the same markup, fitting to `maxRows` with "+N", and styles), which ChatBubble now renders. `MessageGroup` puts it under every other kind of message (voice, media, file, link, transfer, swap, poll, prize), whose components take no reactions, so reacting to them now shows. In `lib/index.ts` and `meta.json`.

## 2026-11-05 — native: the push shadow (native N3, #10366), by hand
- tokens.css, the native layer: `--shadow-push`, the shadow a pushed screen casts on the screen it slides over (the prototype's stack screens: `-12px 0 32px rgba(0,0,0,.35)`, the same in both themes), on its start side: `[data-platform="native"][dir="rtl"]` mirrors it, as the native root (`<html>`) carries `dir` too. `platform.spec.ts` lists it with the shell's tokens and checks the mirroring.

## 2026-11-06 — the composer's "+" builders for the app (5d, #10119), by hand
- `SendCryptoDialog`: `to`, the member picked to start with (by id) for a new transfer, e.g. the one being replied to in a group; an `initial` transfer's own recipient still wins. `meta.json` updated. Not in the design export: to go back to it (the app's `GAPS.md` lists it).
- `PrizeBuilderDialog`: `pricing(token, amount, winners)` → `{ fees, min }`, the host's fees on top of the amount and its minimum (the export priced `fee × (winners + 1)` and `minPer × winners`, which stay the default); the amount's hint then reads `ui.prizeBuilderDialog.feesAdded` ("Fees of {fee} {symbol} are added on top", new). `defaults` (a `Partial<PrizeDraft>` a new prize starts from; `initial` still wins) and `restrictions` (the `PrizeGateKind`s offered, all by default). `meta.json` updated. Not in the design export.
- `SwapOfferDialog`: `depositFees(token)`, what an offer costs on top of its amount (the export priced two of the token's fees, still the default); `ui.swapOfferDialog.hint` and `locks` say "incl. fees" where they said "incl. 2 fees", since the host's may be more (the app's include the approval's). `meta.json` updated. Not in the design export.

## 2026-11-06 — the "+" builders' dialogs animate in and out (5d testing), by hand
- `PollBuilderDialog`, `PrizeBuilderDialog`, `SendCryptoDialog`, `SwapOfferDialog`: the library's shared dialog motion (global.css), which the export's builders lacked: the veil fades in (`oc-veil-in`) and the card rises in (`oc-dlg-in`); closing (×, Cancel, the backdrop, Esc, Discard) goes through a `DialogFlow` (`flow.dismiss(onClose)`, which Poll already had for publishing), so both play the exit (`oc-veil-out`, `oc-dlg-out`) before the host unmounts them. No prop changes.

## 2026-11-06 — sortable rows settle from the drop; the poll builder's settings grow and shrink (5d testing), by hand
- `SortableInputList`: letting go of a dragged row no longer snaps it back to its old slot and animates every row from there. On drop the rows take their new order with no transition, the dropped row starting where it was let go, and only it glides the rest of the way into its slot.
- `PollBuilderDialog`: the settings list grows open and shrinks closed (grid rows 0fr ↔ 1fr, as Learn's contents do) instead of appearing and vanishing; hidden once closed, so its toggles leave the tab order.

## 2026-11-06 — a poll answer doesn't rewrap when you vote (5d testing), by hand
- `PollMessage`: the percentage only appeared once the results showed, so voting narrowed every label and a long answer broke onto a second line. The percentage is now always laid out, as wide as "100%" (hidden until the results show), so the labels keep their width.

## 2026-11-06 — the prize builder's option rows grow and shrink (5d testing), by hand
- `PrizeBuilderDialog`: Winners, Ends after and Who can claim open in place by growing and close by shrinking (grid rows 0fr ↔ 1fr, as the poll builder's settings do), so moving from one row to another closes one while the other opens; the CHIT / streak picker under Who can claim does the same, keeping its chips while it shrinks. Closed panels are hidden, so they leave the tab order.

## 2026-11-06 — the prize card's sent look and its sending state (5d testing), by hand
- `PrizeMessage`: takes `side` (MessageGroup passes it, as for the other cards); a sent prize takes the sent bubble's colours through `--msg-*` variables, as `PollMessage` does, rather than always the received one. `sending` shows the card with "Sending prize…" and a spinner where Claim would go (`ui.prizeMessage.sending`). Both in meta.json.

## 2026-11-06 — swiping a run's first message takes its avatar and name along (5d testing), by hand
- `MessageGroup`: the avatar and name (`data-group-head`) follow the first message's swipe and spring back with it, rather than staying put while it slides away; that row's reply hint sits past the avatar (`past-avatar`), where before it came out over it.

## 2026-11-06 — the swap offer card's sending state (5d testing), by hand
- `SwapOffer`: `sending` shows the card with "Sending offer…" and a spinner where Cancel offer / Accept swap would go (`ui.swapOffer.sending`), as `PrizeMessage` does. In meta.json.

## 2026-11-06 — native: accent swatch tokens (native N4, #10367), by hand
- tokens.css: `--swatch-pink`, `--swatch-orange`, `--swatch-blue`, `--swatch-green` on `:root`: each accent as itself whatever the root's accent is, for an accent picker's swatches (`SettingsSwatches`' `colour`). An element's `--accent` is the root's, so an app couldn't name the other accents without hard-coding them. The values are the accents' dark ones (each family's `--dark-accent`). The native start's Appearance sheet uses them, and so does the docs' native settings demo (`nativeAccents`, which had the hex values).
- `BottomSheet`: the title's line height is 1.25 (was 1), as its one line is cut with overflow hidden, which clipped the descenders ("Language", "Appearance").

## 2026-11-06 — native: the swatches in each mode's shade, and a menu's pop (native N4, #10367), by hand
- tokens.css: the light mode's `--swatch-blue` and `--swatch-green` are the light accents (#3D8BFF, #16B583), so a swatch is the colour picking it gives; dark areas (`[data-always-dark]`) keep the dark ones. Pink and orange are the same in both.
- global.css: `oc-menu-pop` (from opacity 0, 4px down, 98%), a menu opening from its anchor: the native start's Appearance menu.

## 2026-11-06 — native Chats tab: ChatRow's favourite, the FAB's shadow, LongPressMenu's opening press (native N5a, #10368), by hand
- `ChatRow`: `fav`, an 11px accent heart (`heart-filled`) after the pin, before the muted bell, as the design's Component Changes have it ("`fav`, `muted`: row status icons"; the export's `ChatRow` has it, always off there). "Favourite" to screen readers (`ui.chatRow.favourite`). Off by default, so the web's rows don't change. `meta.json` updated.
- tokens.css, the native layer: `--shadow-fab`, the Chats tab's FAB's shadow (the prototype's `0 8px 24px rgba(0,0,0,.45), 0 2px 6px rgba(0,0,0,.3)`, the same in both themes); `platform.spec.ts` lists it with the shell's.
- `LongPressMenu`: a tap outside (Esc as before) closes it only when the press started on the veil. The press that opened the menu started on the row, under where the veil now is, and its release could end in a click on the veil (Chrome's touch emulation sends one after a long hold), which closed the menu as it opened. A press on the veil that ends in no click (a drag, a `pointercancel`) is forgotten when the press is cancelled and whenever the menu opens again, so it can't close the next opening.
- `ToastQueue.show` returns the toast's own dismiss: it takes that toast down early (its Undo can't work any more: the Chats screen sent the leave or delete as it went) and leaves a toast that has taken its place alone. Spec'd.
- Not in the design export: to go back to it (the app's `GAPS.md` lists it).

## 2026-11-07 — your own deleted message's corners on the web, by hand
- `ChatBubble`: the deleted placeholder took the right-aligned corners for your own message (`sent`) whatever the layout, so on the web, where every bubble sits on the inline-start side, yours looked mirrored. It now has the bubble's shape (the small corner at the start) whoever sent it, and the mirrored one only with `mirror` (your own on the inline-end side: mobile, native), as the bubble does. The corners are logical, so RTL follows.

## 2026-11-07 — native: NativeAlert, the design's small confirmation (native N12, #10380), by hand
- `NativeAlert` (src/native, exported from `native/index.ts`): the Design Notes' "Confirmations stay small alerts" (§1 Structure 4), which the prototype doesn't draw (it toasts instead). A card in the middle of the screen over the sheets' veil (`--veil-sheet`), `surface-1`, 20px radius, the menu's shadow: a title, an optional message, and Cancel and the action side by side (at least the touch target tall), the action in the accent or, with `danger`, in the library Button's danger look. The veil, Esc and Cancel dismiss it (`modal`; focus starts on Cancel and goes back after); `busy` holds both buttons while the action runs. It scales from 94% and fades in (220ms), and out in 180ms (`Presence`); it only fades with reduced motion. `meta.json` and the docs' Native group (Alert) have it.
- Not in the design export: to go back to it (the app's `GAPS.md` lists it).

## 2026-11-07 — native: NativeAlert as a notice (native N12 testing), by hand
- `NativeAlert`: `confirmLabel` and `onConfirm` are optional. Without an action it's a notice with the dismiss button alone (labelled `cancelLabel`), as the You tab's Diamond button uses while buying Diamond waits for the wallet's PIN sheet. `meta.json` updated. Not in the design export: to go back to it (the app's `GAPS.md` lists it).

## 2026-11-07 — native conversation: right-aligned sent messages, the inset swipe (native N5b, #10369), by hand
- `MessageGroup`: `mirror`, a sent run at the inline end (every kind: `.mirrored .message` justifies its items to the end) with `mirror` passed to `ChatBubble` and `VoiceMessage` (design notes §3.3, "sent bubbles right with mirrored corners"; the prototype lays sent messages out itself). `avatarSize` (34 by default; native groups 28, as the prototype's). `swipeStyle`: `gutter` (as before) or `inset`, the native swipe (notes §3.3, the Build Brief's late additions): the hint is a 32px circle with a 16px icon in the space the message frees, 4px in from the group's edge (past the avatar's column), fading and growing in (scale .6 → 1) as it's pulled; at 60px it's armed (accent, the icon `--on-accent`, a haptic, two bounces: none with reduced motion), and the pull stops at 90px. The prototype's `oc-swipe-arm` keyframes aren't in the export, so the bounces are ours. Hosts can set `--group-gap` (the avatar's gap; 10px by default, the prototype's 8px in native groups), `--group-ring` (the avatar's ring, `--surface-1` by default; the prototype's have none) and a marked row's tint: `--message-mark` (its colour: in-chat search's current match is accent-tinted in the prototype), `--message-mark-start` / `--message-mark-end` (how far it reaches past the message: -64px / -24px by default, the web's band) and `--message-mark-radius` (0; the prototype's is a rounded box 6px outside the row). `meta.json` updated.
- `ChatBubble`: with `mirror`, the bubble (and its reactions, its Retry line) sits at the inline end, as its doc said it was for; nothing set it before. `VoiceMessage` the same. `meta.json` updated.
- Not in the design export: to go back to it (the app's `GAPS.md` lists it).

## 2026-11-07 — native: a toast for an action on its way (native N5b testing, #10369), by hand
- `ToastQueue.showPending(message)`: a toast for an action still on its way (a block, whose Undo only works once it's in). It shows at once, in place of the one showing, with a small loader in place of its buttons, and stays until the action settles: `done(undo?)` gives the loader way to Undo (with `undo`) and the close, and starts the usual time (5s with Undo, 2.6s without); `failed()` takes it down. Settling does nothing to a toast that has taken its place, and Undo does nothing while it's pending. `NativeToast` has `pending`. Spec'd.
- `Toasts` (native): a pending toast shows the trash icon, as one with Undo does, and `UndoToast`'s loader.
- `UndoToast`: `busy`, a 16px `Spinner` in place of the action and the dismiss. `meta.json` updated (and Toasts' description).
- Not in the design export: to go back to it (the app's `GAPS.md` lists it).

## 2026-11-07 — a reply's quote goes to its message (native N5b testing, #10369), by hand
- `ChatBubble`: `onQuote`, the reply quote tapped (or Enter / Space on it): the quote is a button then, and the host goes to the quoted message. Without it the quote is only shown, as before. `meta.json` updated.
- Not in the design export: to go back to it (the app's `GAPS.md` lists it).

## 2026-11-07 — native: a toast tracks its operation to the end (native N5b testing, #10369), by hand
- `ToastQueue`: a toast waiting on an operation never times out; once the operation is done it shows its result with a fresh timer (5s with Undo, 2.6s without). `PendingToast.done({ message, undo })` changes the toast in place (the same `id`, so it doesn't play in again) to its result's words. Undo can run an operation of its own (`AsyncUndo`: `pending` words and `run`, resolving to the result's words, or nothing when it failed): the toast stays, waiting with the loader, then says how it went, or goes. A plain function Undo dismisses at once, as before. Spec'd (the timing rules).
- Not in the design export: to go back to it (the app's `GAPS.md` lists it).

## 2026-11-07 — pass 7: inverted toasts, ported by hand
- From the 2026-11-07 export (`pass-7-2026-11-07`: `UndoToast` from source hash `38a11686`, tokens from `a7be4345`); its `UndoToast.logic.js` and manifest not taken.
- Tokens (merged into ours, which have local additions): `--toast-bg`, `--toast-ink`, `--toast-ink-2`, `--toast-hover`, `--toast-shadow`, `--toast-success`, `--toast-success-soft` in each mode (dark's on `:where(:root)`, `[data-mode="dark"]` and `[data-always-dark]`); `--toast-action`, `--toast-action-soft`, `--toast-action-hover` for each accent, the other mode's bright accent: light mode's in the `[data-mode="light"][data-accent]` rules, dark mode's as `--dark-toast-action*` on each `[data-accent]` and mapped in the dark rule, so an always-dark area has the dark toast in its root's accent. Values as the export's. `platform.spec.ts` checks them (both modes, every accent, native or not, always-dark).
- `UndoToast`: an inverted snackbar, light in dark mode and dark in light mode, so it never reads as a received bubble: background, text, icons, dismiss and shadow from `--toast-*`, no `--surface-2` and no hairline. The success tone keeps the inverted base with the green only in the icon circle (`--toast-success` on `--toast-success-soft`; no green tint or border). The action in `--toast-action`: transparent at `md` (hover `--toast-action-soft`), on `--toast-action-soft` at `lg` (hover `--toast-action-hover`). `md` is at least 48px, with a 32px action and a 28px dismiss, `lg` 60px (36 / 32px); 14px radius and a 13px semibold message in both; the end padding 8px with something at the end, 14px without. New `detail`, a 12px line under the message in `--toast-ink-2`. Kept: the props and callbacks, `role="status"`, `aria-live="polite"`, the focus ring on the action and the dismiss (in `--toast-action`, which reads on the inverted background), and `busy` (its loader is the toast's ink, on a `--toast-hover` track). Padding is logical, so RTL mirrors it.
- Placement (the export's rule: a toast floats above sheets, dialogs and their veils, never inside them): `lib/toasts.svelte.ts` (new): `setToastHost` / `getToastHost`, and `ToastLayer` (one toast at a time, each gone after its own `duration`; the action and the × take it down, then run its callback; spec'd). `WalletMain` (a send's confirmation, a copied ledger ID or username), `WalletReceive` (a share's), `InviteDialog` (sent, added, reset, failed), `WalletPanel` (the hidden token's Undo, for as long as the undo window is open) and `ProfileDialog` (a sign-in method linked or unlinked, as `UndoToast` now, in place of its own toast) hand their toasts to the host when one provides a layer, and show them as before when none does (the docs).
- Docs: `meta.json` (UndoToast's `detail`, its description), `samples.ts` and General › UndoToast: the success / `lg` demo ("Sent 12.5 ICP to @lucy", "Confirmed in 2s", View).
- The native `Toasts` take it as it is: no accent edge (tried while testing native N5b, never merged), as the inverted toast is the design's answer to toasts reading as received bubbles.

## 2026-11-07 — the prize card while a claim is on its way, and its confetti on the win, by hand
- `PrizeMessage`: `claiming` shows "Claiming…" with a spinner where Claim would go (`ui.prizeMessage.claiming`), and a click then does nothing; the design had no state between the click and the win, and a claim takes seconds (a human check, then the payout). The confetti bursts when the card turns won while it shows, rather than on the click, which fired it for a claim that could still fail; a card that's already won when it mounts stays still. Without `onClaim` the click still marks it won, so the docs' demo bursts as before. `meta.json` updated.

## 2026-11-07 — threads: the panel takes the host's list and composer; every message kind's "N replies" (4c), by hand
- `ThreadPanel`: `list` and `composer` snippets, the host's own list of the replies and its own composer, in place of the panel's `MessageGroup`s and `MessageComposer`. The app lists a thread's replies with the same list as the conversation (paging, deep links, read marking, the message menu) and sends from the same composer, which the panel's own couldn't take. With a `list` the panel doesn't scroll it (the list scrolls itself) and `replyCount` gives "N people · N replies" its count. Without them the panel is as it was. `meta.json` updated.
- `ThreadLink` (new): `ChatBubble`'s "N replies · Last reply …" line as its own component, now also opened with Enter or Space. `ChatBubble` renders it, and `MessageGroup` renders it under every other kind of message (media, voice, file, transfer, poll, prize, swap), from the message's `threadCount`, `threadLastAt` and `onOpenThread` (moved to every `GroupMessage`), above its reaction chips (`afterThread`), as a text bubble has it. Only text bubbles had a thread link. `meta.json` updated.
- `behaviours/modal.ts`: `dialogOpen()`, whether a dialog is on the stack `DialogShell` and `use:modal` share, so a page's own Esc (the app's docked thread panel closing) leaves an Esc to the dialog over it.
- Not in the design export: to go back to it (the app's `GAPS.md` lists it).

## 2026-11-07 — threads: "N replies" as a card with faces and a selected state (4c), by hand
- `ThreadLink`: a card as wide as what it says (it stretched across a message's grid cell under the non-text kinds), aligned with the message's start, with the hairline border (`--line-2`) and pill corners. `faces` (CSS backgrounds) shows those in the thread as an `AvatarStack` (20px, "+N" past four) before "N replies" and "Last reply …"; without faces it keeps the reply icon. `selected` (its thread is the one open beside the conversation) outlines it in the accent over a 12% accent tint; `aria-current`. `ChatBubble` takes `threadFaces` / `threadSelected` for it and `MessageGroup` passes a message's `threadFaces` / `threadSelected` (both on `GroupMessage`). `meta.json` updated; the docs' Messages section shows one of each.
- Not in the design export: to go back to it (the app's `GAPS.md` lists it).
