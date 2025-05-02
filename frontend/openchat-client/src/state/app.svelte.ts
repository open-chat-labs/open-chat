import { dequal } from "dequal";
import type DRange from "drange";
import {
    ANON_USER_ID,
    anonymousUser,
    applyOptionUpdate,
    type ChannelSummary,
    type ChatEvent,
    type ChatIdentifier,
    chatIdentifiersEqual,
    type ChatListScope,
    chatListScopesEqual,
    ChatMap,
    ChatSet,
    type ChatSummary,
    type ChitState,
    type CombinedUnreadCounts,
    type CommunityFilter,
    type CommunityIdentifier,
    communityIdentifiersEqual,
    CommunityMap,
    type CommunitySummary,
    type CreatedUser,
    type DirectChatIdentifier,
    type DirectChatSummary,
    emptyChatMetrics,
    type EventWrapper,
    type ExternalBotPermissions,
    type GroupChatSummary,
    type IdentityState,
    type Member,
    mergeListOfCombinedUnreadCounts,
    type MessageActivitySummary,
    type MessageContext,
    messageContextsEqual,
    type ModerationFlag,
    ModerationFlags,
    type PublicApiKeyDetails,
    type ReadonlyMap,
    type Referral,
    SafeMap,
    type StreakInsurance,
    type ThreadIdentifier,
    type UserGroupDetails,
    type UserGroupSummary,
    type VersionedRules,
    type VideoCallCounts,
    videoCallsInProgressForChats,
    type WalletConfig,
    type WebhookDetails,
} from "openchat-shared";
import { type PinnedByScope } from "../stores";
import { mergeChatMetrics, mergePermissions } from "../utils/chat";
import { chatDetailsLocalUpdates, ChatDetailsMergedState } from "./chat_details";
import { ChatDetailsServerState } from "./chat_details/server.svelte";
import { communityLocalUpdates } from "./community_details";
import { CommunityMergedState } from "./community_details/merged.svelte";
import { CommunityServerState } from "./community_details/server.svelte";
import { localUpdates } from "./global";
import { pathState } from "./path.svelte";
import { withEqCheck } from "./reactivity.svelte";
import { messagesRead } from "./unread/markRead.svelte";

