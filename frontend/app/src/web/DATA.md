# Data inventory

What each `@openchat/ui` screen needs and where it comes from in the app. "State" is a store or
state object exported from `@client` (most of it is in `openchat-client/src/state/app/stores.ts`),
or one in `app/src/stores`. "Client" is a method on `OpenChat` (`openchat-client/src/openchat.ts`).
Per the README, only the `XScreen` components read these; each screen's adapter maps them onto the
component's props. Missing data is listed in `GAPS.md`.

## Shared by every screen

- **Library conventions.**
  - Most times and amounts arrive as **formatted strings**, so adapters format them with the
    client's helpers (`formatMessageDate`, `toRelativeTime`, `formatTokens`). The exceptions are
    the wallet (numbers, `timestamp` in ms), calls (`start` in ms), polls and prizes (`endsAt`,
    `durationMs`).
  - A failable action returns a promise: the component waits, rolls back on reject and shows the
    error. Adapters return the client call's promise and reject on a failure response, since
    many client calls resolve with `{ kind: "failure" }` rather than throwing.
- **Pubsub.** The client also talks to the UI through events (`openchat-shared/src/utils/pubsub_events.ts`).
  The shell subscribes to the ones the existing `Home.svelte` handles:
  - navigation: `navigateTo`, `chatWith`, `closeModalStack`;
  - dialogs: `wallet`, `upgrade`, `profile`;
  - calls: `startVideoCall`, `hangup`, `askToSpeak`;
  - toasts: `showFailureToast` and friends;
  - messages: `sentMessage`, `loadedMessageWindow`.
- **Promise prompts** the shell renders:
  - PIN: `pinNumberResolverStore` / `pinNumberFailureStore` (resolve with the PIN);
  - rules acceptance: `captureRulesAcceptanceStore`.
- **Users.** Names, avatars and presence come from `userStore.get(id)`, `getDisplayName`,
  `userAvatarUrl` / `groupAvatarUrl` and `getUserStatus` (presence is a polled last-online time).
- **Theme and settings.**
  - The root already sets `data-mode` from `currentThemeMode`.
  - Font size: `fontScaleStore` / `fontSize`, still to be mapped onto `--text-*`.
  - Toggles: `app/src/stores/settings.ts` (enterSend, lowBandwidth, hideTokenBalances,
    chatListFilterStore …).
  - Locale: `setLocale`.

## Shell

| Component | Data | Actions |
|---|---|---|
| `NavRail` | **Pins:** `sortedCommunitiesStore` (avatar, name, unread dot from `unreadCommunityChannelCountsStore`). **Items:** unread counts (`unreadDirectAndGroupCountsStore`, `unreadFavouriteCountsStore`, `messageActivitySummaryStore.unreadCount`). **Profile:** `currentUserStore`, `currentUserProfileStore`. **CHIT:** `chitStateStore` (streak; claimable from `nextDailyChitClaim`), `dailyPuzzleStore` (puzzle due). **Guest:** `anonUserStore`. | Navigation only. `updateCommunityIndexes` if pins become reorderable. Create community: `startCommunityCreation`. |
| Toasts | `UndoToast` for undoable actions. `AchievementToast` driven by `achievementsStore` changes, then `markAchievementsSeen`. | |
| Calls overlay | `activeVideoCall`, `incomingVideoCall` (`app/src/stores/video.ts`) | see Calls |

## Chat list and threads (left)

| Component | Data | Actions |
|---|---|---|
| `ChatListPanel` rows | **Rows:** `chatSummariesListStore` (scope from the route; pinned first), mapped per row from `ChatSummary`:<br>- title / avatar: `getDisplayName` or the group name, `userAvatarUrl` / `groupAvatarUrl`;<br>- preview: `getContentAsText(latestMessage)`;<br>- time: `formatMessageDate`;<br>- unread: `unreadMessageCount`;<br>- muted: `membership.notificationsMuted`;<br>- pinned: `pinnedChatsStore`;<br>- typing: `typing.byContext` (selected chat only, see `GAPS.md`);<br>- live call: `videoCallInProgress`;<br>- online: `getUserStatus`.<br>**Filter** (all / unread / DMs / groups): `chatListFilterStore`, applied in the adapter. | Select: navigate to `routeForChatIdentifier`. Row menu: `pinChat` / `unpinChat`, `toggleMuteNotifications`, `archiveChat`, `addToFavourites` / `removeFromFavourites`, `markAllRead`. Search: `chatMatchesSearch` locally, plus `searchGroups` / `searchUsers` for results outside the list. |
| `ChatListHeader` (community) | `selectedCommunitySummaryStore` (name, visibility, member count, avatar). Permission flags from `canEditCommunity`, `canCreateChannel`, `canInviteUsers`. | Mark all read: `markAllReadForCurrentScope`. Leave: `leaveCommunity`. The rest open dialogs. |
| `ThreadList` | `threadsByChatStore`, `threadsFollowedByMeStore`, `threadPreviews(threadsByChat)`, `unreadThreadMessageCount` | Open: navigate to `routeForMessageContext(…, open=true)` |

