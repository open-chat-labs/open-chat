import { dequal } from "dequal";
import type DRange from "drange";
import {
    ANON_USER_ID,
    anonymousUser,
    applyOptionUpdate,
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
    type CombinedUnreadCounts,
    type CommunityIdentifier,
    communityIdentifiersEqual,
    CommunityMap,
    type CommunitySummary,
    compareChats,
    type CreatedUser,
    type CryptocurrencyDetails,
    DEFAULT_TOKENS,
    type DiamondMembershipStatus,
    type DirectChatIdentifier,
    type DirectChatSummary,
    emptyChatMetrics,
    type EnhancedTokenDetails,
    type EventWrapper,
    type ExternalBotPermissions,
    type GroupChatSummary,
    type IdentityState,
    isProposalsChat,
    type Member,
    mergeListOfCombinedUnreadCounts,
    type MessageActivitySummary,
    type MessageFilter,
    type MessageFormatter,
    MessageMap,
    type ModerationFlag,
    ModerationFlags,
    type NervousSystemDetails,
    type NervousSystemFunction,
    type NotificationStatus,
    type PinnedByScope,
    type PinNumberFailures,
    type PinNumberResolver,
    type PublicApiKeyDetails,
    type ReadonlyMap,
    type ReadonlySet,
    type Referral,
    SafeMap,
    type StorageStatus,
    type StreakInsurance,
    type Tally,
    type ThreadIdentifier,
    type ThreadSyncDetails,
    type TokenExchangeRates,
    type UserGroupDetails,
    type UserGroupSummary,
    type VersionedRules,
    type VideoCallCounts,
    videoCallsInProgressForChats,
    type WalletConfig,
    type WebhookDetails,
} from "openchat-shared";
import { locale } from "svelte-i18n";
import { SvelteMap } from "svelte/reactivity";
import { derived, get } from "svelte/store";
import { offlineStore } from "../stores/network";
import {
    getMessagePermissionsForSelectedChat,
    mergeChatMetrics,
    mergePermissions,
    mergeUnconfirmedIntoSummary,
} from "../utils/chat";
import { configKeys } from "../utils/config";
import { enumFromStringValue } from "../utils/enums";
import { setsAreEqual } from "../utils/set";
import { chatDetailsLocalUpdates, ChatDetailsMergedState } from "./chat_details";
import { ChatDetailsServerState } from "./chat_details/server.svelte";
import { communityLocalUpdates } from "./community";
import { CommunityDetailsState } from "./community/server";
import { communitySummaryLocalUpdates } from "./community/summaryUpdates";
import { FilteredProposals } from "./filteredProposals.svelte";
import { localUpdates } from "./global";
import { LocalStorageBoolStore, LocalStorageStore } from "./localStorageStore";
import {
    ChatMapStore,
    CommunityMapStore,
    MessageMapStore,
    PinnedByScopeStore,
    SafeMapStore,
} from "./map";
import { messageLocalUpdates } from "./message/local.svelte";
import { routeStore, selectedCommunityIdStore } from "./path.svelte";
import { withEqCheck } from "./reactivity.svelte";
import { ChatSetStore, SafeSetStore } from "./set";
import { SnsFunctions } from "./snsFunctions.svelte";
import { hideMessagesFromDirectBlocked } from "./ui.svelte";
import { messagesRead } from "./unread/markRead.svelte";
import { userStore } from "./users/users.svelte";
import { writable } from "./writable";

export const ONE_MB = 1024 * 1024;
export const ONE_GB = ONE_MB * 1024;

function communityFilterFromString(serialised: string): Set<string> {
    const parsed = JSON.parse(serialised);
    return new Set<string>(parsed.languages);
}
function communityFilterToString(filter: Set<string>): string {
    return JSON.stringify({
        ...filter,
        languages: Array.from(filter),
    });
}

type LedgerCanister = string;
type GovernanceCanister = string;

// TODO - also get rid of createSetStore and replace with SafeSetStore
export const cryptoLookup = new SafeMapStore<LedgerCanister, CryptocurrencyDetails>();
export const nervousSystemLookup = new SafeMapStore<GovernanceCanister, NervousSystemDetails>();
export const exchangeRatesLookupStore = new SafeMapStore<string, TokenExchangeRates>();

class CryptoBalanceStore extends SafeMapStore<LedgerCanister, bigint> {
    setBalance(ledger: string, balance: bigint) {
        super.set(ledger, balance);
        cryptoBalancesLastUpdated.set(ledger, Date.now());
    }

    valueIfUpdatedRecently(ledger: string): bigint | undefined {
        const lastUpdated = cryptoBalancesLastUpdated.get(ledger);
        if (lastUpdated === undefined) {
            return undefined;
        }
        return Date.now() - lastUpdated < 5 * 60 * 1000 ? this.get(ledger) : undefined;
    }
}
export const cryptoBalanceStore = new CryptoBalanceStore();
const cryptoBalancesLastUpdated = new Map<string, number>();

export const bitcoinAddress = writable<string | undefined>(undefined);

export const lastCryptoSent = new LocalStorageStore<string | undefined>(
    configKeys.lastCryptoSent,
    undefined,
);

