# OpenChat UI — Svelte 5 export

Last export **2026-10-13** (pass 2: library + app components + docs). First export 2026-10-07 (pass 1: library).
Package name: `@openchat/ui` (change in package.json if needed).

## Run
```
npm install
npm run dev      # docs page: Library / App tabs, live demo + props table per component, mode/accent switcher
npm run check    # svelte-check (types)
```

## Layout
- `src/lib/components/X.svelte` — **library** (app-agnostic) components. Markup + scoped CSS for hover/active/focus states, typed `Props`.
- `src/app/components/X.svelte` — **app** components: OpenChat screens, panels, dialogs and flows, built on the library. Entry: `src/app/index.ts`.
- `X.logic.js` next to each — the component's logic class, carried over verbatim from the prototype. `renderVals()` returns the view model the markup reads as `v`.
- `src/lib/dc/runtime.svelte.ts` — `useLogic()` binds a logic class to runes (setState → rerender, componentDidMount/DidUpdate/WillUnmount). `t()` text helper, `use:ref` for refs.
- `src/lib/styles/tokens.css` (+ generated `icons.css`), `global.css` (keyframes and global rules collected from components).
- `src/lib/icons.js` — canonical icon set; `Icon.svelte` or `mask: var(--icon-<name>)`.
- `src/lib/behaviours/a11y.js` and `tooltip.js` — imported once in `main.ts`.
- `src/docs/` — docs page, `meta.json` (props metadata + group), `samples.ts` (demo data).

## Conventions (same as the prototype)
- Theme on the app root only: `data-mode="dark|light"` + `data-accent="pink|orange|blue|green"`. Components take no theme props.
- Colours only through tokens. Callbacks: `onClick` activate · `onSelect(value)` pick · `onChange(value)` primary value · `onInput` text · `onClose` dismiss.
- Sizes `sm | md | lg`; numeric px only on Avatar, TokenAvatar, Icon, Spinner.

