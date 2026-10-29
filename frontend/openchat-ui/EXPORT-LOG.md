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