export const enhancedCryptoLookup = derived(
    [cryptoLookup, cryptoBalanceStore, exchangeRatesLookupStore],
    ([$lookup, $balance, $exchangeRatesLookup]) => {
        const xrICPtoDollar = $exchangeRatesLookup.get("icp")?.toUSD;
        const xrBTCtoDollar = $exchangeRatesLookup.get("btc")?.toUSD;
        const xrETHtoDollar = $exchangeRatesLookup.get("eth")?.toUSD;

        const xrDollarToICP = xrICPtoDollar === undefined ? 0 : 1 / xrICPtoDollar;
        const xrDollarToBTC = xrBTCtoDollar === undefined ? 0 : 1 / xrBTCtoDollar;
        const xrDollarToETH = xrETHtoDollar === undefined ? 0 : 1 / xrETHtoDollar;

        return $lookup.reduce((result, [key, t]) => {
            const balance = $balance.get(t.ledger) ?? BigInt(0);
            const symbolLower = t.symbol.toLowerCase();
            const balanceWholeUnits = Number(balance) / Math.pow(10, t.decimals);
            const rates = $exchangeRatesLookup.get(symbolLower);
            const xrUSD = rates?.toUSD;
            const dollarBalance = xrUSD !== undefined ? xrUSD * balanceWholeUnits : undefined;
            const icpBalance =
                dollarBalance !== undefined && xrDollarToICP !== undefined
                    ? dollarBalance * xrDollarToICP
                    : undefined;
            const btcBalance =
                dollarBalance !== undefined && xrDollarToBTC !== undefined
                    ? dollarBalance * xrDollarToBTC
                    : undefined;
            const ethBalance =
                dollarBalance !== undefined && xrDollarToETH !== undefined
                    ? dollarBalance * xrDollarToETH
                    : undefined;
            const zero = balance === BigInt(0) && !DEFAULT_TOKENS.includes(t.symbol);
            result.set(key, {
                ...t,
                balance,
                dollarBalance,
                icpBalance,
                btcBalance,
                ethBalance,
                zero,
                urlFormat: t.transactionUrlFormat,
            });
            return result;
        }, new Map<string, EnhancedTokenDetails>());
    },
);

export const cryptoTokensSorted = derived([enhancedCryptoLookup], ([$lookup]) => {
    return [...$lookup.values()].filter((t) => t.enabled || !t.zero).sort(compareTokens);
});

function meetsAutoWalletCriteria(config: WalletConfig, token: EnhancedTokenDetails): boolean {
    return (
        config.kind === "auto_wallet" &&
        (DEFAULT_TOKENS.includes(token.symbol) ||
            (config.minDollarValue <= 0 && token.balance > 0) ||
            (config.minDollarValue > 0 && (token.dollarBalance ?? 0) >= config.minDollarValue))
    );
}

function meetsManualWalletCriteria(config: WalletConfig, token: EnhancedTokenDetails): boolean {
    return config.kind === "manual_wallet" && config.tokens.has(token.ledger);
}

export const serverWalletConfigStore = writable<WalletConfig>({
    kind: "auto_wallet",
    minDollarValue: 0,
});

export const walletConfigStore = derived(
    [serverWalletConfigStore, localUpdates.walletConfig],
    ([serverWalletConfig, localUpates]) => localUpates ?? serverWalletConfig,
);

export const walletTokensSorted = derived(
    [cryptoTokensSorted, walletConfigStore],
    ([$tokens, walletConfig]) => {
        return $tokens.filter(
            (t) =>
                meetsAutoWalletCriteria(walletConfig, t) ||
                meetsManualWalletCriteria(walletConfig, t),
        );
    },
);

export const swappableTokensStore = new SafeSetStore<string>();

function compareTokens(a: EnhancedTokenDetails, b: EnhancedTokenDetails): number {
    // Sort by non-zero balances first
    // Then by $ balance
    // Then by whether token is a default
    // Then by default precedence
    // Then alphabetically by symbol

    const aNonZero = a.balance > 0;
    const bNonZero = b.balance > 0;

    if (aNonZero !== bNonZero) {
        return aNonZero ? -1 : 1;
    }

    const aDollarBalance = a.dollarBalance ?? -1;
    const bDollarBalance = b.dollarBalance ?? -1;

    if (aDollarBalance < bDollarBalance) {
        return 1;
    } else if (aDollarBalance > bDollarBalance) {
        return -1;
    } else {
        const defA = DEFAULT_TOKENS.indexOf(a.symbol);
        const defB = DEFAULT_TOKENS.indexOf(b.symbol);

        if (defA >= 0 && defB >= 0) {
            return defA < defB ? 1 : -1;
        } else if (defA >= 0) {
            return 1;
        } else if (defB >= 0) {
            return -1;
        } else {
            return a.symbol.localeCompare(b.symbol);
        }
    }
}

export function hasFlag(mask: number, flag: ModerationFlag): boolean {
    return (mask & flag) !== 0;
}
export const pinNumberRequiredStore = writable<boolean | undefined>(undefined);
export const pinNumberResolverStore = writable<PinNumberResolver | undefined>(undefined);
export const pinNumberFailureStore = writable<PinNumberFailures | undefined>(undefined);

export const storageStore = writable<StorageStatus>({
    byteLimit: 0,
    bytesUsed: 0,
});

export const percentageStorageUsedStore = derived(storageStore, (storage) =>
    Math.ceil((storage.bytesUsed / storage.byteLimit) * 100),
);

export const percentageStorageRemainingStore = derived(storageStore, (storage) =>
    Math.floor((1 - storage.bytesUsed / storage.byteLimit) * 100),
);