## How the conversion maps
- `{{ x }}` → `{v.x}` (text through `t()`), `<sc-for>` → `{#each}`, `<sc-if>` → `{#if}`, `<dc-import name="lib/X">` → `<X>` (kebab props → camelCase; a `style` on the import becomes a wrapping `<div>`; `key` → `{#key}`).
- `style-hover` / `style-focus` / … → a scoped class (`.dc-pN:hover{…}`); live values inside them go through CSS custom properties.
- React event props → DOM events (`onClick` → `onclick`; `onChange` on text inputs → `oninput`, matching React's per-keystroke behaviour).
- The converter itself lives in the prototype project (`export/tools/dc2svelte.js`), so re-exports are mechanical.

## Hand-edited during export
Re-exporting these overwrites the hand edits — re-apply them (they're small).
- **Spinner** — ring rendered as Svelte SVG markup (pass 1).
- **MemberRow** — typing dots rendered as markup (pass 1).
- **CallEvent** — live pulse tile as markup; `pulse()` removed from the logic (pass 2).
- **MiniCall** — status dot as markup; call timer ticks with `setInterval` + `forceUpdate` instead of a React hook (pass 2).
- **TokenCoin** — coin layers/faces as `{#each}` markup; logic rewritten to return plain data (pass 2).

## Converted to plain Svelte 5
No `.logic.js` and no `useLogic`: state in runes, view values in `$derived`, styles as scoped classes, typed props. Do not re-export these; port design changes by hand.
- **ActivityRow** — from source hash `ada8248e`.
- **AmountCard** — from source hash `39ed836c`.
- **Avatar** — from source hash `1f9bbb41`.
- **AvatarStack** — from source hash `5c9166f0`.
- **Badge** — from source hash `ac70dfd9`.
- **Banner** — from source hash `0beff5f6`.
- **Button** — from source hash `8b5cf575`.
- **ComposerBar** — from source hash `6f9180bd`.
- **Confetti** — from source hash `29b4b5be`.
- **CopyButton** — from source hash `454e21c1`.
- **Countdown** — from source hash `4ac813fd`.
- **DetailRow** — from source hash `10ca55c5`.
- **DetailSection** — from source hash `e0ad49a0`.
- **DialogShell** — from source hash `972fe63e`.
- **DurationChips** — from source hash `f945e31c`.
- **EmptyState** — from source hash `824a4c25`.
- **Field** — from source hash `5b2c7160`.
- **Icon** — from source hash `88fc81a7`.
- **LinkPreview** — from source hash `ebdc8a5b`.
- **ListSectionLabel** — from source hash `0ec0eea5`.
- **MenuItem** — from source hash `81252d62`.
- **PageHeader** — from source hash `5a474f84`.
- **PanelCover** — from source hash `8d024aca`.
- **PanelNavRow** — from source hash `f29bf4af`.
- **Pill** — from source hash `594a3b26`.
- **QuickAmountChips** — from source hash `a622f26e`.
- **RequirementChip** — from source hash `3ea36e0b`.
- **RoundIconButton** — from source hash `93c63369`.
- **ShareBar** — from source hash `d827e12e`.
- **SideCard** — from source hash `2385dab3`.
- **Skeleton** — from source hash `a4b6cf89`.
- **SnapFloat** — from source hash `87d22dad`.
- **Spinner** — from source hash `8547dbf9`.
- **StatCard** — from source hash `99b85629`.
- **StepIndicator** — from source hash `491490cf`.
- **SwapOffer** — from source hash `da54ba4f`.
- **ThresholdBar** — from source hash `3a0c0b95`.
- **TileButtons** — from source hash `58a09cd3`.
- **Toggle** — from source hash `4b90cec2`.
- **TokenAvatar** — from source hash `362ee2f9`.
- **TokenPicker** — from source hash `8699ab5d`.
- **Tooltip** — from source hash `27d349b2`.
- **TransactionRow** — from source hash `235ffaf2`.
- **TransferMessage** — from source hash `06196d3d`.
- **TypingIndicator** — from source hash `e4d33efe`.
- **UnreadDivider** — from source hash `d4f40e6e`.
- **Waveform** — from source hash `d43e3c8e`.

## Known gaps
- Not yet verified with `npm run build` / `svelte-check` — run both first and fix what they flag (expect a11y warnings on custom roles; they're intentional and covered by `a11y.js`).
- The app **shell** (`OpenChat App.dc.html`: layout, routing between chats/wallet/explore, call persistence, demo data) is not exported — only its components. Wire them in your own routes.
- App components still carry local sample data where the prototype did; move it to fixtures when connecting the backend.
- `Countdown` isn't used by the message bubbles yet (they take pre-formatted strings).

## Keeping in sync with the prototype
Every component file starts with a comment carrying the **source hash** of the prototype file it came from, and `export-manifest.json` lists source, hash, group and export date per component.
To update: in the prototype, ask to "re-export changed components" — each `lib/X.dc.html` is hashed (FNV-1a) and compared with the manifest; only changed ones are regenerated, and `EXPORT-LOG.md` gets a dated entry.
If you edit an exported component by hand, add it under "Hand-edited" so a re-export doesn't overwrite it blindly.

## Library (73)
| Component | Source | Source hash | Exported |
|---|---|---|---|
| ActivityRow | `lib/ActivityRow.dc.html` | `ada8248e` | 2026-10-07 |
| AmountCard | `lib/AmountCard.dc.html` | `39ed836c` | 2026-10-07 |
| Avatar | `lib/Avatar.dc.html` | `1f9bbb41` | 2026-10-07 |
| AvatarStack | `lib/AvatarStack.dc.html` | `5c9166f0` | 2026-10-13 |
| Badge | `lib/Badge.dc.html` | `ac70dfd9` | 2026-10-07 |
| Banner | `lib/Banner.dc.html` | `0beff5f6` | 2026-10-07 |
| Button | `lib/Button.dc.html` | `8b5cf575` | 2026-10-07 |
| CallEvent | `lib/CallEvent.dc.html` | `229acee3` | 2026-10-13 |
| ChatBubble | `lib/ChatBubble.dc.html` | `1c51c112` | 2026-10-13 |
| ChatPicker | `lib/ChatPicker.dc.html` | `3d01a726` | 2026-10-07 |
| ChatRow | `lib/ChatRow.dc.html` | `d9730629` | 2026-10-13 |
| ComposerBar | `lib/ComposerBar.dc.html` | `6f9180bd` | 2026-10-13 |
| Confetti | `lib/Confetti.dc.html` | `29b4b5be` | 2026-10-13 |
| ContextMenu | `lib/ContextMenu.dc.html` | `c325b36b` | 2026-10-07 |
| CopyButton | `lib/CopyButton.dc.html` | `454e21c1` | 2026-10-07 |
| Countdown | `lib/Countdown.dc.html` | `4ac813fd` | 2026-10-13 |
| DetailRow | `lib/DetailRow.dc.html` | `10ca55c5` | 2026-10-07 |
| DetailSection | `lib/DetailSection.dc.html` | `e0ad49a0` | 2026-10-07 |
| DialogShell | `lib/DialogShell.dc.html` | `972fe63e` | 2026-10-07 |
| DurationChips | `lib/DurationChips.dc.html` | `f945e31c` | 2026-10-07 |
| EmojiPicker | `lib/EmojiPicker.dc.html` | `20d1754a` | 2026-10-13 |
| EmptyState | `lib/EmptyState.dc.html` | `824a4c25` | 2026-10-07 |
| Field | `lib/Field.dc.html` | `5b2c7160` | 2026-10-07 |
| FileMessage | `lib/FileMessage.dc.html` | `1e982d63` | 2026-10-13 |
| Icon | `lib/Icon.dc.html` | `88fc81a7` | 2026-10-07 |
| IconButton | `lib/IconButton.dc.html` | `f00be3d6` | 2026-10-07 |
| LinkPreview | `lib/LinkPreview.dc.html` | `ebdc8a5b` | 2026-10-13 |
| ListSectionLabel | `lib/ListSectionLabel.dc.html` | `0ec0eea5` | 2026-10-07 |
| MediaMessage | `lib/MediaMessage.dc.html` | `67e8474e` | 2026-10-13 |
| MemberRow | `lib/MemberRow.dc.html` | `d9f8023f` | 2026-10-07 |
| Menu | `lib/Menu.dc.html` | `fd3b9a33` | 2026-10-07 |
| MenuItem | `lib/MenuItem.dc.html` | `81252d62` | 2026-10-07 |
| MessageActions | `lib/MessageActions.dc.html` | `b8b56d84` | 2026-10-13 |
| MessageComposer | `lib/MessageComposer.dc.html` | `4f18c46b` | 2026-10-13 |
| MessageGroup | `lib/MessageGroup.dc.html` | `39508894` | 2026-10-13 |
| PageHeader | `lib/PageHeader.dc.html` | `5a474f84` | 2026-10-07 |
| PanelCover | `lib/PanelCover.dc.html` | `8d024aca` | 2026-10-07 |
| PanelNavRow | `lib/PanelNavRow.dc.html` | `f29bf4af` | 2026-10-07 |
| Pill | `lib/Pill.dc.html` | `594a3b26` | 2026-10-07 |
| PollMessage | `lib/PollMessage.dc.html` | `19377bd9` | 2026-10-13 |
| PrizeMessage | `lib/PrizeMessage.dc.html` | `44eff81b` | 2026-10-13 |
| ProgressTimeline | `lib/ProgressTimeline.dc.html` | `90f18732` | 2026-10-07 |
| ProposalMessage | `lib/ProposalMessage.dc.html` | `e4139d49` | 2026-10-13 |
| QuickAmountChips | `lib/QuickAmountChips.dc.html` | `a622f26e` | 2026-10-07 |
| RequirementChip | `lib/RequirementChip.dc.html` | `3ea36e0b` | 2026-10-13 |
| RoundIconButton | `lib/RoundIconButton.dc.html` | `93c63369` | 2026-10-13 |
| SegmentedTabs | `lib/SegmentedTabs.dc.html` | `e4cc2aed` | 2026-10-07 |
| ShareBar | `lib/ShareBar.dc.html` | `d827e12e` | 2026-10-07 |
| SideCard | `lib/SideCard.dc.html` | `2385dab3` | 2026-10-07 |
| Skeleton | `lib/Skeleton.dc.html` | `a4b6cf89` | 2026-10-07 |
| SnapFloat | `lib/SnapFloat.dc.html` | `87d22dad` | 2026-10-13 |
| SortableInputList | `lib/SortableInputList.dc.html` | `eb476c6d` | 2026-10-13 |
| Spinner | `lib/Spinner.dc.html` | `8547dbf9` | 2026-10-07 |
| StatCard | `lib/StatCard.dc.html` | `99b85629` | 2026-10-07 |
| StatsDonut | `lib/StatsDonut.dc.html` | `44598fe9` | 2026-10-07 |
| StepIndicator | `lib/StepIndicator.dc.html` | `491490cf` | 2026-10-07 |
| SwapOffer | `lib/SwapOffer.dc.html` | `da54ba4f` | 2026-10-13 |
| TextArea | `lib/TextArea.dc.html` | `6aad1311` | 2026-10-07 |
| ThresholdBar | `lib/ThresholdBar.dc.html` | `3a0c0b95` | 2026-10-13 |
| TileButtons | `lib/TileButtons.dc.html` | `58a09cd3` | 2026-10-07 |
| TimedToggle | `lib/TimedToggle.dc.html` | `3ee63b57` | 2026-10-07 |
| Toggle | `lib/Toggle.dc.html` | `4b90cec2` | 2026-10-07 |
| TokenAvatar | `lib/TokenAvatar.dc.html` | `362ee2f9` | 2026-10-07 |
| TokenPicker | `lib/TokenPicker.dc.html` | `8699ab5d` | 2026-10-07 |
| Tooltip | `lib/Tooltip.dc.html` | `27d349b2` | 2026-10-07 |
| TransactionRow | `lib/TransactionRow.dc.html` | `235ffaf2` | 2026-10-13 |
| TransferMessage | `lib/TransferMessage.dc.html` | `06196d3d` | 2026-10-13 |
| TypingIndicator | `lib/TypingIndicator.dc.html` | `e4d33efe` | 2026-10-07 |
| UndoToast | `lib/UndoToast.dc.html` | `d1ec11e9` | 2026-10-07 |
| UnreadDivider | `lib/UnreadDivider.dc.html` | `d4f40e6e` | 2026-10-07 |
| UserChip | `lib/UserChip.dc.html` | `348ce6b7` | 2026-10-07 |
| VoiceMessage | `lib/VoiceMessage.dc.html` | `e210f6a8` | 2026-10-13 |
| Waveform | `lib/Waveform.dc.html` | `d43e3c8e` | 2026-10-13 |

## App (56)
| Component | Source | Source hash | Exported |
|---|---|---|---|
| AccessGates | `lib/AccessGates.dc.html` | `fceffeb8` | 2026-10-13 |
| AccessGatesCards | `lib/AccessGatesCards.dc.html` | `7f4effa4` | 2026-10-13 |
| AchievementsDialog | `lib/AchievementsDialog.dc.html` | `0faa1b00` | 2026-10-13 |
| AchievementToast | `lib/AchievementToast.dc.html` | `f37efbac` | 2026-10-13 |
| ActivityPanel | `lib/ActivityPanel.dc.html` | `937a1630` | 2026-10-13 |
| AuthDialog | `lib/AuthDialog.dc.html` | `f22ab84b` | 2026-10-13 |
| BalanceCard | `lib/BalanceCard.dc.html` | `34499a8e` | 2026-10-13 |
| BotDialog | `lib/BotDialog.dc.html` | `dccd49b7` | 2026-10-13 |
| CallPanel | `lib/CallPanel.dc.html` | `956d6791` | 2026-10-13 |
| ChatListHeader | `lib/ChatListHeader.dc.html` | `aa5b1850` | 2026-10-13 |
| ChatListPanel | `lib/ChatListPanel.dc.html` | `1eb60abb` | 2026-10-13 |
| ChitDialog | `lib/ChitDialog.dc.html` | `556edac8` | 2026-10-13 |
| ConversationHeader | `lib/ConversationHeader.dc.html` | `ccaba540` | 2026-10-13 |
| ConvertToCommunityDialog | `lib/ConvertToCommunityDialog.dc.html` | `a749f89a` | 2026-10-13 |
| CreateGroupDialog | `lib/CreateGroupDialog.dc.html` | `eedb6471` | 2026-10-13 |
| DailyPuzzleCard | `lib/DailyPuzzleCard.dc.html` | `022361e6` | 2026-10-13 |
| DeleteGroupDialog | `lib/DeleteGroupDialog.dc.html` | `e8ca1d1b` | 2026-10-13 |
| DiamondDialog | `lib/DiamondDialog.dc.html` | `39751360` | 2026-10-13 |
| DmChatSettings | `lib/DmChatSettings.dc.html` | `a1189237` | 2026-10-13 |
| DmPanel | `lib/DmPanel.dc.html` | `38415146` | 2026-10-13 |
| ExploreCommunities | `lib/ExploreCommunities.dc.html` | `8685dae7` | 2026-10-13 |
| GroupPanel | `lib/GroupPanel.dc.html` | `dba9b54f` | 2026-10-13 |
| GroupSettingsDialog | `lib/GroupSettingsDialog.dc.html` | `68b6847a` | 2026-10-13 |
| GroupStats | `lib/GroupStats.dc.html` | `def7d7a1` | 2026-10-13 |
| ImportToCommunityDialog | `lib/ImportToCommunityDialog.dc.html` | `601977ac` | 2026-10-13 |
| InfoPanel | `lib/InfoPanel.dc.html` | `e4f3dc4d` | 2026-10-13 |
| InviteDialog | `lib/InviteDialog.dc.html` | `408fbcd8` | 2026-10-13 |
| JoinGateDialog | `lib/JoinGateDialog.dc.html` | `3a62b79a` | 2026-10-13 |
| LeaderboardDialog | `lib/LeaderboardDialog.dc.html` | `b977d80f` | 2026-10-13 |
| LeaveGroupDialog | `lib/LeaveGroupDialog.dc.html` | `935490b2` | 2026-10-13 |
| MemeFighterDialog | `lib/MemeFighterDialog.dc.html` | `a1fc291c` | 2026-10-13 |
| MiniCall | `lib/MiniCall.dc.html` | `e6c8db6f` | 2026-10-13 |
| NavRail | `lib/NavRail.dc.html` | `42bdb472` | 2026-10-13 |
| NewChannelDialog | `lib/NewChannelDialog.dc.html` | `01911d9c` | 2026-10-13 |
| PollBuilderDialog | `lib/PollBuilderDialog.dc.html` | `4e7ef431` | 2026-10-13 |
| PrizeBuilderDialog | `lib/PrizeBuilderDialog.dc.html` | `5169413b` | 2026-10-13 |
| ProfileDialog | `lib/ProfileDialog.dc.html` | `3f17d9eb` | 2026-10-13 |
| PuzzleDialog | `lib/PuzzleDialog.dc.html` | `f417539c` | 2026-10-13 |
| SendCryptoDialog | `lib/SendCryptoDialog.dc.html` | `71f44ae8` | 2026-10-13 |
| StreakInsuranceDialog | `lib/StreakInsuranceDialog.dc.html` | `ba4875a6` | 2026-10-13 |
| SwapOfferDialog | `lib/SwapOfferDialog.dc.html` | `35fa8254` | 2026-10-13 |
| ThreadList | `lib/ThreadList.dc.html` | `4e4977fb` | 2026-10-13 |
| ThreadPanel | `lib/ThreadPanel.dc.html` | `e35352d5` | 2026-10-13 |
| TokenCoin | `lib/TokenCoin.dc.html` | `8398db54` | 2026-10-13 |
| UpgradeBanner | `lib/UpgradeBanner.dc.html` | `af894647` | 2026-10-13 |
| UserDialog | `lib/UserDialog.dc.html` | `47a5b5d4` | 2026-10-13 |
| UserGroupDialog | `lib/UserGroupDialog.dc.html` | `2c0cc062` | 2026-10-13 |
| VideoTile | `lib/VideoTile.dc.html` | `3d3f0853` | 2026-10-13 |
| WalletMain | `lib/WalletMain.dc.html` | `abda06dc` | 2026-10-13 |
| WalletPanel | `lib/WalletPanel.dc.html` | `464ebf46` | 2026-10-13 |
| WalletReceive | `lib/WalletReceive.dc.html` | `2b04c83d` | 2026-10-13 |
| WalletRecipients | `lib/WalletRecipients.dc.html` | `8d8543ca` | 2026-10-13 |
| WalletSend | `lib/WalletSend.dc.html` | `7681cb15` | 2026-10-13 |
| WalletSettingsDialog | `lib/WalletSettingsDialog.dc.html` | `a69b5e15` | 2026-10-13 |
| WalletSwap | `lib/WalletSwap.dc.html` | `9e10abdb` | 2026-10-13 |
| WebhookDialog | `lib/WebhookDialog.dc.html` | `af5a6630` | 2026-10-13 |
