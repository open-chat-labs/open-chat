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