export const storageInGBStore = derived(storageStore, (storage) => ({
    gbLimit: storage.byteLimit / ONE_GB,
    gbUsed: storage.bytesUsed / ONE_GB,
}));

export const messageFiltersStore = writable<MessageFilter[]>([]);
export const translationsStore = new MessageMapStore<string>();
export const snsFunctionsStore = writable<SnsFunctions>(new SnsFunctions());
export const filteredProposalsStore = writable<FilteredProposals | undefined>(undefined);
export const currentUserStore = writable<CreatedUser>(anonymousUser(), dequal);
export const currentUserIdStore = derived(currentUserStore, ({ userId }) => userId);
export const anonUserStore = derived(currentUserIdStore, (id) => id === ANON_USER_ID);
export const suspendedUserStore = derived(
    currentUserStore,
    (user) => user.suspensionDetails !== undefined,
);
export const platformModeratorStore = derived(currentUserStore, (user) => user.isPlatformModerator);
export const platformOperatorStore = derived(currentUserStore, (user) => user.isPlatformOperator);
export const diamondStatusStore = derived(currentUserStore, (user) => user.diamondStatus);
export const isDiamondStore = derived(
    diamondStatusStore,
    (diamondStatus) =>
        diamondStatus.kind === "lifetime" ||
        (diamondStatus.kind === "active" && diamondStatus.expiresAt > Date.now()),
);
export const isLifetimeDiamondStore = derived(
    diamondStatusStore,
    (diamondStatus) => diamondStatus.kind === "lifetime",
);
export const canExtendDiamondStore = derived(
    diamondStatusStore,
    (diamondStatus) => diamondStatus.kind === "active",
);
export const moderationFlagsEnabledStore = derived(
    currentUserStore,
    ({ moderationFlagsEnabled }) => moderationFlagsEnabled,
);
export const adultEnabledStore = derived(moderationFlagsEnabledStore, (moderationFlagsEnabled) =>
    hasFlag(moderationFlagsEnabled, ModerationFlags.Adult),
);
export const offensiveEnabledStore = derived(
    moderationFlagsEnabledStore,
    (moderationFlagsEnabled) => hasFlag(moderationFlagsEnabled, ModerationFlags.Offensive),
);
export const underReviewEnabledStore = derived(
    moderationFlagsEnabledStore,
    (moderationFlagsEnabled) => hasFlag(moderationFlagsEnabled, ModerationFlags.UnderReview),
);

const notificationsSupported =
    "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

export const softDisabledStore = new LocalStorageBoolStore(configKeys.softDisabled, false);

const browserPermissionStore = writable<NotificationPermission | "pending-init">("pending-init");

export async function initNotificationStores(): Promise<void> {
    if (!notificationsSupported) {
        return;
    }

    console.debug("PUSH: initialising notification stores with ", Notification.permission);

    browserPermissionStore.set(Notification.permission);
    if (navigator.permissions) {
        navigator.permissions.query({ name: "notifications" }).then((perm) => {
            perm.onchange = () => {
                console.debug("PUSH: permission status changed to ", perm.state);
                browserPermissionStore.set(permissionStateToNotificationPermission(perm.state));
            };
        });
    }
}

export function setSoftDisabled(softDisabled: boolean): void {
    softDisabledStore.set(softDisabled);
}

function permissionStateToNotificationPermission(perm: PermissionState): NotificationPermission {
    switch (perm) {
        case "prompt":
            return "default";
        case "denied":
            return "denied";
        case "granted":
            return "granted";
    }
}

function permissionToStatus(
    permission: NotificationPermission | "pending-init",
): NotificationStatus {
    switch (permission) {
        case "pending-init":
            return "pending-init";
        case "denied":
            return "hard-denied";
        case "granted":
            return "granted";
        default:
            return "prompt";
    }
}

export const notificationStatus = derived(
    [softDisabledStore, browserPermissionStore, anonUserStore],
    ([softDisabled, browserPermission, anonUser]) => {
        if (!notificationsSupported || anonUser) {
            return "unsupported";
        }
        if (softDisabled) {
            return "soft-denied";
        }
        return permissionToStatus(browserPermission);
    },
);

export async function askForNotificationPermission(): Promise<NotificationPermission> {
    return Notification.requestPermission()
        .then((res) => {
            console.debug("PUSH: requestPermission result: ", res);
            setSoftDisabled(false);
            browserPermissionStore.set(res);
            return res;
        })
        .catch((err) => {
            console.debug("PUSH: requestPermission err: ", err);
            throw err;
        });
}

export const communityFiltersStore = new LocalStorageStore(
    "openchat_community_filters",
    new Set<string>(),
    communityFilterToString,
    communityFilterFromString,
    setsAreEqual,
);
export const exploreCommunitiesFiltersStore = derived(
    [communityFiltersStore, moderationFlagsEnabledStore],
    ([communityFilters, moderationFlagsEnabled]) => ({
        languages: Array.from(communityFilters),
        flags: moderationFlagsEnabled,
    }),
);
export const userCreatedStore = new LocalStorageBoolStore(configKeys.userCreated, false);
export const selectedAuthProviderStore = new LocalStorageStore(
    configKeys.selectedAuthProvider,
    AuthProvider.II,
    (a) => a,
    (a) => enumFromStringValue(AuthProvider, a, AuthProvider.II),
);
export const achievementsStore = new SafeSetStore<string>();
export const chitStateStore = writable<ChitState>(
    {
        chitBalance: 0,
        totalChitEarned: 0,
        streak: 0,
        streakEnds: 0n,
        nextDailyChitClaim: 0n,
    },
    dequal,
);

