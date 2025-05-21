import DRange from "drange";
import {
    AuthProvider,
    type ChannelSummary,
    type ChatEvent,
    type ChatIdentifier,
    chatIdentifiersEqual,
    type ChatListScope,
    ChatMap,
    ChatSet,
    type ChatSummary,
    type ChitState,
    type CommunityIdentifier,
    communityIdentifiersEqual,
    CommunityMap,
    type CommunitySummary,
    type CreatedUser,
    type DiamondMembershipStatus,
    type DirectChatSummary,
    type EventWrapper,
    type ExternalBotPermissions,
    type GroupChatSummary,
    type IdentityState,
    type Member,
    type MessageActivitySummary,
    messageContextsEqual,
    type MessageFilter,
    MessageMap,
    type NervousSystemFunction,
    type PinnedByScope,
    type PinNumberFailures,
    type PinNumberResolver,
    type PublicApiKeyDetails,
    type ReadonlyMap,
    type ReadonlySet,
    type Referral,
    type StorageStatus,
    type StreakInsurance,
    type Tally,
    type ThreadIdentifier,
    type UserGroupDetails,
    type VersionedRules,
    type WalletConfig,
    type WebhookDetails,
} from "openchat-shared";
import { locale } from "svelte-i18n";
import { offlineStore } from "../../stores/network";
import { ChatDetailsState } from "../chat/serverDetails";
import { CommunityDetailsState } from "../community/server";
import { FilteredProposals } from "../filteredProposals.svelte";
import { localUpdates } from "../localUpdates";
import { selectedCommunityIdStore } from "../path/stores";
import { addToWritableMap, removeFromWritableMap } from "../utils";
import {
    achievementsStore,
    adultEnabledStore,
    allChatsStore,
    allServerChatsStore,
    anonUserStore,
    canExtendDiamondStore,
    chatListScopeStore,
    chatsInitialisedStore,
    chatSummariesStore,
    chitStateStore,
    communitiesStore,
    communityFiltersStore,
    confirmedEventIndexesLoadedStore,
    confirmedThreadEventIndexesLoadedStore,
    currentUserIdStore,
    currentUserStore,
    diamondStatusStore,
    directChatApiKeysStore,
    directChatBotsStore,
    eventsStore,
    expiredServerEventRanges,
    favouritesStore,
    filteredProposalsStore,
    identityStateStore,
    isDiamondStore,
    isLifetimeDiamondStore,
    messageActivitySummaryStore,
    messageFiltersStore,
    moderationFlagsEnabledStore,
    nextCommunityIndexStore,
    offensiveEnabledStore,
    pinnedChatsStore,
    pinNumberFailureStore,
    pinNumberRequiredStore,
    pinNumberResolverStore,
    platformModeratorStore,
    platformOperatorStore,
    proposalTalliesStore,
    referralsStore,
    selectedAuthProviderStore,
    selectedChatBlockedUsersStore,
    selectedChatExpandedDeletedMessageStore,
    selectedChatIdStore,
    selectedChatInvitedUsersStore,
    selectedChatMembersStore,
    selectedChatRulesStore,
    selectedChatSummaryStore,
    selectedChatUserGroupKeysStore,
    selectedChatUserIdsStore,
    selectedCommunityBlockedUsersStore,
    selectedCommunityInvitedUsersStore,
    selectedCommunityMembersStore,
    selectedCommunityReferralsStore,
    selectedCommunityRulesStore,
    selectedCommunitySummaryStore,
    selectedServerChatStore,
    selectedServerChatSummaryStore,
    selectedServerCommunityStore,
    selectedThreadIdStore,
    serverCommunitiesStore,
    serverDirectChatBotsStore,
    serverDirectChatsStore,
    serverEventsStore,
    serverFavouritesStore,
    serverGroupChatsStore,
    serverMessageActivitySummaryStore,
    serverPinnedChatsStore,
    serverStreakInsuranceStore,
    serverThreadEventsStore,
    serverWalletConfigStore,
    snsFunctionsStore,
    storageStore,
    suspendedUserStore,
    threadEventsStore,
    translationsStore,
    underReviewEnabledStore,
    userCreatedStore,
    walletConfigStore,
} from "./stores";

