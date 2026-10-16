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
