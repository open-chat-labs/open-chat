import { dequal } from "dequal";
import {
    applyOptionUpdate,
    type ChatIdentifier,
    chatIdentifiersEqual,
    type ChatListScope,
    chatListScopesEqual,
    type ChitState,
    type CommunityIdentifier,
    communityIdentifiersEqual,
    CommunityMap,
    type CommunitySummary,
    type DirectChatIdentifier,
    type ExternalBotPermissions,
    type IdentityState,
    type Member,
    type MessageContext,
    messageContextsEqual,
    type PublicApiKeyDetails,
    type ReadonlyMap,
    SafeMap,
    type StreakInsurance,
    type UserGroupDetails,
    type UserGroupSummary,
    type VersionedRules,
    type VideoCallCounts,
    videoCallsInProgressForChats,
    type WalletConfig,
} from "openchat-shared";
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

    // #serverDirectChats = $state<ChatMap<DirectChatSummary>>(new ChatMap());

    // #serverGroupChats = $state<ChatMap<GroupChatSummary>>(new ChatMap());

    // #serverFavourites = $state<ChatSet<ChatIdentifier>>(new ChatSet());

    #serverCommunities = $state<CommunityMap<CommunitySummary>>(new CommunityMap());

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

    set serverCommunities(val: CommunityMap<CommunitySummary>) {
        this.#serverCommunities = val;
    }

    set serverPinnedChats(val: Map<ChatListScope["kind"], ChatIdentifier[]>) {
        this.#serverPinnedChats = val;
    }

    get serverCommunities() {
        return this.#serverCommunities;
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

    isPreviewingCommunity(id: CommunityIdentifier) {
        return localUpdates.isPreviewingCommunity(id);
    }

    getPreviewingCommunity(id: CommunityIdentifier) {
        return localUpdates.getPreviewingCommunity(id);
    }
}

export const app = new AppState();