// TODO - also get rid of createSetStore and replace with SafeSetStore
export class AppState {
    #offline: boolean = false;
    #locale: string = "en";
    #anonUser: boolean = false;
    #suspendedUser: boolean = false;
    #platformModerator: boolean = false;
    #platformOperator: boolean = false;
    #diamondStatus: DiamondMembershipStatus = { kind: "inactive" };
    #isDiamond: boolean = false;
    #isLifetimeDiamond: boolean = false;
    #canExtendDiamond: boolean = false;
    #moderationFlagsEnabled: number = 0;
    #adultEnabled: boolean = false;
    #offensiveEnabled: boolean = false;
    #underReviewEnabled: boolean = false;
    #nextCommunityIndex: number = 0;
    #selectedCommunityBlockedUsers!: ReadonlySet<string>;
    #selectedCommunityMembers!: ReadonlyMap<string, Member>;
    #selectedCommunityReferrals!: ReadonlySet<string>;
    #selectedCommunityInvitedUsers!: ReadonlySet<string>;
    #selectedCommunityRules?: VersionedRules;
    #selectedCommunitySummary?: CommunitySummary;
    #walletConfig!: WalletConfig;
    #selectedThreadId?: ThreadIdentifier;
    #selectedChatId?: ChatIdentifier;
    #selectedCommunityId?: CommunityIdentifier;
    #selectedServerChatSummary?: ChatSummary;
    #selectedChatSummary?: ChatSummary;
    #currentUserId!: string;
    #communities!: CommunityMap<CommunitySummary>;
    #pinnedChats!: ReadonlyMap<ChatListScope["kind"], ChatIdentifier[]>;
    #chatListScope!: ChatListScope;
    #messageActivitySummary!: MessageActivitySummary;
    #allChats!: ChatMap<ChatSummary>;
    #allServerChats!: ChatMap<ChatSummary>;
    #chatSummaries!: ChatMap<ChatSummary>;
    #selectedChatMembers!: ReadonlyMap<string, Member>;
    #selectedChatBlockedUsers!: ReadonlySet<string>;
    #selectedChatInvitedUsers!: ReadonlySet<string>;
    #directChatBots!: ReadonlyMap<string, ExternalBotPermissions>;
    #identityState!: IdentityState;
    #confirmedEventIndexesLoaded!: DRange;
    #confirmedThreadEventIndexesLoaded!: DRange;
    #selectedChatEvents!: EventWrapper<ChatEvent>[];
    #selectedThreadEvents!: EventWrapper<ChatEvent>[];
    #selectedChatRules?: VersionedRules;
    #favourites!: ReadonlySet<ChatIdentifier>;
    #groupChats!: ChatMap<ChatSummary>;
    #messageFilters!: MessageFilter[];

    // but it can be a plain value once that's all gone
    #translations: MessageMap<string> = new MessageMap();

