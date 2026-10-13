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