## Conversation (middle)

| Component | Data | Actions |
|---|---|---|
| `ConversationHeader` | **Chat:** `selectedChatSummaryStore` (title, kind, member count, `notificationsMuted`, `atEveryoneMuted`). **Favourite:** `favouritesStore`. **DM presence:** `getUserStatus`. **Flags:** `canInviteUsers`, `canStartVideoCalls`. | Menu: `addToFavourites`, `toggleMuteNotifications`, `blockUserFromDirectChat`, `deleteDirectChat`, `leaveGroup`, copy URL. Calls: `startVideoCall` pubsub / `CallSession`. |
| Message list (`MessageGroup`, `UnreadDivider`, `CallEvent`, bubbles) | **Events:** `eventsStore` (with the loaded ranges in `eventIndexesLoadedStore`), grouped with `groupEvents` / `TimelineGrouper`. **Unread divider:** the window anchor from `setSelectedChat` plus `isMessageRead`. **Deep link:** `messageIndexStore`. **Local:** `failedMessagesStore`, `unconfirmedStore` (sending / failed status), `translationsStore`, `selectedChatExpandedDeletedMessageStore`. **Proposals:** `proposalVotesStore`, `proposalTopicsStore`. | **Load:** `loadPreviousMessages`, `loadNewMessages`, `loadEventWindow`. **Read:** `markMessageRead`. **React:** `selectReaction`. **Poll:** `registerPollVote`. **Prize:** `claimPrize`. **Swap:** `acceptP2PSwap` / `cancelP2PSwap`. **Proposal:** `voteOnProposal`. **Retry:** `sendMessageWithContent(… retryId)` / `deleteFailedMessage`. **Media:** `messageContentFromFile`, downloads. |
| `MessageActions` | Permissions: `messagePermissionsForSelectedChatStore`, `canForward`, `contentTypeSupportsEdit`. Recent reactions: `quickReactions`. | `deleteMessage` / `undeleteMessage`, `pinMessage` / `unpinMessage`, `forwardMessage` (`messageToForwardStore`), `translateMessage`, `reportMessage`, `tipMessage`, `setMessageReminder`, `hideLinkPreview` |
| `ComposerBar` / `MessageComposer` | **Draft:** `selectedChatDraftMessageStore` (text, reply, edit, attachment). **Typing:** `typing.byContext` → `getTypingString`. **Banner:** `canSendMessage`, rules (`captureRulesAcceptanceStore`), lapsed / frozen / preview state. **Mentions:** `findMembersToMention`. | **Send:** `sendMessageWithAttachment`. **Edit:** `editMessageWithAttachment`. **Rich content:** `sendMessageWithContent` (poll, prize, P2P swap, giphy, meme). **Transfers:** `sendCryptoTransfer`. **Voice:** `messageContentFromFile` plus `quantiseWaveform`. **Typing:** `startTyping` / `stopTyping`. **Draft:** `localUpdates.draftMessages.*`. |
| Composer "+" dialogs | **Tokens:** `walletTokensSorted` (balances, fees, decimals). **Members** (prize / transfer recipient): `selectedChatMembersStore`. **Meme templates:** `utils/memeFighter.ts`. | They attach to the composer. Adapters map `Prize` / `SwapOffer` / `Transfer` / `PollDraft` onto `PrizeContentInitial`, `P2PSwapContentInitial`, `PendingCryptocurrencyTransfer` and `PollContent`. Existing form logic: `CryptoTransferForm`. |

## Right column