export const serverCommunitiesStore = new CommunityMapStore<CommunitySummary>();

export const communitiesStore = derived(
    [
        serverCommunitiesStore,
        localUpdates.communities,
        localUpdates.previewCommunities,
        communitySummaryLocalUpdates,
    ],
    ([serverCommunities, localCommunities, previewCommunities, localUpdates]) => {
        const merged = localCommunities.apply(serverCommunities.clone().merge(previewCommunities));
        return [...merged.entries()].reduce((result, [communityId, community]) => {
            const updates = localUpdates.get(communityId);

            const anyChanges =
                updates?.index !== undefined ||
                updates?.displayName !== undefined ||
                updates?.rulesAccepted !== undefined;

            if (anyChanges) {
                const clone = structuredClone(community);
                const index = updates?.index;
                if (index !== undefined) {
                    clone.membership.index = index;
                }
                clone.membership.displayName = applyOptionUpdate(
                    clone.membership.displayName,
                    updates?.displayName,
                );
                clone.membership.rulesAccepted =
                    updates?.rulesAccepted ?? clone.membership.rulesAccepted;

                result.set(communityId, clone);
            } else {
                result.set(communityId, community);
            }
            return result;
        }, new CommunityMap<CommunitySummary>());
    },
);

export const sortedCommunitiesStore = derived(communitiesStore, (communities) => {
    return [...communities.values()].toSorted((a, b) => {
        return b.membership.index === a.membership.index
            ? b.memberCount - a.memberCount
            : b.membership.index - a.membership.index;
    });
});

export const nextCommunityIndexStore = derived(
    sortedCommunitiesStore,
    (sortedCommunitiesStore) => (sortedCommunitiesStore[0]?.membership?.index ?? -1) + 1,
);

export const userGroupSummariesStore = derived(communitiesStore, (communities) => {
    return [...communities.values()].reduce((map, community) => {
        community.userGroups.forEach((ug) => map.set(ug.id, ug));
        return map;
    }, new Map<number, UserGroupSummary>());
});

export const selectedChatIdStore = derived(routeStore, (route) => {
    switch (route.kind) {
        case "selected_channel_route":
        case "global_chat_selected_route":
            return route.chatId;
        default:
            return undefined;
    }
});

export const chatListScopeStore = derived(routeStore, (route) => route.scope);
export const chatsInitialisedStore = writable(false);
export const selectedServerCommunityStore = writable<CommunityDetailsState | undefined>(undefined);
export const selectedCommunityMembersStore = derived(
    [selectedServerCommunityStore, communityLocalUpdates.members],
    ([community, members]) => {
        if (community === undefined) return new Map() as ReadonlyMap<string, Member>;
        const updates = members.get(community.communityId);
        if (updates === undefined) return community.members;
        return updates.apply(community.members);
    },
);
export const selectedCommunityBotsStore = derived(
    [selectedServerCommunityStore, communityLocalUpdates.bots],
    ([community, bots]) => {
        if (community === undefined)
            return new Map() as ReadonlyMap<string, ExternalBotPermissions>;
        const updates = bots.get(community.communityId);
        if (updates === undefined) return community.bots;
        return updates.apply(community.bots);
    },
);
export const selectedCommunityUserGroupsStore = derived(
    [selectedServerCommunityStore, communityLocalUpdates.userGroups],
    ([community, userGroups]) => {
        if (community === undefined) return new Map() as ReadonlyMap<number, UserGroupDetails>;
        const updates = userGroups.get(community.communityId);
        if (updates === undefined) return community.userGroups;
        return updates.apply(community.userGroups);
    },
);
export const selectedCommunityInvitedUsersStore = derived(
    [selectedServerCommunityStore, communityLocalUpdates.invitedUsers],
    ([community, invitedUsers]) => {
        if (community === undefined) return new Set() as ReadonlySet<string>;
        const updates = invitedUsers.get(community.communityId);
        if (updates === undefined) return community.invitedUsers;
        return updates.apply(community.invitedUsers);
    },
);
export const selectedCommunityBlockedUsersStore = derived(
    [selectedServerCommunityStore, communityLocalUpdates.blockedUsers],
    ([community, blockedUsers]) => {
        if (community === undefined) return new Set() as ReadonlySet<string>;
        const updates = blockedUsers.get(community.communityId);
        if (updates === undefined) return community.blockedUsers;
        return updates.apply(community.blockedUsers);
    },
);
export const selectedCommunityRulesStore = derived(
    [selectedServerCommunityStore, communityLocalUpdates.rules],
    ([community, rules]) => {
        if (community === undefined) return undefined;
        const updates = rules.get(community.communityId);
        return updates ?? community.rules;
    },
);
export const selectedCommunityLapsedMembersStore = derived(
    selectedServerCommunityStore,
    (selectedCommunity) => selectedCommunity?.lapsedMembers ?? (new Set() as ReadonlySet<string>),
);
export const selectedCommunityApiKeysStore = derived(
    selectedServerCommunityStore,
    (selectedCommunity) =>
        selectedCommunity?.apiKeys ?? (new Map() as ReadonlyMap<string, PublicApiKeyDetails>),
);
export const selectedCommunityReferralsStore = derived(
    selectedServerCommunityStore,
    (selectedCommunity) => selectedCommunity?.referrals ?? (new Set() as ReadonlySet<string>),
);
export const selectedCommunitySummaryStore = derived(
    [selectedCommunityIdStore, communitiesStore],
    ([selectedCommunityId, communities]) =>
        selectedCommunityId ? communities.get(selectedCommunityId) : undefined,
);
export const serverDirectChatsStore = new ChatMapStore<DirectChatSummary>();
export const serverGroupChatsStore = new ChatMapStore<GroupChatSummary>();
export const serverFavouritesStore = new ChatSetStore();
export const serverPinnedChatsStore = new PinnedByScopeStore();
export const directChatApiKeysStore = new SafeMapStore<string, PublicApiKeyDetails>();
export const serverMessageActivitySummaryStore = writable<MessageActivitySummary>({
    readUpToTimestamp: 0n,
    latestTimestamp: 0n,
    unreadCount: 0,
});
export const serverDirectChatBotsStore = new SafeMapStore<string, ExternalBotPermissions>();
export const serverStreakInsuranceStore = writable<StreakInsurance>({
    daysInsured: 0,
    daysMissed: 0,
});
export const referralsStore = writable<Referral[]>([]);
export const streakInsuranceStore = derived(
    [serverStreakInsuranceStore, localUpdates.streakInsurance],
    ([serverStreakInsurance, localUpates]) => localUpates ?? serverStreakInsurance,
);