    constructor() {
        setTimeout(() => {
            try {
                locale.subscribe((l) => (this.#locale = l ?? "en"));
                offlineStore.subscribe((offline) => (this.#offline = offline));
                anonUserStore.subscribe((v) => (this.#anonUser = v));
                suspendedUserStore.subscribe((v) => (this.#suspendedUser = v));
                platformModeratorStore.subscribe((v) => (this.#platformModerator = v));
                platformOperatorStore.subscribe((v) => (this.#platformOperator = v));
                diamondStatusStore.subscribe((v) => (this.#diamondStatus = v));
                isDiamondStore.subscribe((v) => (this.#isDiamond = v));
                isLifetimeDiamondStore.subscribe((v) => (this.#isLifetimeDiamond = v));
                canExtendDiamondStore.subscribe((v) => (this.#canExtendDiamond = v));
                moderationFlagsEnabledStore.subscribe((v) => (this.#moderationFlagsEnabled = v));
                adultEnabledStore.subscribe((v) => (this.#adultEnabled = v));
                offensiveEnabledStore.subscribe((v) => (this.#offensiveEnabled = v));
                underReviewEnabledStore.subscribe((v) => (this.#underReviewEnabled = v));
                nextCommunityIndexStore.subscribe((v) => (this.#nextCommunityIndex = v));
                selectedCommunityBlockedUsersStore.subscribe(
                    (v) => (this.#selectedCommunityBlockedUsers = v),
                );
                selectedCommunityReferralsStore.subscribe(
                    (v) => (this.#selectedCommunityReferrals = v),
                );
                selectedCommunityInvitedUsersStore.subscribe(
                    (v) => (this.#selectedCommunityInvitedUsers = v),
                );
                selectedCommunityMembersStore.subscribe(
                    (v) => (this.#selectedCommunityMembers = v),
                );
                selectedCommunitySummaryStore.subscribe(
                    (v) => (this.#selectedCommunitySummary = v),
                );
                selectedCommunityRulesStore.subscribe((v) => (this.#selectedCommunityRules = v));

                translationsStore.subscribe((v) => (this.#translations = v));
                walletConfigStore.subscribe((v) => (this.#walletConfig = v));
                selectedThreadIdStore.subscribe((v) => (this.#selectedThreadId = v));
                selectedChatIdStore.subscribe((v) => (this.#selectedChatId = v));
                selectedCommunityIdStore.subscribe((v) => (this.#selectedCommunityId = v));
                selectedServerChatSummaryStore.subscribe(
                    (v) => (this.#selectedServerChatSummary = v),
                );
                selectedChatSummaryStore.subscribe((v) => (this.#selectedChatSummary = v));
                currentUserIdStore.subscribe((v) => (this.#currentUserId = v));
                communitiesStore.subscribe((v) => (this.#communities = v));
                pinnedChatsStore.subscribe((v) => (this.#pinnedChats = v));
                chatListScopeStore.subscribe((v) => (this.#chatListScope = v));
                messageActivitySummaryStore.subscribe((v) => (this.#messageActivitySummary = v));
                allChatsStore.subscribe((v) => (this.#allChats = v));
                allServerChatsStore.subscribe((v) => (this.#allServerChats = v));
                chatSummariesStore.subscribe((v) => (this.#chatSummaries = v));
                selectedChatMembersStore.subscribe((v) => (this.#selectedChatMembers = v));
                selectedChatBlockedUsersStore.subscribe(
                    (v) => (this.#selectedChatBlockedUsers = v),
                );
                selectedChatInvitedUsersStore.subscribe(
                    (v) => (this.#selectedChatInvitedUsers = v),
                );
                directChatBotsStore.subscribe((v) => (this.#directChatBots = v));
                identityStateStore.subscribe((v) => (this.#identityState = v));
                confirmedEventIndexesLoadedStore.subscribe(
                    (v) => (this.#confirmedEventIndexesLoaded = v),
                );
                confirmedThreadEventIndexesLoadedStore.subscribe(
                    (v) => (this.#confirmedThreadEventIndexesLoaded = v),
                );
                eventsStore.subscribe((v) => (this.#selectedChatEvents = v));
                threadEventsStore.subscribe((v) => (this.#selectedThreadEvents = v));
                selectedChatRulesStore.subscribe((v) => (this.#selectedChatRules = v));
                favouritesStore.subscribe((v) => (this.#favourites = v));
                serverGroupChatsStore.subscribe((v) => (this.#groupChats = v));
                messageFiltersStore.subscribe((v) => (this.#messageFilters = v));
            } catch {
                console.log("Error subscribing");
            }
        });
    }

    // TODO - none of the references to userStore here will be reactive at the moment
    // this is only a temporary problem

    setSnsFunctions(snsCanisterId: string, list: NervousSystemFunction[]) {
        snsFunctionsStore.update((s) => {
            const clone = s.clone();
            clone.set(snsCanisterId, list);
            return clone;
        });
    }

    get snsFunctions() {
        return snsFunctionsStore.value;
    }

    #modifyFilteredProposals(fn: (fp: FilteredProposals) => void) {
        filteredProposalsStore.update((fp) => {
            if (fp !== undefined) {
                const clone = fp.clone();
                fn(clone);
                return clone;
            }
        });
    }

    enableAllProposalFilters() {
        this.#modifyFilteredProposals((fp) => fp.enableAll());
    }

    disableAllProposalFilters(ids: number[]) {
        this.#modifyFilteredProposals((fp) => fp.disableAll(ids));
    }

    toggleProposalFilter(topic: number) {
        this.#modifyFilteredProposals((fp) => fp.toggleFilter(topic));
    }

    toggleProposalFilterMessageExpansion(messageId: bigint, expand: boolean) {
        this.#modifyFilteredProposals((fp) => fp.toggleMessageExpansion(messageId, expand));
    }

    // TODO - find where this used to be called
    // #resetFilteredProposals(chat: ChatSummary) {
    //     const filteredProposals = isProposalsChat(chat)
    //         ? FilteredProposals.fromStorage(chat.subtype.governanceCanisterId)
    //         : undefined;

    //     filteredProposalsStore.set(filteredProposals);
    // }

    setCurrentUser(user: CreatedUser) {
        currentUserStore.set(user);
    }

    getProposalTally(governanceCanisterId: string, proposalId: bigint) {
        return proposalTalliesStore.value.get(`${governanceCanisterId}_${proposalId}`);
    }

    setProposalTally(governanceCanisterId: string, proposalId: bigint, tally: Tally) {
        proposalTalliesStore.update((map) => {
            map.set(`${governanceCanisterId}_${proposalId}`, tally);
            return map;
        });
    }

    toggleCommunityFilterLanguage(lang: string) {
        if (communityFiltersStore.value.has(lang)) {
            communityFiltersStore.update((val) => {
                const clone = new Set([...val]);
                clone.delete(lang);
                return clone;
            });
        } else {
            communityFiltersStore.update((val) => {
                const clone = new Set([...val]);
                clone.add(lang);
                return clone;
            });
        }
    }

    get translations() {
        return this.#translations;
    }

    translate(messageId: bigint, translation: string) {
        return addToWritableMap(messageId, translation, translationsStore);
    }

    untranslate(messageId: bigint) {
        return removeFromWritableMap(messageId, translationsStore);
    }

    set selectedAuthProvider(p: AuthProvider) {
        selectedAuthProviderStore.set(p);
    }

    get selectedAuthProvider() {
        return selectedAuthProviderStore.value;
    }

    set userCreated(val: boolean) {
        userCreatedStore.set(val);
    }

    get userCreated() {
        return userCreatedStore.value;
    }

    set storage(val: StorageStatus) {
        storageStore.set(val);
    }

    get storage() {
        return storageStore.value;
    }

    get locale() {
        return this.#locale;
    }

    get offline() {
        return this.#offline;
    }

    set messageFilters(val: MessageFilter[]) {
        messageFiltersStore.set(val);
    }

    get messageFilters() {
        return this.#messageFilters;
    }

    get currentUser() {
        return currentUserStore.value;
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

    get achievements(): ReadonlySet<string> {
        return achievementsStore.value;
    }

    get chitState() {
        return chitStateStore.value;
    }

    updateChitState(fn: (s: ChitState) => ChitState) {
        chitStateStore.update(fn);
    }

    get walletConfig() {
        return this.#walletConfig;
    }

    updateIdentityState(fn: (prev: IdentityState) => IdentityState) {
        identityStateStore.update(fn);
    }

    get nextCommunityIndex() {
        return this.#nextCommunityIndex;
    }

    get chatsInitialised() {
        return chatsInitialisedStore.value;
    }

    set chatsInitialised(val: boolean) {
        chatsInitialisedStore.set(val);
    }

    get selectedCommunitySummary() {
        return this.#selectedCommunitySummary;
    }

    setSelectedThread(id: ThreadIdentifier) {
        selectedThreadIdStore.set(id);
    }

    updateServerThreadEvents(
        id: ThreadIdentifier,
        fn: (existing: EventWrapper<ChatEvent>[]) => EventWrapper<ChatEvent>[],
    ) {
        if (!messageContextsEqual(id, this.#selectedThreadId)) {
            console.warn(
                "Attempting to updateServerThreadEvents for the wrong thread - probably a stale response",
                id,
                this.#selectedThreadId,
            );
            return;
        }
        serverThreadEventsStore.update(fn);
    }

    updateServerEvents(
        chatId: ChatIdentifier,
        fn: (existing: EventWrapper<ChatEvent>[]) => EventWrapper<ChatEvent>[],
    ) {
        if (!chatIdentifiersEqual(chatId, this.#selectedChatId)) {
            console.warn(
                "Attempting to updateServerEvents for the wrong chat - probably a stale response",
                chatId,
                this.#selectedChatId,
            );
            return;
        }
        serverEventsStore.update(fn);
    }

    updateServerExpiredEventRanges(chatId: ChatIdentifier, fn: (existing: DRange) => DRange) {
        if (!chatIdentifiersEqual(chatId, this.#selectedChatId)) {
            console.warn(
                "Attempting to updateExpiredServerEventRanges for the wrong chat - probably a stale response",
                chatId,
                this.#selectedChatId,
            );
            return;
        }
        expiredServerEventRanges.update(fn);
    }

    clearServerEvents() {
        serverEventsStore.set([]);
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
        webhooks: Map<string, WebhookDetails>,
    ) {
        if (!chatIdentifiersEqual(chatId, this.#selectedChatId)) {
            console.warn(
                "Attempting to set chat details on the wrong chat - probably a stale response",
                chatId,
                this.#selectedChatId,
            );
            return;
        }
        selectedServerChatStore.set(
            new ChatDetailsState(
                chatId,
                members,
                lapsedMembers,
                blockedUsers,
                invitedUsers,
                pinnedMessages,
                bots,
                apiKeys,
                webhooks,
                rules,
            ),
        );
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

        selectedServerCommunityStore.set(
            new CommunityDetailsState(
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
            ),
        );
    }

    // TODO - this is only called from tests
    set serverCommunities(val: CommunityMap<CommunitySummary>) {
        serverCommunitiesStore.set(val);
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
        serverMessageActivitySummaryStore.set(messageActivitySummary);
        achievementsStore.set(achievements);
        referralsStore.set(referrals);

        // TODO - do we need to separate these things - each of these fromMap calls will result in a publish
        // which will cause downstream deriveds to fire. It *might* be better to refactor into a single store - we shall see.
        // Or - this might be the case for a "transaction".
        serverDirectChatsStore.set(directChatsMap);
        serverGroupChatsStore.set(groupChatsMap);
        serverFavouritesStore.set(favouritesSet);
        serverCommunitiesStore.set(communitiesMap);
        serverPinnedChatsStore.set(pinnedChats);
        directChatApiKeysStore.set(apiKeys);
        serverDirectChatBotsStore.set(installedBots);
        serverWalletConfigStore.set(walletConfig);
        if (streakInsurance !== undefined) {
            serverStreakInsuranceStore.set(streakInsurance);
        }
        this.updateChitState((curr) => {
            // Skip the new update if it is behind what we already have locally
            const skipUpdate = chitState.streakEnds < curr.streakEnds;
            return skipUpdate ? curr : chitState;
        });
    }

    get pinNumberRequired() {
        return pinNumberRequiredStore.value;
    }

    set pinNumberRequired(val: boolean | undefined) {
        pinNumberRequiredStore.set(val);
    }

    get pinNumberResolver() {
        return pinNumberResolverStore.value;
    }

    set pinNumberResolver(val: PinNumberResolver | undefined) {
        pinNumberResolverStore.set(val);
    }

    get pinNumberFailure() {
        return pinNumberFailureStore.value;
    }

    set pinNumberFailure(val: PinNumberFailures | undefined) {
        pinNumberFailureStore.set(val);
    }

    get selectedCommunityMembers() {
        return this.#selectedCommunityMembers;
    }

    get selectedCommunityBlockedUsers() {
        return this.#selectedCommunityBlockedUsers;
    }

    get selectedCommunityReferrals() {
        return this.#selectedCommunityReferrals;
    }

    get selectedCommunityInvitedUsers() {
        return this.#selectedCommunityInvitedUsers;
    }

    get selectedCommunityRules() {
        return this.#selectedCommunityRules;
    }

    get serverStreakInsurance() {
        return serverStreakInsuranceStore.value;
    }

    get selectedChatId() {
        return this.#selectedChatId;
    }

    get selectedServerChatSummary() {
        return this.#selectedServerChatSummary;
    }

    get selectedChatSummary() {
        return this.#selectedChatSummary;
    }

    get currentUserId() {
        return this.#currentUserId;
    }

    get communities() {
        return this.#communities;
    }

    get pinnedChats() {
        return this.#pinnedChats;
    }

    get chatListScope() {
        return this.#chatListScope;
    }

    get messageActivitySummary() {
        return this.#messageActivitySummary;
    }

    get allChats() {
        return this.#allChats;
    }

    get allServerChats() {
        return this.#allServerChats;
    }

    get chatSummaries() {
        return this.#chatSummaries;
    }

    get selectedChatMembers() {
        return this.#selectedChatMembers;
    }

    get selectedChatBlockedUsers() {
        return this.#selectedChatBlockedUsers;
    }

    get selectedChatInvitedUsers() {
        return this.#selectedChatInvitedUsers;
    }

    get directChatBots() {
        return this.#directChatBots;
    }

    get identityState() {
        return this.#identityState;
    }

    get selectedThreadId() {
        return this.#selectedThreadId;
    }

    get confirmedEventIndexesLoaded() {
        return this.#confirmedEventIndexesLoaded;
    }

    get confirmedThreadEventIndexesLoaded() {
        return this.#confirmedThreadEventIndexesLoaded;
    }

    get selectedChatEvents() {
        return this.#selectedChatEvents;
    }

    get selectedThreadEvents() {
        return this.#selectedThreadEvents;
    }

    get selectedChatRules() {
        return this.#selectedChatRules;
    }

    get favourites() {
        return this.#favourites;
    }

    get groupChats() {
        return this.#groupChats;
    }

    setSelectedChat(_chatId: ChatIdentifier) {
        serverEventsStore.set([]);
        expiredServerEventRanges.set(new DRange());
        selectedChatUserIdsStore.set(new Set());
        selectedChatUserGroupKeysStore.set(new Set());
        selectedChatExpandedDeletedMessageStore.set(new Set());
    }

    expandDeletedMessages(messageIndexes: Set<number>) {
        selectedChatExpandedDeletedMessageStore.update((set) => {
            messageIndexes.forEach((i) => set.add(i));
            return set;
        });
    }

    addSelectedChatUserIds(userIds: string[]) {
        selectedChatUserIdsStore.update((set) => {
            userIds.forEach((userId) => set.add(userId));
            return set;
        });
    }

    addUserGroupKey(key: string) {
        selectedChatUserGroupKeysStore.update((set) => set.add(key));
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