| Component | Data | Actions |
|---|---|---|
| `GroupPanel` | **Details:** `selectedChatSummaryStore` / `selectedCommunitySummaryStore`. **Members:** `selectedChatMembersStore` / `selectedCommunityMembersStore`, with the blocked, lapsed and invited variants. **Bots and webhooks:** `selectedChatBotsStore`, `selectedChatWebhooksStore`. **User groups:** `selectedCommunityUserGroupsStore`. **Pinned:** `selectedChatPinnedMessagesStore`. **Rules:** `selectedChatRulesStore`. **Gates:** `gateConfig`. **Stats:** `metrics`. **Viewer role and `can*` flags:** the client's permission predicates. | **Members:** `changeRole` / `changeCommunityRole`, `removeMember` / `removeCommunityMember`, `blockUser` / `unblockUser` (and the community variants). **Pinned:** `unpinMessage`. **Notifications:** `toggleMuteNotifications`, `addToFavourites`. **Search:** `findMembers`. The rest open dialogs. |
| `DmPanel` / `UserDialog` | **User:** `userStore.get`, `getPublicProfile`, `getBio`, `getUserStatus`. **Chat:** the DM's summary (muted, favourite, `eventsTTL`). **Blocked:** `blockedUsersStore`. | `toggleMuteNotifications`, `addToFavourites`, `updateDirectChatSettings` (disappearing), `blockUserFromDirectChat` / `unblockUserFromDirectChat` |
| `ThreadPanel` | **Thread:** `threadEventsStore`, `selectedThreadIdStore`, root event, `threadsFollowedByMeStore`, `selectedThreadDraftMessageStore`. | `openThread`, `loadThreadMessages`, `markThreadRead`, `followThread`. Sends as in the composer, with `threadRootMessageIndex`. |

## Dialogs

| Dialog | Data | Actions |
|---|---|---|
| `GroupSettingsDialog` (Manage) | The summary and details above, read and written through `UpdateGroupState` / `UpdateCommunityState` (`components_shared/…`). Gate tokens: `cryptoLookup`, `nervousSystemLookup`. | `updateGroup` / `updateCommunity` (`groupChanges` / `communityChanges`), `checkUsername`-style name checks |
| `CreateGroupDialog` · `NewChannelDialog` | **People:** `searchUsersForInvite`. **Diamond:** `isDiamondStore`. **Languages:** the existing language list. | `createCandidateGroup` → `createGroup`, `createCommunity` |
| `InviteDialog` | Invite link from `getInviteLink`. Community members for channel adds. | `inviteUsers`, `addMembersToChannel`, `setInviteLinkEnabled`, `resetInviteLink`, `inviteLinkUrl`; share to chat via `sendMessageWithContent` |
| `LeaveGroupDialog` · `DeleteGroupDialog` · `ConvertToCommunityDialog` · `ImportToCommunityDialog` | Summary; the user's communities | `leaveGroup` / `leaveCommunity`, `deleteGroup` / `deleteCommunity`, `convertGroupToCommunity`, `importToCommunity` |
| `UserGroupDialog` | `selectedCommunityUserGroupsStore`, members | `createUserGroup`, `updateUserGroup`, `deleteUserGroup` |
| `BotDialog` · `WebhookDialog` | `getBotDefinition`, `botState`; existing install logic in `BotInstall` | `installBot`, `updateInstalledBot`, `uninstallBot`, `registerWebhook`, `updateWebhook`, `regenerateWebhook`, `deleteWebhook` |
| `JoinGateDialog` | `accessGatesForChat`, `GateEvaluation` (`components_shared/home/access`), `walletTokensSorted` | `joinCommunity` / `joinGroup` with a gate check, `approveAccessGatePayments`, `verifyAccessGate` |
| `ProfileDialog` | **Profile:** `currentUserStore`, `currentUserProfileStore`. **CHIT:** `chitStateStore`. **Storage:** `storageStore`. **Moderation flags:** `moderationFlagsEnabledStore`. **Linked sign-ins:** `getAuthenticationPrincipals`. **Settings:** `stores/settings.ts`, theme stores. **Referrals:** `referralsStore`. | **Profile:** `saveProfile`, `setUserAvatar`, `setUserProfileBackground`, `checkUsername`. **Moderation:** `setModerationFlags`. **Linking:** `linkIdentities`, `removeIdentityLink`, `createAccountLinkingCode`. **Account:** `deleteCurrentUser`, `logout`. |
| `DiamondDialog` | `diamondStatusStore`, `diamondMembershipFees`, balances | `payForDiamondMembership` |
| `ChitDialog` · `LeaderboardDialog` · `AchievementsDialog` · `StreakInsuranceDialog` | `chitStateStore`, `achievementsStore` plus the `achievements` catalogue, `streakInsuranceStore`, `chitLeaderboard` | `claimDailyChit`, `payForStreakInsurance` (`streakInsurancePrice`), `chitEvents` for history |
| `PuzzleDialog` | `dailyPuzzleStore`, `todaysPuzzle`, `utils/dailyPuzzle.svelte.ts` | `dailyPuzzleStart`, `dailyPuzzleSubmit`, `dailyPuzzleHint`, `dailyPuzzleSaveGrid` |
| `AuthDialog` (pages and in-app sign-in) | `identityStateStore`, `selectedAuthProviderStore`, `?auth` | **II / NFID:** `login`. **Passkey:** `signInWithWebAuthn` / `signUpWithWebAuthn`. **Email:** `EmailSigninHandler`. **ETH / SOL:** `siwe` / `siwsPrepareLogin` then `signInWithWallet`. **Sign-up:** `registerUser`. These don't return a promise that settles on sign-in, so the adapter resolves when `identityStateStore` reaches `logged_in` / `registering`. |

