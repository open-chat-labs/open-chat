import { dequal } from "dequal";
import {
    applyOptionUpdate,
    type ChannelSummary,
    type ChatIdentifier,
    chatIdentifiersEqual,
    type ChatListScope,
    chatListScopesEqual,
    ChatMap,
    ChatSet,
    type ChatSummary,
    type ChitState,
    type CommunityIdentifier,
    communityIdentifiersEqual,
    CommunityMap,
    type CommunitySummary,
    type DirectChatIdentifier,
    type DirectChatSummary,
    type ExternalBotPermissions,
    type GroupChatSummary,
    type IdentityState,
    type Member,
    type MessageActivitySummary,
    type MessageContext,
    messageContextsEqual,
    type PublicApiKeyDetails,
    type ReadonlyMap,
    type Referral,
    SafeMap,
    type StreakInsurance,
    type UserGroupDetails,
    type UserGroupSummary,
    type VersionedRules,
    type VideoCallCounts,
    videoCallsInProgressForChats,
    type WalletConfig,
    type WebhookDetails,
} from "openchat-shared";
import type { PinnedByScope } from "../stores";
import { chatDetailsLocalUpdates, ChatDetailsMergedState } from "./chat_details";
import { ChatDetailsServerState } from "./chat_details/server";
import { communityLocalUpdates } from "./community_details";
import { CommunityMergedState } from "./community_details/merged.svelte";
import { CommunityServerState } from "./community_details/server";
import { localUpdates } from "./global";
import { pathState } from "./path.svelte";
import { withEqCheck } from "./reactivity.svelte";

class AppState {
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
                    console.log("SelectedChatId is undefined - clear state");
                    this.#selectedChat = new ChatDetailsMergedState(ChatDetailsServerState.empty());
                }
            });
        });
    }

    #achievements = $state<Set<string>>(new Set());

    #referrals = $state<Referral[]>([]);

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

    #serverCommunities = $state<CommunityMap<CommunitySummary>>(new CommunityMap());

    #scopedServerChats = $derived.by(() => {
        switch (this.#chatListScope.kind) {
            case "community": {
                const community = this.serverCommunities.get(this.#chatListScope.id);
                return community
                    ? ChatMap.fromList(community.channels)
                    : new ChatMap<ChatSummary>();
            }
            case "group_chat":
                return this.serverGroupChats;
            case "direct_chat":
                return this.serverDirectChats;
            case "favourite": {
                return [...this.favourites.values()].reduce((favs, chatId) => {
                    const chat = this.#allServerChats.get(chatId);
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

    #allServerChats = $derived.by(() => {
        const groupChats = this.#serverGroupChats.values();
        const directChats = this.#serverDirectChats.values();
        const channels = [...this.#serverCommunities.values()].flatMap((c) => c.channels);
        return ChatMap.fromList([...groupChats, ...directChats, ...channels]);
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

    setDirectChatDetails(chatId: DirectChatIdentifier, currentUserId: string) {
        const serverState = ChatDetailsServerState.empty(chatId);
        if (chatIdentifiersEqual(chatId, this.#selectedChat.chatId)) {
            this.#selectedChat.overwriteServerState(serverState);
        } else {
            this.#selectedChat = new ChatDetailsMergedState(serverState);
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
        const serverState = new ChatDetailsServerState(
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

        // if the chatId is still the same just overwrite the server state, otherwise splat the whole thing
        if (chatIdentifiersEqual(chatId, this.#selectedChat.chatId)) {
            this.#selectedChat.overwriteServerState(serverState);
        } else {
            this.#selectedChat = new ChatDetailsMergedState(serverState);
        }
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
        const serverState = new CommunityServerState(
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
        if (communityIdentifiersEqual(communityId, this.#selectedCommunity.communityId)) {
            this.#selectedCommunity.overwriteServerState(serverState);
        } else {
            this.#selectedCommunity = new CommunityMergedState(serverState);
        }
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

    get scopedServerChats() {
        return this.#scopedServerChats;
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