export class AppState {
    constructor() {
        $effect.root(() => {
            $effect(() => {
                if (this.#selectedCommunityId === undefined) {
                    this.#selectedCommunity = new CommunityMergedState(
                        CommunityServerState.empty(),
                    );
                }
            });

            $effect(() => {
                if (this.#selectedChatId === undefined) {
                    this.#selectedChat = new ChatDetailsMergedState(ChatDetailsServerState.empty());
                }
            });
        });
    }

    #communityFilterToString(filter: CommunityFilter): string {
        return JSON.stringify({
            ...filter,
            languages: Array.from(filter.languages),
        });
    }

    #communityFilterFromString(serialised: string | null): CommunityFilter | undefined {
        if (!serialised) return undefined;
        const parsed = JSON.parse(serialised);
        return {
            languages: new Set(parsed.languages),
        };
    }

    #initialiseCommunityFilter() {
        return (
            this.#communityFilterFromString(localStorage.getItem("openchat_community_filters")) ?? {
                languages: new Set<string>(),
            }
        );
    }

    #communityFilters = $state<CommunityFilter>(this.#initialiseCommunityFilter());

    #currentUser = $state<CreatedUser>(anonymousUser());

    #currentUserId = $derived(this.#currentUser.userId);

    #anonUser = $derived(this.#currentUserId === ANON_USER_ID);

    #suspendedUser = $derived(this.#currentUser.suspensionDetails !== undefined);

    #platformModerator = $derived(this.#currentUser.isPlatformModerator);

    #platformOperator = $derived(this.#currentUser.isPlatformOperator);

    #diamondStatus = $derived(this.#currentUser.diamondStatus);

    #isDiamond = $derived(
        this.#diamondStatus.kind === "lifetime" ||
            (this.#diamondStatus.kind === "active" && this.#diamondStatus.expiresAt > Date.now()),
    );

    #isLifetimeDiamond = $derived(this.#diamondStatus.kind === "lifetime");

    #canExtendDiamond = $derived(this.#diamondStatus.kind === "active");

    hasFlag(mask: number, flag: ModerationFlag): boolean {
        return (mask & flag) !== 0;
    }

    #moderationFlagsEnabled = $derived(this.#currentUser.moderationFlagsEnabled);

    #adultEnabled = $derived(this.hasFlag(this.#moderationFlagsEnabled, ModerationFlags.Adult));

    #offensiveEnabled = $derived(
        this.hasFlag(this.#moderationFlagsEnabled, ModerationFlags.Offensive),
    );

    #underReviewEnabled = $derived(
        this.hasFlag(this.#moderationFlagsEnabled, ModerationFlags.UnderReview),
    );

    #achievements = $state<Set<string>>(new Set());

    #referrals = $state<Referral[]>([]);

    #exploreCommunitiesFilters = $derived({
        languages: Array.from(this.#communityFilters.languages),
        flags: this.#moderationFlagsEnabled,
    });

    #serverMessageActivitySummary = $state<MessageActivitySummary>({
        readUpToTimestamp: 0n,
        latestTimestamp: 0n,
        unreadCount: 0,
    });

    #messageActivitySummary = $derived.by(() => {
        if (
            localUpdates.messageActivityFeedReadUpTo !== undefined &&
            localUpdates.messageActivityFeedReadUpTo >=
                this.#serverMessageActivitySummary.latestTimestamp
        ) {
            return {
                ...this.#serverMessageActivitySummary,
                unreadCount: 0,
            };
        }
        return this.#serverMessageActivitySummary;
    });

    #chitState = $state<ChitState>({
        chitBalance: 0,
        totalChitEarned: 0,
        streak: 0,
        streakEnds: 0n,
        nextDailyChitClaim: 0n,
    });

    #serverStreakInsurance = $state<StreakInsurance>({
        daysInsured: 0,
        daysMissed: 0,
    });

    #streakInsurance = $derived(localUpdates.streakInsurance ?? this.#serverStreakInsurance);

    #serverWalletConfig = $state<WalletConfig>({
        kind: "auto_wallet",
        minDollarValue: 0,
    });

    #walletConfig = $derived(localUpdates.walletConfig ?? this.#serverWalletConfig);

    #serverDirectChatBots = $state<SafeMap<string, ExternalBotPermissions>>(new SafeMap());

    #directChatBots = $derived.by(() => {
        return localUpdates.directChatBots.apply(this.#serverDirectChatBots);
    });

    #serverDirectChatApiKeys = $state<Map<string, PublicApiKeyDetails>>(new Map());

    #directChatApiKeys = $derived.by(() => {
        return this.#serverDirectChatApiKeys;
    });

    #serverDirectChats = $state<ChatMap<DirectChatSummary>>(new ChatMap());

    #serverGroupChats = $state<ChatMap<GroupChatSummary>>(new ChatMap());

    #serverFavourites = $state<ChatSet>(new ChatSet());

    #favourites = $derived.by(() => {
        return localUpdates.favourites.apply(this.#serverFavourites);
    });

    #unreadGroupCounts = $derived.by(() => {
        return messagesRead.combinedUnreadCountForChats(this.#serverGroupChats);
    });

    #unreadDirectCounts = $derived.by(() => {
        return messagesRead.combinedUnreadCountForChats(this.#serverDirectChats);
    });

    #unreadFavouriteCounts = $derived.by(() => {
        const chats = ChatMap.fromList(
            [...this.serverFavourites.values()]
                .map((id) => this.#allServerChats.get(id))
                .filter((chat) => chat !== undefined) as ChatSummary[],
        );
        return messagesRead.combinedUnreadCountForChats(chats);
    });

    #unreadCommunityChannelCounts = $derived.by(() => {
        return this.#serverCommunities.reduce((map, [id, community]) => {
            map.set(
                id,
                messagesRead.combinedUnreadCountForChats(ChatMap.fromList(community.channels)),
            );
            return map;
        }, new CommunityMap<CombinedUnreadCounts>());
    });

    #globalUnreadCount = $derived.by(() => {
        return mergeListOfCombinedUnreadCounts([
            this.#unreadGroupCounts,
            this.#unreadDirectCounts,
            mergeListOfCombinedUnreadCounts(
                Array.from(this.#unreadCommunityChannelCounts.values()),
            ),
        ]);
    });

    #serverCommunities = $state<CommunityMap<CommunitySummary>>(new CommunityMap());

    #allServerChats = $derived.by(() => {
        const groupChats = this.#serverGroupChats.values();
        const directChats = this.#serverDirectChats.values();
        const channels = [...this.#serverCommunities.values()].flatMap((c) => c.channels);
        return ChatMap.fromList([...groupChats, ...directChats, ...channels]);
    });

    #userMetrics = $derived.by(() => {
        const empty = emptyChatMetrics();
        return this.#allServerChats.reduce((res, [_, chat]) => {
            return mergeChatMetrics(res, chat.membership?.myMetrics ?? empty);
        }, empty);
    });

    #applyLocalUpdatesToChat(chat: ChatSummary): ChatSummary {
        const local = chatDetailsLocalUpdates.get(chat.id);
        chat.membership.notificationsMuted =
            local?.notificationsMuted ?? chat.membership.notificationsMuted;
        chat.membership.archived = local?.archived ?? chat.membership.archived;
        chat.membership.rulesAccepted = local?.rulesAccepted ?? chat.membership.rulesAccepted;
        const latestMessage =
            (local?.latestMessage?.timestamp ?? BigInt(-1)) >
            (chat.latestMessage?.timestamp ?? BigInt(-1))
                ? local?.latestMessage
                : chat.latestMessage;
        const latestEventIndex = Math.max(latestMessage?.index ?? 0, chat.latestEventIndex);
        chat.latestMessage = latestMessage;
        chat.latestMessageIndex = latestMessage?.event?.messageIndex;
        chat.latestEventIndex = latestEventIndex;
        if (chat.kind !== "direct_chat") {
            chat.frozen = local?.frozen ?? chat.frozen;
            chat.name = local?.name ?? chat.name;
            chat.description = local?.description ?? chat.description;
            chat.permissions = mergePermissions(chat.permissions, local?.permissions);
            chat.gateConfig.gate = { ...chat.gateConfig.gate, ...local?.gateConfig?.gate };
            chat.gateConfig.expiry = local?.gateConfig?.expiry ?? chat.gateConfig.expiry;
            chat.eventsTTL = local?.eventsTTL
                ? applyOptionUpdate(chat.eventsTTL, local.eventsTTL)
                : chat.eventsTTL;
        }
        return chat;
    }

    // this is all server chats + previews with local updates applied.
    #allChats = $derived.by(() => {
        const withPreviews = this.#allServerChats
            .merge(localUpdates.uninitialisedDirectChats)
            .merge(localUpdates.groupChatPreviews);
        const withUpdates = localUpdates.chats.apply(withPreviews);
        return withUpdates.reduce((result, [chatId, chat]) => {
            result.set(chatId, this.#applyLocalUpdatesToChat(chat));
            return result;
        }, new ChatMap<ChatSummary>());
    });

    // all chats filtered by scope including previews and local updates
    #scopedChats = $derived.by(() => {
        switch (this.#chatListScope.kind) {
            case "community": {
                const communityId = this.#chatListScope.id.communityId;
                return this.#allChats.filter(
                    (c) => c.kind === "channel" && c.id.communityId === communityId,
                );
            }
            case "group_chat":
                return this.#allChats.filter((c) => c.kind === "group_chat");
            case "direct_chat":
                return this.#allChats.filter((c) => c.kind === "direct_chat");
            case "favourite": {
                return [...this.favourites.values()].reduce((favs, chatId) => {
                    const chat = this.#allChats.get(chatId);
                    if (chat !== undefined) {
                        favs.set(chat.id, chat);
                    }
                    return favs;
                }, new ChatMap<ChatSummary>());
            }
            default:
                return new ChatMap<ChatSummary>();
        }
    });

    #serverPinnedChats = $state<Map<ChatListScope["kind"], ChatIdentifier[]>>(new Map());

    #pinnedChats = $derived.by(() => {
        const mergedPinned = new Map(this.#serverPinnedChats);

        for (const [chatId, localState] of chatDetailsLocalUpdates.entries()) {
            const updates = localState.pinnedToScopes;
            for (const scope of updates.added) {
                const ids = mergedPinned.get(scope) ?? [];
                if (!ids.find((id) => chatIdentifiersEqual(id, chatId))) {
                    ids.unshift(chatId);
                }
                mergedPinned.set(scope, ids);
            }
            for (const scope of updates.removed) {
                const ids = mergedPinned.get(scope) ?? [];
                mergedPinned.set(
                    scope,
                    ids.filter((id) => !chatIdentifiersEqual(id, chatId)),
                );
            }
        }

        return mergedPinned;
    });

    #communities = $derived.by(() => {
        const merged = localUpdates.communities.apply(this.#serverCommunities);
        for (const c of localUpdates.previewCommunities.values()) {
            merged.set(c.id, c);
        }
        return merged.map((communityId, community) => {
            const updates = communityLocalUpdates.get(communityId);
            const index = updates?.index;
            if (index !== undefined) {
                community.membership.index = index;
            }
            community.membership.displayName = applyOptionUpdate(
                community.membership.displayName,
                updates?.displayName,
            );
            community.membership.rulesAccepted =
                updates?.rulesAccepted ?? community.membership.rulesAccepted;
            return community;
        });
    });

    #sortedCommunities = $derived.by(() => {
        return [...this.#communities.values()].toSorted((a, b) => {
            return b.membership.index === a.membership.index
                ? b.memberCount - a.memberCount
                : b.membership.index - a.membership.index;
        });
    });

    #nextCommunityIndex = $derived((this.#sortedCommunities[0]?.membership?.index ?? -1) + 1);

    #userGroupSummaries = $derived.by(() => {
        return [...this.#communities.values()].reduce((map, community) => {
            community.userGroups.forEach((ug) => map.set(ug.id, ug));
            return map;
        }, new Map<number, UserGroupSummary>());
    });

    #communityChannelVideoCallCounts = $derived.by(() => {
        return this.#communities.reduce((map, [id, community]) => {
            map.set(id, videoCallsInProgressForChats(community.channels));
            return map;
        }, new CommunityMap<VideoCallCounts>());
    });

    //TODO should this be operating on merged group chats?
    #groupVideoCallCounts = $derived.by(() => {
        return videoCallsInProgressForChats([...this.#serverGroupChats.values()]);
    });

    //TODO should this be operating on merged group chats?
    #directVideoCallCounts = $derived.by(() => {
        return videoCallsInProgressForChats([...this.#serverDirectChats.values()]);
    });

    //TODO should this be operating on merged group chats?
    #favouritesVideoCallCounts = $derived.by(() => {
        const chats = [...this.#favourites.values()].map((id) => this.#allServerChats.get(id));
        return videoCallsInProgressForChats(chats);
    });

    #identityState = $state<IdentityState>({ kind: "loading_user" });

    #chatsInitialised = $state(false);

    // TODO - this does not seem to be working as intended - investigate why
    #chatListScope = $derived.by(withEqCheck(() => pathState.route.scope, chatListScopesEqual));

    // TODO - not sure this currently works with *starting* threads
    // I feel uneasy about this as a *concept* because if I have a chat open *and* a thread open then there are two
    // selected message contexts. So this is at best misleading and at worst meaningless.
    #selectedMessageContext = $derived.by<MessageContext | undefined>(
        withEqCheck(() => {
            switch (pathState.route.kind) {
                case "selected_channel_route":
                case "global_chat_selected_route":
                    return {
                        chatId: pathState.route.chatId,
                        threadRootMessageIndex: pathState.route.open
                            ? pathState.route.messageIndex
                            : undefined,
                    };
                default:
                    return undefined;
            }
        }, messageContextsEqual),
    );

    #selectedChatId = $derived.by<ChatIdentifier | undefined>(
        withEqCheck(() => this.#selectedMessageContext?.chatId, chatIdentifiersEqual),
    );

    #selectedServerChatSummary = $derived.by(() => {
        return this.#selectedChatId ? this.#allServerChats.get(this.#selectedChatId) : undefined;
    });

    #selectedCommunityId = $derived.by<CommunityIdentifier | undefined>(
        withEqCheck(() => {
            switch (pathState.route.scope.kind) {
                case "community":
                    return pathState.route.scope.id;
                case "favourite":
                    return pathState.route.scope.communityId;
                default:
                    return undefined;
            }
        }, communityIdentifiersEqual),
    );

    #selectedCommunitySummary = $derived.by<CommunitySummary | undefined>(
        withEqCheck(() => {
            if (this.#chatListScope.kind === "community") {
                return this.#communities.get(this.#chatListScope.id);
            } else if (
                this.#chatListScope.kind === "favourite" &&
                this.#chatListScope.communityId
            ) {
                return this.#communities.get(this.#chatListScope.communityId);
            } else {
                return undefined;
            }
        }, dequal),
    );

    #selectedCommunity = $state<CommunityMergedState>(
        new CommunityMergedState(CommunityServerState.empty()),
    );

    #selectedChat = $state<ChatDetailsMergedState>(
        new ChatDetailsMergedState(ChatDetailsServerState.empty()),
    );

    setCurrentUser(user: CreatedUser) {
        this.#currentUser = user;
    }

    get communityFilters() {
        return this.#communityFilters;
    }

    get exploreCommunitiesFilters() {
        return this.#exploreCommunitiesFilters;
    }

    toggleCommunityFilterLanguage(lang: string) {
        if (this.#communityFilters.languages.has(lang)) {
            this.#communityFilters.languages.delete(lang);
        } else {
            this.#communityFilters.languages.add(lang);
        }
        localStorage.setItem(
            "openchat_community_filters",
            this.#communityFilterToString(this.#communityFilters),
        );
    }

    get currentUser() {
        return this.#currentUser;
    }

    get currentUserId() {
        return this.#currentUserId;
    }

    get anonUser() {
        return this.#anonUser;
    }

    get suspendedUser() {
        return this.#suspendedUser;
    }

    get platformModerator() {
        return this.#platformModerator;
    }

    get platformOperator() {
        return this.#platformOperator;
    }

    get diamondStatus() {
        return this.#diamondStatus;
    }

    get isDiamond() {
        return this.#isDiamond;
    }

    get isLifetimeDiamond() {
        return this.#isLifetimeDiamond;
    }

    get canExtendDiamond() {
        return this.#canExtendDiamond;
    }

    get moderationFlagsEnabled() {
        return this.#moderationFlagsEnabled;
    }

    get adultEnabled() {
        return this.#adultEnabled;
    }

    get offensiveEnabled() {
        return this.#offensiveEnabled;
    }

    get underReviewEnabled() {
        return this.#underReviewEnabled;
    }

    get allServerChats() {
        return this.#allServerChats;
    }

    get allChats() {
        return this.#allChats;
    }

    get selectedServerChatSummary() {
        return this.#selectedServerChatSummary;
    }

    get userMetrics() {
        return this.#userMetrics;
    }

    get unreadGroupCounts() {
        return this.#unreadGroupCounts;
    }

    get unreadDirectCounts() {
        return this.#unreadDirectCounts;
    }

    get unreadFavouriteCounts() {
        return this.#unreadFavouriteCounts;
    }

    get unreadCommunityChannelCounts() {
        return this.#unreadCommunityChannelCounts;
    }

    get globalUnreadCount() {
        return this.#globalUnreadCount;
    }

    set serverMessageActivitySummary(val: MessageActivitySummary) {
        this.#serverMessageActivitySummary = val;
    }

    get achievements() {
        return this.#achievements;
    }

    set achievements(val: Set<string>) {
        this.#achievements = val;
    }

    get referrals() {
        return this.#referrals;
    }

    set referrals(val: Referral[]) {
        this.#referrals = val;
    }

    get messageActivitySummary() {
        return this.#messageActivitySummary;
    }

    get chitState() {
        return this.#chitState;
    }

    updateChitState(fn: (s: ChitState) => ChitState) {
        this.#chitState = fn(this.#chitState);
    }

    get streakInsurance() {
        return this.#streakInsurance;
    }

    set serverStreakInsurance(val: StreakInsurance) {
        this.#serverStreakInsurance = val;
    }

    get serverStreakInsurance() {
        return this.#serverStreakInsurance;
    }

    set serverWalletConfig(val: WalletConfig) {
        this.#serverWalletConfig = val;
    }

    get walletConfig() {
        return this.#walletConfig;
    }

    get directChatBots() {
        return this.#directChatBots;
    }

    set directChatBots(val: SafeMap<string, ExternalBotPermissions>) {
        this.#serverDirectChatBots = val;
    }

    get directChatApiKeys() {
        return this.#directChatApiKeys;
    }

    set directChatApiKeys(val: Map<string, PublicApiKeyDetails>) {
        this.#serverDirectChatApiKeys = val;
    }

    get pinnedChats(): Map<ChatListScope["kind"], ChatIdentifier[]> {
        return this.#pinnedChats;
    }

    get identityState(): Readonly<IdentityState> {
        return this.#identityState;
    }

    updateIdentityState(fn: (prev: IdentityState) => IdentityState) {
        this.#identityState = fn(this.#identityState);
    }

    get nextCommunityIndex() {
        return this.#nextCommunityIndex;
    }

    get chatsInitialised() {
        return this.#chatsInitialised;
    }

    get chatListScope() {
        return this.#chatListScope;
    }

    set chatsInitialised(val: boolean) {
        this.#chatsInitialised = val;
    }

    get selectedCommunityId() {
        return this.#selectedCommunityId;
    }

    get selectedChatId() {
        return this.#selectedChatId;
    }

    get selectedMessageContext() {
        return this.#selectedMessageContext;
    }

    get selectedCommunity() {
        return this.#selectedCommunity;
    }

    get selectedCommunitySummary() {
        return this.#selectedCommunitySummary;
    }

    get selectedChat() {
        return this.#selectedChat;
    }

    setSelectedThread(id: ThreadIdentifier) {
        this.#selectedChat.setSelectedThread(id);
    }

    updateServerThreadEvents(
        id: ThreadIdentifier,
        fn: (existing: EventWrapper<ChatEvent>[]) => EventWrapper<ChatEvent>[],
    ) {
        this.#selectedChat.updateServerThreadEvents(id, fn);
    }

    updateServerEvents(
        chatId: ChatIdentifier,
        fn: (existing: EventWrapper<ChatEvent>[]) => EventWrapper<ChatEvent>[],
    ) {
        this.#selectedChat.updateServerEvents(chatId, fn);
    }

    updateServerExpiredEventRanges(chatId: ChatIdentifier, fn: (existing: DRange) => DRange) {
        this.#selectedChat.updateServerExpiredEventRanges(chatId, fn);
    }

    clearServerEvents() {
        this.#selectedChat.clearServerEvents();
    }

    clearSelectedChat() {
        this.#selectedChat = new ChatDetailsMergedState(ChatDetailsServerState.empty());
    }

    setSelectedChat(chatId: ChatIdentifier) {
        if (chatIdentifiersEqual(chatId, this.#selectedChat.chatId)) {
            console.warn(
                "We are trying to setSelectedChat for the same chat we already have selected. This probably indicates that some effect is firing when it shouldn't",
                chatId,
            );
            return;
        }
        const serverState = ChatDetailsServerState.empty(chatId);
        this.#selectedChat = new ChatDetailsMergedState(serverState);
    }

    setDirectChatDetails(chatId: DirectChatIdentifier, currentUserId: string) {
        if (!chatIdentifiersEqual(chatId, this.#selectedChatId)) {
            console.warn(
                "Attempting to set direct chat details on the wrong chat - probably a stale response",
                chatId,
                this.#selectedChatId,
            );
            return;
        }
        this.#selectedChat.addUserIds([currentUserId]);
    }

    setChatDetailsFromServer(
        chatId: ChatIdentifier,
        members: Map<string, Member>,
        lapsedMembers: Set<string>,
        blockedUsers: Set<string>,
        invitedUsers: Set<string>,
        pinnedMessages: Set<number>,
        rules: VersionedRules,
        bots: Map<string, ExternalBotPermissions>,
        apiKeys: Map<string, PublicApiKeyDetails>,
        webhooks: WebhookDetails[],
    ) {
        if (!chatIdentifiersEqual(chatId, this.#selectedChatId)) {
            console.warn(
                "Attempting to set chat details on the wrong chat - probably a stale response",
                chatId,
                this.#selectedChatId,
            );
            return;
        }
        this.#selectedChat.overwriteChatDetails(
            chatId,
            members,
            lapsedMembers,
            blockedUsers,
            invitedUsers,
            pinnedMessages,
            rules,
            bots,
            apiKeys,
            webhooks,
        );
    }

    setSelectedCommunity(communityId: CommunityIdentifier) {
        const serverState = CommunityServerState.empty(communityId);
        this.#selectedCommunity = new CommunityMergedState(serverState);
    }

    setCommunityDetailsFromServer(
        communityId: CommunityIdentifier,
        userGroups: Map<number, UserGroupDetails>,
        members: Map<string, Member>,
        blockedUsers: Set<string>,
        lapsedMembers: Set<string>,
        invitedUsers: Set<string>,
        referrals: Set<string>,
        bots: Map<string, ExternalBotPermissions>,
        apiKeys: Map<string, PublicApiKeyDetails>,
        rules?: VersionedRules,
    ) {
        if (!communityIdentifiersEqual(communityId, this.#selectedCommunityId)) {
            console.warn(
                "Attempting to set community details on the wrong community - probably a stale response",
                communityId,
                this.#selectedCommunityId,
            );
            return;
        }

        this.#selectedCommunity.overwriteCommunityDetails(
            communityId,
            userGroups,
            members,
            blockedUsers,
            lapsedMembers,
            invitedUsers,
            referrals,
            bots,
            apiKeys,
            rules,
        );
    }

    get serverDirectChats() {
        return this.#serverDirectChats;
    }

    set serverDirectChats(val: ChatMap<DirectChatSummary>) {
        this.#serverDirectChats = val;
    }

    get serverGroupChats() {
        return this.#serverGroupChats;
    }

    set serverGroupChats(val: ChatMap<GroupChatSummary>) {
        this.#serverGroupChats = val;
    }

    get serverFavourites() {
        return this.#serverFavourites;
    }

    get favourites() {
        return this.#favourites;
    }

    get groupChats() {
        // TODO - this will ultimately include local updates
        return this.#serverGroupChats;
    }

    get directChats() {
        // TODO - this will ultimately include local updates
        return this.#serverDirectChats;
    }

    set serverFavourites(val: ChatSet) {
        this.#serverFavourites = val;
    }

    set serverCommunities(val: CommunityMap<CommunitySummary>) {
        this.#serverCommunities = val;
    }

    set serverPinnedChats(val: Map<ChatListScope["kind"], ChatIdentifier[]>) {
        this.#serverPinnedChats = val;
    }

    get serverCommunities() {
        return this.#serverCommunities;
    }

    get scopedChats() {
        return this.#scopedChats;
    }

    get communities() {
        return this.#communities;
    }

    get sortedCommunities() {
        return this.#sortedCommunities;
    }

    get userGroupSummaries(): ReadonlyMap<number, UserGroupSummary> {
        return this.#userGroupSummaries;
    }

    get communityChannelVideoCallCounts(): ReadonlyMap<CommunityIdentifier, VideoCallCounts> {
        return this.#communityChannelVideoCallCounts;
    }

    get groupVideoCallCounts(): VideoCallCounts {
        return this.#groupVideoCallCounts;
    }

    get directVideoCallCounts(): VideoCallCounts {
        return this.#directVideoCallCounts;
    }

    get favouritesVideoCallCounts(): VideoCallCounts {
        return this.#favouritesVideoCallCounts;
    }

    isPreviewingCommunity(id: CommunityIdentifier) {
        return localUpdates.isPreviewingCommunity(id);
    }

    getPreviewingCommunity(id: CommunityIdentifier) {
        return localUpdates.getPreviewingCommunity(id);
    }

    setGlobalState(
        communities: CommunitySummary[],
        allChats: ChatSummary[],
        favourites: ChatIdentifier[],
        pinnedChats: PinnedByScope,
        achievements: Set<string>,
        chitState: ChitState,
        referrals: Referral[],
        walletConfig: WalletConfig,
        messageActivitySummary: MessageActivitySummary,
        installedBots: Map<string, ExternalBotPermissions>,
        apiKeys: Map<string, PublicApiKeyDetails>,
        streakInsurance: StreakInsurance | undefined,
    ): void {
        const [channelsMap, directChats, groupChats] = partitionChats(allChats);

        const communitiesMap = CommunityMap.fromList(communities);
        const directChatsMap = ChatMap.fromList(directChats);
        const groupChatsMap = ChatMap.fromList(groupChats);
        const favouritesSet = new ChatSet(favourites);
        for (const [communityId, channels] of channelsMap) {
            const community = communitiesMap.get(communityId);
            if (community !== undefined) {
                community.channels = channels;
            }
        }

        // ideally we would get rid of the setters for all of these server runes because setting
        // them individually is a mistake. But we also want to be able to set them from tests.
        // I'll try to lock this down a bit more later.
        this.#serverMessageActivitySummary = messageActivitySummary;
        this.#achievements = achievements;
        this.#referrals = referrals;
        this.#serverDirectChats = directChatsMap;
        this.#serverGroupChats = groupChatsMap;
        this.#serverFavourites = favouritesSet;
        this.#serverCommunities = communitiesMap;
        this.#serverPinnedChats = pinnedChats;
        this.#directChatApiKeys = apiKeys;
        this.#directChatBots = SafeMap.fromEntries(installedBots.entries());
        this.#serverWalletConfig = walletConfig;
        if (streakInsurance !== undefined) {
            this.#serverStreakInsurance = streakInsurance;
        }
        this.updateChitState((curr) => {
            // Skip the new update if it is behind what we already have locally
            const skipUpdate = chitState.streakEnds < curr.streakEnds;
            return skipUpdate ? curr : chitState;
        });
    }
}

export const app = new AppState();

function partitionChats(
    allChats: ChatSummary[],
): [CommunityMap<ChannelSummary[]>, DirectChatSummary[], GroupChatSummary[]] {
    const [channels, direct, group] = allChats.reduce(
        ([channels, direct, group], chat) => {
            switch (chat.kind) {
                case "channel":
                    channels.push(chat);
                    break;
                case "direct_chat":
                    direct.push(chat);
                    break;
                case "group_chat":
                    group.push(chat);
                    break;
            }
            return [channels, direct, group];
        },
        [[], [], []] as [ChannelSummary[], DirectChatSummary[], GroupChatSummary[]],
    );
    return [channelsByCommunityId(channels), direct, group];
}

function channelsByCommunityId(chats: ChannelSummary[]): CommunityMap<ChannelSummary[]> {
    return chats.reduce((acc, chat) => {
        const communityId: CommunityIdentifier = {
            kind: "community",
            communityId: chat.id.communityId,
        };
        const channels = acc.get(communityId) ?? [];
        channels.push(chat);
        acc.set(communityId, channels);
        return acc;
    }, new CommunityMap<ChannelSummary[]>());
}