## Explore and activity

| Component | Data | Actions |
|---|---|---|
| `ExploreCommunities` | `exploreCommunities(term, page, size, flags, languages)` → `CommunityMatch`; joined from `communitiesStore`; `exploreCommunitiesFiltersStore` | `onQuery` → `exploreCommunities` (page size 6). Preview: navigate to `/community/:id`. |
| `ActivityPanel` | `subscribeToMessageActivityFeed` (or the existing `activityFeedState` rune), `messageActivitySummaryStore`. Kinds: mention, reaction, quote_reply, tip, crypto, poll_vote, p2p_swap_accepted. | Open: navigate to `routeForMessage`. Mark read: `markActivityFeedRead(timestamp)`, a single high-water mark (see `GAPS.md`). |

## Wallet

| Component | Data | Actions |
|---|---|---|
| `WalletPanel` | **Tokens:** `walletTokensSorted` and `enhancedCryptoLookup` (balance, USD from `exchangeRatesLookupStore`). **Config:** `walletConfigStore` (auto/manual, min value). **Hide balances:** `hideTokenBalances`. | `refreshAccountBalance`, `refreshBalancesInSeries`, `setWalletConfig`, `removeTokenFromWallet` |
| `WalletMain` token page and activity | **History:** `getAccountTransactions(index canister, fromId)` per token (`utils/transactionHistory.ts`). **Facts:** `cryptoLookup` (fee, standard, ledger). | |
| `WalletSend` | **Contacts:** `searchUsers`, plus DMs as recent contacts. **Saved recipients:** `namedAccountsStore`. **BTC fees:** `getCkbtcMinterWithdrawalInfo`. **Networks:** `oneSecGetNetworks`. | **In chat:** `sendCryptoTransfer` to a user. **Out:** `withdraw({ledger, route, to, amount, fee})`, which prompts for the PIN via `pinNumberResolverStore`. **Existing logic:** `TransferForm` / `WithdrawForm`. |
| `WalletReceive` | **Account:** `currentUserIdStore` (ICRC account). **Addresses:** `getBtcAddress`, `getSolAddress`, `getOneSecAddress` (`bitcoinAddress`, `solanaAddress`, `oneSecAddress`). **Deposits:** `getCkbtcMinterDepositInfo`, `getCksolMinterDepositInfo`. | Share to chat: `sendMessageWithContent` |
| `WalletSwap` | `swappableTokensStore`, `getTokenSwaps`, `swapRestricted` | `getSwapQuote` → quote, `swapTokens(quote, …, onStep)` (existing `SwapForm`). Quotes come from several DEXes, not only ICPSwap (see `GAPS.md`). |
| `WalletRecipients` · `WalletSettingsDialog` | `namedAccountsStore`, `walletConfigStore`, `pinNumberRequiredStore` | `saveCryptoAccount`, `deleteCryptoAccount`, `setWalletConfig`, `setPinNumber` |

## Calls

| Component | Data | Actions |
|---|---|---|
| `CallPanel` · `MiniCall` · `CallEvent` | **Call:** `activeVideoCall` (status, chat, view, owner, type), `incomingVideoCall`. **Devices:** `microphone`, `camera`, `sharing`. **Participants:** `videoCallParticipants` (polled). **In chat lists:** `ChatSummary.videoCallInProgress`. | `CallSession.startOrJoin` / `hangup` / `askToSpeak` (`components_shared/home/video/callSession.svelte.ts`), `endVideoCall`, `declineVideoCall`, `setVideoCallPresence`. The tiles need Daily's call-object mode (see `GAPS.md`). |