export class AppState {
    #percentageStorageRemaining: number = 0;
    #percentageStorageUsed: number = 0;
    #storageInGB = { gbLimit: 0, gbUsed: 0 };
    #offline: boolean = false;
    #locale: string = "en";
    #exploreCommunitiesFilters: { languages: string[]; flags: number } = {
        languages: [],
        flags: 0,
    };
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
    #serverMessageActivitySummary = $state<MessageActivitySummary>({
        readUpToTimestamp: 0n,
        latestTimestamp: 0n,
        unreadCount: 0,
    });
    #walletConfig!: WalletConfig;

    // TODO - these need to use $state for the moment because we still have $derived that is depending on it
    // but it can be a plain value once that's all gone
    #translations = $state<MessageMap<string>>(new MessageMap());
    #messageFilters = $state<MessageFilter[]>([]);
    #currentUserId = $state<string>(currentUserStore.current.userId);
    #communities = $state<CommunityMap<CommunitySummary>>(new CommunityMap());
    #selectedChatId = $state<ChatIdentifier | undefined>();
    #selectedCommunityId = $state<CommunityIdentifier | undefined>();
    #chatListScope = $state<ChatListScope>({ kind: "none" });
    #serverDirectChats = $state<ChatMap<DirectChatSummary>>(new ChatMap());
    #serverGroupChats = $state<ChatMap<GroupChatSummary>>(new ChatMap());
    #serverCommunities = $state<CommunityMap<CommunitySummary>>(new CommunityMap());
    #serverFavourites = $state<ChatSet>(new ChatSet());
    #serverPinnedChats = $state<SafeMap<ChatListScope["kind"], ChatIdentifier[]>>(new SafeMap());
    #serverDirectChatBots = $state<SafeMap<string, ExternalBotPermissions>>(new SafeMap());

    constructor() {
        $effect.root(() => {
            $effect(() => {
                if (this.#selectedChatId === undefined) {
                    this.#selectedChat = new ChatDetailsMergedState(ChatDetailsServerState.empty());
                }
            });
        });

        locale.subscribe((l) => (this.#locale = l ?? "en"));
        offlineStore.subscribe((offline) => (this.#offline = offline));
        percentageStorageRemainingStore.subscribe((v) => (this.#percentageStorageRemaining = v));
        percentageStorageUsedStore.subscribe((v) => (this.#percentageStorageUsed = v));
        storageInGBStore.subscribe((v) => (this.#storageInGB = v));
        messageFiltersStore.subscribe((v) => (this.#messageFilters = v));
        currentUserIdStore.subscribe((v) => (this.#currentUserId = v));
        exploreCommunitiesFiltersStore.subscribe((v) => (this.#exploreCommunitiesFilters = v));
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
        selectedCommunityReferralsStore.subscribe((v) => (this.#selectedCommunityReferrals = v));
        selectedCommunityInvitedUsersStore.subscribe(
            (v) => (this.#selectedCommunityInvitedUsers = v),
        );
        selectedCommunityMembersStore.subscribe((v) => (this.#selectedCommunityMembers = v));
        selectedCommunitySummaryStore.subscribe((v) => (this.#selectedCommunitySummary = v));
        selectedCommunityRulesStore.subscribe((v) => (this.#selectedCommunityRules = v));

        // TODO - these clones are only necessary to trigger downstream $derived. Remove when all $deriveds are gone
        translationsStore.subscribe((v) => (this.#translations = v.clone()));
        serverCommunitiesStore.subscribe((v) => (this.#serverCommunities = v.clone()));
        communitiesStore.subscribe((v) => (this.#communities = v));
        selectedChatIdStore.subscribe((v) => (this.#selectedChatId = v));
        selectedCommunityIdStore.subscribe((v) => (this.#selectedCommunityId = v));
        chatListScopeStore.subscribe((v) => (this.#chatListScope = v));
        serverDirectChatsStore.subscribe((v) => (this.#serverDirectChats = v.clone()));
        serverGroupChatsStore.subscribe((v) => (this.#serverGroupChats = v.clone()));
        serverFavouritesStore.subscribe((v) => (this.#serverFavourites = v.clone()));
        serverPinnedChatsStore.subscribe((v) => (this.#serverPinnedChats = v.clone()));
        serverMessageActivitySummaryStore.subscribe(
            (v) => (this.#serverMessageActivitySummary = v),
        );
        serverDirectChatBotsStore.subscribe((v) => (this.#serverDirectChatBots = v.clone()));
        walletConfigStore.subscribe((v) => (this.#walletConfig = v));
    }

    #proposalTopics = $derived.by(() => {
        if (
            this.#selectedChatSummary !== undefined &&
            this.#selectedChatSummary.kind !== "direct_chat" &&
            this.#selectedChatSummary.subtype !== undefined
        ) {
            if (this.#selectedChatSummary.subtype.isNns) {
                return new Map([
                    [1, "Neuron Management"],
                    [3, "Network Economics"],
                    [4, "Governance"],
                    [5, "Node Admin"],
                    [6, "Participant Management"],
                    [7, "Subnet Management"],
                    [8, "Network Canister Management"],
                    [9, "KYC"],
                    [10, "Node Provider Rewards"],
                    [12, "Subnet Replica Version Management"],
                    [13, "Replica Version Management"],
                    [14, "SNS & Neurons' Fund"],
                ]);
            } else {
                const snsFunctionsMap = this.snsFunctions.get(
                    this.#selectedChatSummary.subtype.governanceCanisterId,
                );
                if (snsFunctionsMap !== undefined) {
                    return new Map([...snsFunctionsMap].slice(1).map((e) => [e[0], e[1].name]));
                }
            }
        }

        return new Map();
    });

    #messageFormatter: MessageFormatter | undefined;

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

    #directChatBots = $derived.by(() => {
        return localUpdates.directChatBots.apply(this.#serverDirectChatBots);
    });

    // TODO - none of the references to userStore here will be reactive at the moment
    // this is only a temporary problem
    #currentChatBlockedOrSuspendedUsers = $derived.by(() => {
        const direct = get(hideMessagesFromDirectBlocked) ? [...userStore.blockedUsers] : [];
        return new Set<string>([
            ...this.#selectedChat.blockedUsers,
            ...this.#selectedCommunityBlockedUsers,
            ...userStore.suspendedUsers.keys(),
            ...direct,
        ]);
    });

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
            [...this.#serverFavourites.values()]
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

    // this *includes* any preview chats since they come from the server too
    #allServerChats = $derived.by(() => {
        const groupChats = this.#serverGroupChats.values();
        const directChats = this.#serverDirectChats.values();
        const channels = [...this.#serverCommunities.values()].flatMap((c) => c.channels);
        const all = ChatMap.fromList([...groupChats, ...directChats, ...channels]);
        const previewChannels = ChatMap.fromList(
            [...localUpdates.previewCommunities.values()].flatMap((c) => c.channels),
        );
        const done = all
            .merge(localUpdates.uninitialisedDirectChats)
            .merge(localUpdates.groupChatPreviews)
            .merge(previewChannels);
        console.log("All server chats: ", done);
        return done;
    });

    #userMetrics = $derived.by(() => {
        const empty = emptyChatMetrics();
        return this.#allServerChats.reduce((res, [_, chat]) => {
            return mergeChatMetrics(res, chat.membership?.myMetrics ?? empty);
        }, empty);
    });

    // Note that it's ok that this method mutates the input since it is
    // already a clone
    #applyLocalUpdatesToChat(chat: ChatSummary): ChatSummary {
        const local = chatDetailsLocalUpdates.get(chat.id);
        if (local === undefined) return chat;

        chat.membership.notificationsMuted =
            local.notificationsMuted ?? chat.membership.notificationsMuted;
        chat.membership.archived = local.archived ?? chat.membership.archived;
        chat.membership.rulesAccepted = local.rulesAccepted ?? chat.membership.rulesAccepted;
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
            chat.frozen = local.frozen ?? chat.frozen;
            chat.name = local.name ?? chat.name;
            chat.description = local.description ?? chat.description;
            chat.permissions = mergePermissions(chat.permissions, local?.permissions);
            chat.gateConfig = local.gateConfig ?? chat.gateConfig;
            if (local.eventsTTL !== undefined) {
                chat.eventsTTL = applyOptionUpdate(chat.eventsTTL, local.eventsTTL);
            }
            chat.public = local.isPublic ?? chat.public;
        }
        return chat;
    }

    // this is all server chats (which already include previews) + local updates applied.
    #allChats = $derived.by(() => {
        const withUpdates = localUpdates.chats.apply(this.#allServerChats);
        return [...withUpdates.entries()].reduce((result, [chatId, chat]) => {
            const clone = $state.snapshot(chat);
            const withLocal = this.#applyLocalUpdatesToChat(clone);
            const withUnconfirmed = mergeUnconfirmedIntoSummary(
                this.#messageFormatter ?? ((k) => k),
                this.#currentUserId,
                withLocal,
                messageLocalUpdates.data,
                this.#translations,
                this.#currentChatBlockedOrSuspendedUsers,
                this.#currentUserId,
                this.#messageFilters,
            );
            // only overwrite the chat if turns out to be different from the original to try
            // to minimise downstream effects
            result.set(chatId, dequal(chat, withUnconfirmed) ? chat : withUnconfirmed);
            return result;
        }, new ChatMap<ChatSummary>());
    });

    // all chats filtered by scope including previews and local updates
    // the final client view of chat summaries with all updates merged in
    #chatSummaries = $derived.by(() => {
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

    #chatSummariesList = $derived.by(() => {
        const pinnedByScope = this.#pinnedChats.get(this.#chatListScope.kind) ?? [];
        const pinned = pinnedByScope.reduce<ChatSummary[]>((result, id) => {
            const summary = this.#chatSummaries.get(id);
            if (summary !== undefined) {
                result.push(summary);
            }
            return result;
        }, []);
        const unpinned = [...this.#chatSummaries.values()]
            .filter(
                (chat) => pinnedByScope.findIndex((p) => chatIdentifiersEqual(p, chat.id)) === -1,
            )
            .sort(compareChats);
        return pinned.concat(unpinned);
    });

    #selectedChatSummary = $derived.by(
        withEqCheck(() => {
            if (this.#selectedChatId === undefined) return undefined;
            return this.#chatSummaries.get(this.#selectedChatId);
        }, dequal),
    );

    #isProposalGroup = $derived(
        this.#selectedChatSummary !== undefined &&
            this.#selectedChatSummary.kind !== "direct_chat" &&
            this.#selectedChatSummary.subtype?.kind === "governance_proposals",
    );

    #threadsByChat = $derived.by(() => {
        return [...this.#chatSummaries.entries()].reduce((result, [_, chat]) => {
            if (
                (chat.kind === "group_chat" || chat.kind === "channel") &&
                chat.membership &&
                chat.membership.latestThreads.length > 0
            ) {
                result.set(chat.id, chat.membership.latestThreads);
            }
            return result;
        }, new ChatMap<ThreadSyncDetails[]>());
    });

    #numberOfThreads = $derived(
        this.#threadsByChat.map((_, ts) => ts.length).reduce((total, [_, n]) => total + n, 0),
    );

    #threadsFollowedByMe = $derived.by(() => {
        return this.#threadsByChat.reduce<ChatMap<Set<number>>>((result, [chatId, threads]) => {
            const set = new Set<number>();
            for (const thread of threads) {
                set.add(thread.threadRootMessageIndex);
            }
            result.set(chatId, set);
            return result;
        }, new ChatMap<Set<number>>());
    });

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

    #communityChannelVideoCallCounts = $derived.by(() => {
        return [...this.#communities.entries()].reduce((map, [id, community]) => {
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

    #proposalTallies = new SvelteMap<string, Tally>();

    #identityState = $state<IdentityState>({ kind: "loading_user" });

    // TODO - this does not seem to be working as intended - investigate why

    #selectedServerChatSummary = $derived.by(() => {
        return this.#selectedChatId ? this.#allServerChats.get(this.#selectedChatId) : undefined;
    });

    #selectedChat = $state<ChatDetailsMergedState>(
        new ChatDetailsMergedState(ChatDetailsServerState.empty()),
    );

    #messagePermissionsForSelectedChat = $derived.by(() => {
        return getMessagePermissionsForSelectedChat(this.#selectedChatSummary, "message");
    });

    #currentChatDraftMessage = $derived(
        this.#selectedChatId
            ? localUpdates.draftMessages.get({ chatId: this.#selectedChatId })
            : undefined,
    );

    #currentThreadDraftMessage = $derived(
        this.#selectedChat.selectedThread?.id
            ? localUpdates.draftMessages.get(this.#selectedChat.selectedThread.id)
            : undefined,
    );

    #threadPermissionsForSelectedChat = $derived.by(() => {
        return getMessagePermissionsForSelectedChat(this.#selectedChatSummary, "thread");
    });

    setSnsFunctions(snsCanisterId: string, list: NervousSystemFunction[]) {
        snsFunctionsStore.update((s) => {
            const clone = s.clone();
            clone.set(snsCanisterId, list);
            return clone;
        });
    }

    get snsFunctions() {
        return snsFunctionsStore.current;
    }

    get proposalTopics(): ReadonlyMap<number, string> {
        return this.#proposalTopics;
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

    #resetFilteredProposals(chat: ChatSummary) {
        const filteredProposals = isProposalsChat(chat)
            ? FilteredProposals.fromStorage(chat.subtype.governanceCanisterId)
            : undefined;

        filteredProposalsStore.set(filteredProposals);
    }

    get currentChatDraftMessage() {
        return this.#currentChatDraftMessage;
    }

    get currentThreadDraftMessage() {
        return this.#currentThreadDraftMessage;
    }

    get messagePermissionsForSelectedChat() {
        return this.#messagePermissionsForSelectedChat;
    }

    get threadPermissionsForSelectedChat() {
        return this.#threadPermissionsForSelectedChat;
    }

    setCurrentUser(user: CreatedUser) {
        currentUserStore.set(user);
    }

    getProposalTally(governanceCanisterId: string, proposalId: bigint) {
        return this.#proposalTallies.get(`${governanceCanisterId}_${proposalId}`);
    }

    setProposalTally(governanceCanisterId: string, proposalId: bigint, tally: Tally) {
        this.#proposalTallies.set(`${governanceCanisterId}_${proposalId}`, tally);
    }

    get currentChatBlockedOrSuspendedUsers() {
        return this.#currentChatBlockedOrSuspendedUsers;
    }

    get communityFilters() {
        return communityFiltersStore;
    }

    get exploreCommunitiesFilters() {
        return this.#exploreCommunitiesFilters;
    }

    toggleCommunityFilterLanguage(lang: string) {
        if (communityFiltersStore.current.has(lang)) {
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
        translationsStore.set(messageId, translation);
    }

    untranslate(messageId: bigint) {
        translationsStore.delete(messageId);
    }

    set selectedAuthProvider(p: AuthProvider) {
        selectedAuthProviderStore.set(p);
    }

    get selectedAuthProvider() {
        return selectedAuthProviderStore.current;
    }

    set userCreated(val: boolean) {
        userCreatedStore.set(val);
    }

    get userCreated() {
        return userCreatedStore.current;
    }

    set storage(val: StorageStatus) {
        storageStore.set(val);
    }

    get storage() {
        return storageStore.current;
    }

    get percentageStorageRemaining() {
        return this.#percentageStorageRemaining;
    }

    get percentageStorageUsed() {
        return this.#percentageStorageUsed;
    }

    get storageInGB() {
        return this.#storageInGB;
    }

    get locale() {
        return this.#locale;
    }

    get offline() {
        return this.#offline;
    }

    get messageFilters() {
        return this.#messageFilters;
    }

    set messageFilters(val: MessageFilter[]) {
        messageFiltersStore.set(val);
    }

    get currentUser() {
        return currentUserStore.current;
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

    get achievements(): ReadonlySet<string> {
        return achievementsStore;
    }

    get messageActivitySummary() {
        return this.#messageActivitySummary;
    }

    get chitState() {
        return chitStateStore.current;
    }

    updateChitState(fn: (s: ChitState) => ChitState) {
        chitStateStore.update(fn);
    }

    get walletConfig() {
        return this.#walletConfig;
    }

    get directChatBots() {
        return this.#directChatBots;
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
        return chatsInitialisedStore.current;
    }

    get chatListScope() {
        return this.#chatListScope;
    }

    set chatsInitialised(val: boolean) {
        chatsInitialisedStore.set(val);
    }

    get selectedCommunityId() {
        return this.#selectedCommunityId;
    }

    get selectedChatId() {
        return this.#selectedChatId;
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
                $state.snapshot(chatId),
            );
            return;
        }
        const serverState = ChatDetailsServerState.empty(chatId);
        this.#selectedChat = new ChatDetailsMergedState(serverState);
        if (this.#selectedChatSummary) {
            this.#resetFilteredProposals(this.#selectedChatSummary);
        }
    }

    setDirectChatDetails(chatId: DirectChatIdentifier, currentUserId: string) {
        if (!chatIdentifiersEqual(chatId, this.#selectedChatId)) {
            console.warn(
                "Attempting to set direct chat details on the wrong chat - probably a stale response",
                $state.snapshot(chatId),
                $state.snapshot(this.#selectedChatId),
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
        webhooks: Map<string, WebhookDetails>,
    ) {
        if (!chatIdentifiersEqual(chatId, this.#selectedChatId)) {
            console.warn(
                "Attempting to set chat details on the wrong chat - probably a stale response",
                $state.snapshot(chatId),
                $state.snapshot(this.#selectedChatId),
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
                $state.snapshot(communityId),
                $state.snapshot(this.#selectedCommunityId),
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

    // TODO - this is only called from tests
    set serverCommunities(val: CommunityMap<CommunitySummary>) {
        serverCommunitiesStore.fromMap(val);
    }

    get serverCommunities() {
        return serverCommunitiesStore;
    }

    get chatSummaries() {
        return this.#chatSummaries;
    }

    get chatSummariesList() {
        return this.#chatSummariesList;
    }

    get selectedChatSummary() {
        return this.#selectedChatSummary;
    }

    get isProposalGroup() {
        return this.#isProposalGroup;
    }

    get threadsByChat() {
        return this.#threadsByChat;
    }

    get numberOfThreads() {
        return this.#numberOfThreads;
    }

    get threadsFollowedByMe() {
        return this.#threadsFollowedByMe;
    }

    get communities() {
        return this.#communities;
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
        serverMessageActivitySummaryStore.set(messageActivitySummary);
        achievementsStore.fromSet(achievements);
        referralsStore.set(referrals);

        // TODO - do we need to separate these things - each of these fromMap calls will result in a publish
        // which will cause downstream deriveds to fire. It *might* be better to refactor into a single store - we shall see.
        // Or - this might be the case for a "transaction".
        serverDirectChatsStore.fromMap(directChatsMap);
        serverGroupChatsStore.fromMap(groupChatsMap);
        serverFavouritesStore.fromSet(favouritesSet);
        serverCommunitiesStore.fromMap(communitiesMap);
        serverPinnedChatsStore.fromMap(pinnedChats);
        directChatApiKeysStore.fromMap(apiKeys);
        serverDirectChatBotsStore.fromMap(installedBots);
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

    set messageFormatter(val: MessageFormatter) {
        this.#messageFormatter = val;
    }

    get pinNumberRequired() {
        return pinNumberRequiredStore.current;
    }

    set pinNumberRequired(val: boolean | undefined) {
        pinNumberRequiredStore.set(val);
    }

    get pinNumberResolver() {
        return pinNumberResolverStore.current;
    }

    set pinNumberResolver(val: PinNumberResolver | undefined) {
        pinNumberResolverStore.set(val);
    }

    get pinNumberFailure() {
        return pinNumberFailureStore.current;
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
        return serverStreakInsuranceStore.current;
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
