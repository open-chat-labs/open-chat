import { dequal } from "dequal";
import DRange from "drange";
import {
    ANON_USER_ID,
    anonymousUser,
    applyOptionUpdate,
    AuthProvider,
    chatIdentifiersEqual,
    ChatMap,
    ChatSet,
    CommunityMap,
    compareChats,
    DEFAULT_TOKENS,
    emptyChatMetrics,
    mergeListOfCombinedUnreadCounts,
    MessageMap,
    ModerationFlags,
    SafeMap,
    videoCallsInProgressForChats,
    type ChatEvent,
    type ChatSummary,
    type ChitState,
    type CombinedUnreadCounts,
    type CommunitySummary,
    type CreatedUser,
    type CryptocurrencyDetails,
    type DirectChatSummary,
    type EnhancedTokenDetails,
    type EventWrapper,
    type ExternalBotPermissions,
    type GroupChatSummary,
    type IdentityState,
    type Member,
    type MessageActivitySummary,
    type MessageFilter,
    type ModerationFlag,
    type NervousSystemDetails,
    type NotificationStatus,
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
    type ThreadSyncDetails,
    type TokenExchangeRates,
    type UserGroupDetails,
    type UserGroupSummary,
    type VideoCallCounts,
    type WalletConfig,
    type WebhookDetails,
} from "openchat-shared";
import { derived as svelteDerived } from "svelte/store";
import {
    getMessagePermissionsForSelectedChat,
    mergeChatMetrics,
    mergeEventsAndLocalUpdates,
    mergePermissions,
    mergeUnconfirmedIntoSummary,
} from "../../utils/chat";
import { configKeys } from "../../utils/config";
import { enumFromStringValue } from "../../utils/enums";
import { setsAreEqual } from "../../utils/set";
import { derived, writable } from "../../utils/stores";
import { chatDetailsLocalUpdates } from "../chat/detailsUpdates";
import type { ChatDetailsState } from "../chat/serverDetails";
import { chatSummaryLocalUpdates, ChatSummaryUpdates } from "../chat/summaryUpdates";
import { communityLocalUpdates } from "../community/detailUpdates";
import type { CommunityDetailsState } from "../community/server";
import { communitySummaryLocalUpdates } from "../community/summaryUpdates";
import type { FilteredProposals } from "../filteredProposals.svelte";
import { LocalStorageBoolStore, LocalStorageStore } from "../localStorageStore";
import { localUpdates } from "../localUpdates";
import { messageLocalUpdates } from "../message/localUpdates";
import { routeStore, selectedCommunityIdStore } from "../path/stores";
import { SnsFunctions } from "../snsFunctions.svelte";
import { hideMessagesFromDirectBlocked } from "../ui/stores";
import { messagesRead } from "../unread/markRead";
import { blockedUsersStore, suspendedUsersStore } from "../users/stores";
import { notEq } from "../utils";

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

export const cryptoLookup = writable<ReadonlyMap<LedgerCanister, CryptocurrencyDetails>>(
    new SafeMap(),
);
export const nervousSystemLookup = writable<ReadonlyMap<GovernanceCanister, NervousSystemDetails>>(
    new SafeMap(),
);
export const exchangeRatesLookupStore = writable<ReadonlyMap<string, TokenExchangeRates>>(
    new SafeMap(),
);

function createCryptoBalanceStore() {
    const store = writable<Map<LedgerCanister, bigint>>(new Map(), undefined, notEq);
    return {
        value: store.value,
        subscribe: store.subscribe,
        setBalance(ledger: string, balance: bigint) {
            store.update((s) => s.set(ledger, balance));
            cryptoBalancesLastUpdated.set(ledger, Date.now());
        },
        valueIfUpdatedRecently(ledger: string): bigint | undefined {
            const lastUpdated = cryptoBalancesLastUpdated.get(ledger);
            if (lastUpdated === undefined) {
                return undefined;
            }
            return Date.now() - lastUpdated < 5 * 60 * 1000 ? store.value.get(ledger) : undefined;
        },
    };
}

export const cryptoBalanceStore = createCryptoBalanceStore();
const cryptoBalancesLastUpdated = new Map<string, number>();

export const bitcoinAddress = writable<string | undefined>(undefined);

export const lastCryptoSent = new LocalStorageStore<string | undefined>(
    configKeys.lastCryptoSent,
    undefined,
);

export const enhancedCryptoLookup = svelteDerived(
    [cryptoLookup, cryptoBalanceStore, exchangeRatesLookupStore],
    ([$lookup, $balance, $exchangeRatesLookup]) => {
        const xrICPtoDollar = $exchangeRatesLookup.get("icp")?.toUSD;
        const xrBTCtoDollar = $exchangeRatesLookup.get("btc")?.toUSD;
        const xrETHtoDollar = $exchangeRatesLookup.get("eth")?.toUSD;

        const xrDollarToICP = xrICPtoDollar === undefined ? 0 : 1 / xrICPtoDollar;
        const xrDollarToBTC = xrBTCtoDollar === undefined ? 0 : 1 / xrBTCtoDollar;
        const xrDollarToETH = xrETHtoDollar === undefined ? 0 : 1 / xrETHtoDollar;

        return [...$lookup.entries()].reduce((result, [key, t]) => {
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

export const cryptoTokensSorted = svelteDerived([enhancedCryptoLookup], ([$lookup]) => {
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

export const walletConfigStore = svelteDerived(
    [serverWalletConfigStore, localUpdates.walletConfig],
    ([serverWalletConfig, localUpates]) => localUpates ?? serverWalletConfig,
);

export const walletTokensSorted = svelteDerived(
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

export const percentageStorageUsedStore = svelteDerived(storageStore, (storage) =>
    Math.ceil((storage.bytesUsed / storage.byteLimit) * 100),
);

export const percentageStorageRemainingStore = svelteDerived(storageStore, (storage) =>
    Math.floor((1 - storage.bytesUsed / storage.byteLimit) * 100),
);

export const storageInGBStore = svelteDerived(storageStore, (storage) => ({
    gbLimit: storage.byteLimit / ONE_GB,
    gbUsed: storage.bytesUsed / ONE_GB,
}));

export const messageFiltersStore = writable<MessageFilter[]>([]);
export const translationsStore = writable<MessageMap<string>>(new MessageMap());
export const snsFunctionsStore = writable<SnsFunctions>(new SnsFunctions());
export const filteredProposalsStore = writable<FilteredProposals | undefined>(undefined);
export const currentUserStore = writable<CreatedUser>(anonymousUser(), undefined, dequal);
export const currentUserIdStore = derived(currentUserStore, ({ userId }) => userId);
export const anonUserStore = svelteDerived(currentUserIdStore, (id) => id === ANON_USER_ID);
export const suspendedUserStore = svelteDerived(
    currentUserStore,
    (user) => user.suspensionDetails !== undefined,
);
export const platformModeratorStore = svelteDerived(
    currentUserStore,
    (user) => user.isPlatformModerator,
);
export const platformOperatorStore = svelteDerived(
    currentUserStore,
    (user) => user.isPlatformOperator,
);
export const diamondStatusStore = svelteDerived(currentUserStore, (user) => user.diamondStatus);
export const isDiamondStore = svelteDerived(
    diamondStatusStore,
    (diamondStatus) =>
        diamondStatus.kind === "lifetime" ||
        (diamondStatus.kind === "active" && diamondStatus.expiresAt > Date.now()),
);
export const isLifetimeDiamondStore = svelteDerived(
    diamondStatusStore,
    (diamondStatus) => diamondStatus.kind === "lifetime",
);
export const canExtendDiamondStore = svelteDerived(
    diamondStatusStore,
    (diamondStatus) => diamondStatus.kind === "active",
);
export const moderationFlagsEnabledStore = svelteDerived(
    currentUserStore,
    ({ moderationFlagsEnabled }) => moderationFlagsEnabled,
);
export const adultEnabledStore = svelteDerived(
    moderationFlagsEnabledStore,
    (moderationFlagsEnabled) => hasFlag(moderationFlagsEnabled, ModerationFlags.Adult),
);
export const offensiveEnabledStore = svelteDerived(
    moderationFlagsEnabledStore,
    (moderationFlagsEnabled) => hasFlag(moderationFlagsEnabled, ModerationFlags.Offensive),
);
export const underReviewEnabledStore = svelteDerived(
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

export const notificationStatus = svelteDerived(
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
export const exploreCommunitiesFiltersStore = svelteDerived(
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
export const achievementsStore = writable<Set<string>>(new Set());
export const chitStateStore = writable<ChitState>(
    {
        chitBalance: 0,
        totalChitEarned: 0,
        streak: 0,
        streakEnds: 0n,
        nextDailyChitClaim: 0n,
    },
    undefined,
    dequal,
);

export const serverCommunitiesStore = writable<CommunityMap<CommunitySummary>>(
    new CommunityMap<CommunitySummary>(),
);

export const communitiesStore = svelteDerived(
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

export const sortedCommunitiesStore = svelteDerived(communitiesStore, (communities) => {
    return [...communities.values()].toSorted((a, b) => {
        return b.membership.index === a.membership.index
            ? b.memberCount - a.memberCount
            : b.membership.index - a.membership.index;
    });
});

export const nextCommunityIndexStore = svelteDerived(
    sortedCommunitiesStore,
    (sortedCommunitiesStore) => (sortedCommunitiesStore[0]?.membership?.index ?? -1) + 1,
);

export const userGroupSummariesStore = svelteDerived(communitiesStore, (communities) => {
    return [...communities.values()].reduce((map, community) => {
        community.userGroups.forEach((ug) => map.set(ug.id, ug));
        return map;
    }, new Map<number, UserGroupSummary>());
});

export const selectedChatIdStore = svelteDerived(routeStore, (route) => {
    switch (route.kind) {
        case "selected_channel_route":
        case "global_chat_selected_route":
            return route.chatId;
        default:
            return undefined;
    }
});

export const chatListScopeStore = svelteDerived(routeStore, (route) => route.scope);
export const chatsInitialisedStore = writable(false);
export const selectedServerCommunityStore = writable<CommunityDetailsState | undefined>(undefined);

export const selectedCommunityMembersStore = svelteDerived(
    [selectedServerCommunityStore, communityLocalUpdates.members],
    ([community, members]) => {
        if (community === undefined) return new Map() as ReadonlyMap<string, Member>;
        const updates = members.get(community.communityId);
        if (updates === undefined) return community.members;
        return updates.apply(community.members);
    },
);

export const selectedCommunityBotsStore = svelteDerived(
    [selectedServerCommunityStore, communityLocalUpdates.bots],
    ([community, bots]) => {
        if (community === undefined)
            return new Map() as ReadonlyMap<string, ExternalBotPermissions>;
        const updates = bots.get(community.communityId);
        if (updates === undefined) return community.bots;
        return updates.apply(community.bots);
    },
);
export const selectedCommunityUserGroupsStore = svelteDerived(
    [selectedServerCommunityStore, communityLocalUpdates.userGroups],
    ([community, userGroups]) => {
        if (community === undefined) return new Map() as ReadonlyMap<number, UserGroupDetails>;
        const updates = userGroups.get(community.communityId);
        if (updates === undefined) return community.userGroups;
        return updates.apply(community.userGroups);
    },
);
export const selectedCommunityInvitedUsersStore = svelteDerived(
    [selectedServerCommunityStore, communityLocalUpdates.invitedUsers],
    ([community, invitedUsers]) => {
        if (community === undefined) return new Set() as ReadonlySet<string>;
        const updates = invitedUsers.get(community.communityId);
        if (updates === undefined) return community.invitedUsers;
        return updates.apply(community.invitedUsers);
    },
);
export const selectedCommunityBlockedUsersStore = svelteDerived(
    [selectedServerCommunityStore, communityLocalUpdates.blockedUsers],
    ([community, blockedUsers]) => {
        if (community === undefined) return new Set() as ReadonlySet<string>;
        const updates = blockedUsers.get(community.communityId);
        if (updates === undefined) return community.blockedUsers;
        return updates.apply(community.blockedUsers);
    },
);
export const selectedCommunityRulesStore = svelteDerived(
    [selectedServerCommunityStore, communityLocalUpdates.rules],
    ([community, rules]) => {
        if (community === undefined) return undefined;
        const updates = rules.get(community.communityId);
        return updates ?? community.rules;
    },
);
export const selectedCommunityLapsedMembersStore = svelteDerived(
    selectedServerCommunityStore,
    (selectedCommunity) => selectedCommunity?.lapsedMembers ?? (new Set() as ReadonlySet<string>),
);
export const selectedCommunityApiKeysStore = svelteDerived(
    selectedServerCommunityStore,
    (selectedCommunity) =>
        selectedCommunity?.apiKeys ?? (new Map() as ReadonlyMap<string, PublicApiKeyDetails>),
);
export const selectedCommunityReferralsStore = svelteDerived(
    selectedServerCommunityStore,
    (selectedCommunity) => selectedCommunity?.referrals ?? (new Set() as ReadonlySet<string>),
);
export const selectedCommunitySummaryStore = svelteDerived(
    [selectedCommunityIdStore, communitiesStore],
    ([selectedCommunityId, communities]) =>
        selectedCommunityId ? communities.get(selectedCommunityId) : undefined,
);

export const selectedServerChatStore = writable<ChatDetailsState | undefined>(undefined);
export const selectedChatMembersStore = svelteDerived(
    [selectedServerChatStore, chatDetailsLocalUpdates.members],
    ([chat, members]) => {
        if (chat === undefined) return new Map() as ReadonlyMap<string, Member>;
        return members.get(chat.chatId)?.apply(chat.members) ?? chat.members;
    },
);
export const selectedChatBlockedUsersStore = svelteDerived(
    [selectedServerChatStore, chatDetailsLocalUpdates.blockedUsers],
    ([chat, blockedUsers]) => {
        if (chat === undefined) return new Set() as ReadonlySet<string>;
        return blockedUsers.get(chat.chatId)?.apply(chat.blockedUsers) ?? chat.blockedUsers;
    },
);
export const selectedChatLapsedMembersStore = svelteDerived([selectedServerChatStore], ([chat]) => {
    return chat?.lapsedMembers ?? (new Set() as ReadonlySet<string>);
});
export const selectedChatPinnedMessagesStore = svelteDerived(
    [selectedServerChatStore, chatDetailsLocalUpdates.pinnedMessages],
    ([chat, pinnedMessages]) => {
        if (chat === undefined) return new Set() as ReadonlySet<number>;
        return pinnedMessages.get(chat.chatId)?.apply(chat.pinnedMessages) ?? chat.pinnedMessages;
    },
);
export const selectedChatInvitedUsersStore = svelteDerived(
    [selectedServerChatStore, chatDetailsLocalUpdates.invitedUsers],
    ([chat, invitedUsers]) => {
        if (chat === undefined) return new Set() as ReadonlySet<string>;
        return invitedUsers.get(chat.chatId)?.apply(chat.invitedUsers) ?? chat.invitedUsers;
    },
);
export const selectedChatBotsStore = svelteDerived(
    [selectedServerChatStore, chatDetailsLocalUpdates.bots],
    ([chat, bots]) => {
        if (chat === undefined) return new Map() as ReadonlyMap<string, ExternalBotPermissions>;
        return bots.get(chat.chatId)?.apply(chat.bots) ?? chat.bots;
    },
);
export const selectedChatApiKeysStore = svelteDerived(
    [selectedServerChatStore, chatDetailsLocalUpdates.apiKeys],
    ([chat, apiKeys]) => {
        if (chat === undefined) return new Map() as ReadonlyMap<string, PublicApiKeyDetails>;
        return apiKeys.get(chat.chatId)?.apply(chat.apiKeys) ?? chat.apiKeys;
    },
);
export const selectedChatWebhooksStore = svelteDerived(
    [selectedServerChatStore, chatDetailsLocalUpdates.webhooks],
    ([chat, webhooks]) => {
        if (chat === undefined) return new Map() as ReadonlyMap<string, WebhookDetails>;
        return webhooks.get(chat.chatId)?.apply(chat.webhooks) ?? chat.webhooks;
    },
);
export const selectedChatRulesStore = svelteDerived(
    [selectedServerChatStore, chatDetailsLocalUpdates.rules],
    ([chat, rules]) => {
        if (chat === undefined) return undefined;
        return rules.get(chat.chatId) ?? chat.rules;
    },
);

// export const serverDirectChatsStore = new ChatMapStore<DirectChatSummary>();
export const serverDirectChatsStore = writable<ChatMap<DirectChatSummary>>(new ChatMap());
export const serverGroupChatsStore = writable<ChatMap<GroupChatSummary>>(new ChatMap());
export const serverFavouritesStore = writable<ChatSet>(new ChatSet());
export const serverPinnedChatsStore = writable<PinnedByScope>(new Map());
export const directChatApiKeysStore = writable<Map<string, PublicApiKeyDetails>>(new Map());
export const serverMessageActivitySummaryStore = writable<MessageActivitySummary>({
    readUpToTimestamp: 0n,
    latestTimestamp: 0n,
    unreadCount: 0,
});
export const pinnedChatsStore = svelteDerived(
    [serverPinnedChatsStore, chatDetailsLocalUpdates.pinnedToScopes],
    ([serverPinnedChats, localUpdates]) => {
        const mergedPinned = new Map(serverPinnedChats);

        for (const [chatId, updates] of localUpdates.entries()) {
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
    },
);

export const serverDirectChatBotsStore = writable<Map<string, ExternalBotPermissions>>(new Map());
export const serverStreakInsuranceStore = writable<StreakInsurance>({
    daysInsured: 0,
    daysMissed: 0,
});
export const referralsStore = writable<Referral[]>([]);
export const streakInsuranceStore = svelteDerived(
    [serverStreakInsuranceStore, localUpdates.streakInsurance],
    ([serverStreakInsurance, localUpates]) => localUpates ?? serverStreakInsurance,
);
export const allServerChatsStore = derived(
    [
        serverGroupChatsStore,
        serverDirectChatsStore,
        serverCommunitiesStore,
        localUpdates.previewCommunities,
        localUpdates.uninitialisedDirectChats,
        localUpdates.groupChatPreviews,
    ],
    ([
        serverGroupChats,
        serverDirectChats,
        serverCommunities,
        previewCommunities,
        uninitialisedDirectChats,
        groupChatPreviews,
    ]) => {
        const groupChats = serverGroupChats.values();
        const directChats = serverDirectChats.values();
        const channels = [...serverCommunities.values()].flatMap((c) => c.channels);
        const all = ChatMap.fromList([...groupChats, ...directChats, ...channels]);
        const previewChannels = ChatMap.fromList(
            [...previewCommunities.values()].flatMap((c) => c.channels),
        );
        const done = all
            .merge(uninitialisedDirectChats)
            .merge(groupChatPreviews)
            .merge(previewChannels);
        return done;
    },
);

export const userMetricsStore = derived(allServerChatsStore, (allServerChats) => {
    const empty = emptyChatMetrics();
    return allServerChats.reduce((res, [_, chat]) => {
        return mergeChatMetrics(res, chat.membership?.myMetrics ?? empty);
    }, empty);
});

export const unreadFavouriteCountsStore = svelteDerived(
    [serverFavouritesStore, allServerChatsStore, messagesRead],
    ([serverFavourites, allServerChats, messagesRead]) => {
        const chats = ChatMap.fromList(
            [...serverFavourites.values()]
                .map((id) => allServerChats.get(id))
                .filter((chat) => chat !== undefined) as ChatSummary[],
        );
        return messagesRead.combinedUnreadCountForChats(chats);
    },
);

export const favouritesVideoCallCountsStore = svelteDerived(
    [serverFavouritesStore, allServerChatsStore],
    ([serverFavourites, allServerChats]) => {
        const chats = [...serverFavourites.values()].map((id) => allServerChats.get(id));
        return videoCallsInProgressForChats(chats);
    },
);

export const selectedServerChatSummaryStore = svelteDerived(
    [selectedChatIdStore, allServerChatsStore],
    ([selectedChatId, allServerChats]) => {
        return selectedChatId ? allServerChats.get(selectedChatId) : undefined;
    },
);

function applyLocalUpdatesToChat(chat: ChatSummary, updates?: ChatSummaryUpdates): ChatSummary {
    if (updates === undefined) return chat;

    chat.membership.notificationsMuted =
        updates.notificationsMuted ?? chat.membership.notificationsMuted;
    chat.membership.archived = updates.archived ?? chat.membership.archived;
    chat.membership.rulesAccepted = updates.rulesAccepted ?? chat.membership.rulesAccepted;
    const latestMessage =
        (updates?.latestMessage?.timestamp ?? BigInt(-1)) >
        (chat.latestMessage?.timestamp ?? BigInt(-1))
            ? updates?.latestMessage
            : chat.latestMessage;
    const latestEventIndex = Math.max(latestMessage?.index ?? 0, chat.latestEventIndex);
    chat.latestMessage = latestMessage;
    chat.latestMessageIndex = latestMessage?.event?.messageIndex;
    chat.latestEventIndex = latestEventIndex;

    if (chat.kind !== "direct_chat") {
        chat.frozen = updates.frozen ?? chat.frozen;
        chat.name = updates.name ?? chat.name;
        chat.description = updates.description ?? chat.description;
        chat.permissions = mergePermissions(chat.permissions, updates?.permissions);
        chat.gateConfig = updates.gateConfig ?? chat.gateConfig;
        if (updates.eventsTTL !== undefined) {
            chat.eventsTTL = applyOptionUpdate(chat.eventsTTL, updates.eventsTTL);
        }
        chat.public = updates.isPublic ?? chat.public;
    }
    return chat;
}

export const selectedChatBlockedOrSuspendedUsersStore = derived(
    [
        blockedUsersStore,
        hideMessagesFromDirectBlocked,
        selectedChatBlockedUsersStore,
        selectedCommunityBlockedUsersStore,
        suspendedUsersStore,
    ],
    ([
        blockedUsers,
        hideMessagesFromDirectBlocked,
        selectedChatBlockedUsers,
        selectedCommunityBlockedUsers,
        suspendedUsers,
    ]) => {
        const direct = hideMessagesFromDirectBlocked ? [...blockedUsers] : [];
        return new Set<string>([
            ...selectedChatBlockedUsers,
            ...selectedCommunityBlockedUsers,
            ...suspendedUsers.keys(),
            ...direct,
        ]);
    },
);

// this is all server chats (which already include previews) + local updates applied.
export const allChatsStore = derived(
    [
        allServerChatsStore,
        localUpdates.chats,
        chatSummaryLocalUpdates,
        translationsStore,
        currentUserIdStore,
        messageFiltersStore,
        selectedChatBlockedOrSuspendedUsersStore,
        messageLocalUpdates,
        localUpdates.unconfirmed,
    ],
    ([
        allServerChats,
        localChats,
        localUpdates,
        translations,
        currentUserId,
        messageFilters,
        selectedChatBlockedOrSuspendedUsers,
        messageLocalUpdates,
        unconfirmed,
    ]) => {
        const withUpdates = localChats.apply(allServerChats);
        return [...withUpdates.entries()].reduce((result, [chatId, chat]) => {
            const clone = structuredClone(chat);
            const withLocal = applyLocalUpdatesToChat(clone, localUpdates.get(clone.id));
            const withUnconfirmed = mergeUnconfirmedIntoSummary(
                (k) => k,
                currentUserId,
                withLocal,
                messageLocalUpdates,
                translations,
                selectedChatBlockedOrSuspendedUsers,
                currentUserId,
                messageFilters,
                unconfirmed,
            );
            // only overwrite the chat if turns out to be different from the original to try
            // to minimise downstream effects
            result.set(chatId, dequal(chat, withUnconfirmed) ? chat : withUnconfirmed);
            return result;
        }, new ChatMap<ChatSummary>());
    },
);

export const favouritesStore = svelteDerived(
    [serverFavouritesStore, localUpdates.favourites],
    ([serverFavourites, local]) => {
        return local.apply(serverFavourites);
    },
);

// all chats filtered by scope including previews and local updates
// the final client view of chat summaries with all updates merged in
export const chatSummariesStore = svelteDerived(
    [chatListScopeStore, allChatsStore, favouritesStore],
    ([chatListScope, allChats, favourites]) => {
        switch (chatListScope.kind) {
            case "community": {
                const communityId = chatListScope.id.communityId;
                return allChats.filter(
                    (c) => c.kind === "channel" && c.id.communityId === communityId,
                );
            }
            case "group_chat":
                return allChats.filter((c) => c.kind === "group_chat");
            case "direct_chat":
                return allChats.filter((c) => c.kind === "direct_chat");
            case "favourite": {
                return [...favourites.values()].reduce((favs, chatId) => {
                    const chat = allChats.get(chatId);
                    if (chat !== undefined) {
                        favs.set(chat.id, chat);
                    }
                    return favs;
                }, new ChatMap<ChatSummary>());
            }
            default:
                return new ChatMap<ChatSummary>();
        }
    },
);

export const chatSummariesListStore = svelteDerived(
    [pinnedChatsStore, chatListScopeStore, chatSummariesStore],
    ([pinnedChats, chatListScope, chatSummaries]) => {
        const pinnedByScope = pinnedChats.get(chatListScope.kind) ?? [];
        const pinned = pinnedByScope.reduce<ChatSummary[]>((result, id) => {
            const summary = chatSummaries.get(id);
            if (summary !== undefined) {
                result.push(summary);
            }
            return result;
        }, []);
        const unpinned = [...chatSummaries.values()]
            .filter(
                (chat) => pinnedByScope.findIndex((p) => chatIdentifiersEqual(p, chat.id)) === -1,
            )
            .sort(compareChats);
        return pinned.concat(unpinned);
    },
);

export const selectedChatSummaryStore = svelteDerived(
    [selectedChatIdStore, chatSummariesStore],
    ([selectedChatId, chatSummaries]) => {
        if (selectedChatId === undefined) return undefined;
        return chatSummaries.get(selectedChatId);
    },
);
export const proposalTopicsStore = svelteDerived(
    [selectedChatSummaryStore, snsFunctionsStore],
    ([selectedChatSummary, snsFunctions]) => {
        if (
            selectedChatSummary !== undefined &&
            selectedChatSummary.kind !== "direct_chat" &&
            selectedChatSummary.subtype !== undefined
        ) {
            if (selectedChatSummary.subtype.isNns) {
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
                const snsFunctionsMap = snsFunctions.get(
                    selectedChatSummary.subtype.governanceCanisterId,
                );
                if (snsFunctionsMap !== undefined) {
                    return new Map([...snsFunctionsMap].slice(1).map((e) => [e[0], e[1].name]));
                }
            }
        }
        return new Map();
    },
);

export const isProposalGroupStore = svelteDerived(
    [selectedChatSummaryStore],
    ([selectedChatSummary]) => {
        return (
            selectedChatSummary !== undefined &&
            selectedChatSummary.kind !== "direct_chat" &&
            selectedChatSummary.subtype?.kind === "governance_proposals"
        );
    },
);

export const threadsByChatStore = svelteDerived([chatSummariesStore], ([chatSummaries]) => {
    return [...chatSummaries.entries()].reduce((result, [_, chat]) => {
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

export const numberOfThreadsStore = svelteDerived(threadsByChatStore, (threadsByChat) =>
    threadsByChat.map((_, ts) => ts.length).reduce((total, [_, n]) => total + n, 0),
);

export const threadsFollowedByMeStore = svelteDerived(threadsByChatStore, (threadsByChat) => {
    return threadsByChat.reduce<ChatMap<Set<number>>>((result, [chatId, threads]) => {
        const set = new Set<number>();
        for (const thread of threads) {
            set.add(thread.threadRootMessageIndex);
        }
        result.set(chatId, set);
        return result;
    }, new ChatMap<Set<number>>());
});

export const messagePermissionsForSelectedChatStore = svelteDerived(
    selectedChatSummaryStore,
    (selectedChatSummary) => {
        return getMessagePermissionsForSelectedChat(selectedChatSummary, "message");
    },
);
export const threadPermissionsForSelectedChatStore = svelteDerived(
    selectedChatSummaryStore,
    (selectedChatSummary) => {
        return getMessagePermissionsForSelectedChat(selectedChatSummary, "thread");
    },
);
export const proposalTalliesStore = new SafeMapStore<string, Tally>();

export const selectedChatDraftMessageStore = svelteDerived(
    [selectedChatIdStore, localUpdates.draftMessages],
    ([selectedChatId, draftMessages]) =>
        selectedChatId ? draftMessages.get({ chatId: selectedChatId }) : undefined,
);

export const communityChannelVideoCallCountsStore = svelteDerived(
    [communitiesStore],
    ([communities]) => {
        return [...communities.entries()].reduce((map, [id, community]) => {
            map.set(id, videoCallsInProgressForChats(community.channels));
            return map;
        }, new CommunityMap<VideoCallCounts>());
    },
);

export const groupVideoCallCountsStore = svelteDerived(
    serverGroupChatsStore,
    (serverGroupChats) => {
        return videoCallsInProgressForChats([...serverGroupChats.values()]);
    },
);

export const directVideoCallCountsStore = svelteDerived(
    serverDirectChatsStore,
    (serverDirectChats) => {
        return videoCallsInProgressForChats([...serverDirectChats.values()]);
    },
);

export const serverEventsStore = writable<EventWrapper<ChatEvent>[]>([]);
export const serverThreadEventsStore = writable<EventWrapper<ChatEvent>[]>([]);
export const expiredServerEventRanges = writable<DRange>(new DRange());

export const eventsStore = svelteDerived(
    [
        serverEventsStore,
        expiredServerEventRanges,
        selectedChatIdStore,
        localUpdates.failedMessages,
        localUpdates.unconfirmed,
        localUpdates.ephemeral,
        translationsStore,
        selectedChatBlockedOrSuspendedUsersStore,
        messageLocalUpdates,
        localUpdates.recentlySentMessages,
        messageFiltersStore,
    ],
    ([
        serverEvents,
        expiredEventRanges,
        selectedChatId,
        failedMessages,
        unconfirmedMessages,
        ephemeralMessages,
        translations,
        selectedChatBlockedOrSuspendedUsers,
        messageLocalUpdates,
        recentlySentMessages,
        messageFilters,
    ]) => {
        if (selectedChatId === undefined) return [];
        const ctx = { chatId: selectedChatId };
        const failedState = failedMessages.get(ctx);
        const failed = failedState ? [...failedState.values()] : [];
        const unconfirmedState = unconfirmedMessages.get(ctx);
        const unconfirmed = unconfirmedState ? [...unconfirmedState.values()] : [];
        const ephemeralState = ephemeralMessages.get(ctx);
        const ephemeral = ephemeralState ? [...ephemeralState.values()] : [];
        return mergeEventsAndLocalUpdates(
            serverEvents,
            [...unconfirmed, ...failed, ...ephemeral],
            expiredEventRanges,
            translations,
            selectedChatBlockedOrSuspendedUsers,
            messageLocalUpdates,
            recentlySentMessages,
            messageFilters,
        );
    },
);

export const confirmedEventIndexesLoadedStore = svelteDerived(
    [eventsStore, expiredServerEventRanges],
    ([events, expiredEventRanges]) => {
        const ranges = new DRange();
        events.forEach((e) => ranges.add(e.index));
        ranges.add(expiredEventRanges);
        return ranges;
    },
);

export const messageActivitySummaryStore = svelteDerived(
    [serverMessageActivitySummaryStore, localUpdates.messageActivityFeedReadUpTo],
    ([serverMessageActivitySummary, readUpTo]) => {
        if (readUpTo !== undefined && readUpTo >= serverMessageActivitySummary.latestTimestamp) {
            return {
                ...serverMessageActivitySummary,
                unreadCount: 0,
            };
        }
        return serverMessageActivitySummary;
    },
);

export const directChatBotsStore = svelteDerived(
    [serverDirectChatBotsStore, localUpdates.directChatBots],
    ([serverDirectChatBots, local]) => {
        return local.apply(serverDirectChatBots);
    },
);

export const unreadGroupCountsStore = svelteDerived(
    [serverGroupChatsStore, messagesRead],
    ([serverGroupChats, messagesRead]) => {
        return messagesRead.combinedUnreadCountForChats(serverGroupChats);
    },
);

export const unreadDirectCountsStore = svelteDerived(
    [serverDirectChatsStore, messagesRead],
    ([serverDirectChats, messagesRead]) => {
        return messagesRead.combinedUnreadCountForChats(serverDirectChats);
    },
);

export const unreadCommunityChannelCountsStore = svelteDerived(
    [serverCommunitiesStore, messagesRead],
    ([serverCommunities, messagesRead]) => {
        return serverCommunities.reduce((map, [id, community]) => {
            map.set(
                id,
                messagesRead.combinedUnreadCountForChats(ChatMap.fromList(community.channels)),
            );
            return map;
        }, new CommunityMap<CombinedUnreadCounts>());
    },
);

export const globalUnreadCountStore = svelteDerived(
    [unreadGroupCountsStore, unreadDirectCountsStore, unreadCommunityChannelCountsStore],
    ([unreadGroupCounts, unreadDirectCounts, unreadCommunityChannelCounts]) => {
        return mergeListOfCombinedUnreadCounts([
            unreadGroupCounts,
            unreadDirectCounts,
            mergeListOfCombinedUnreadCounts(Array.from(unreadCommunityChannelCounts.values())),
        ]);
    },
);

export const selectedThreadIdStore = writable<ThreadIdentifier | undefined>(undefined);

export const threadEventsStore = svelteDerived(
    [
        serverThreadEventsStore,
        selectedThreadIdStore,
        localUpdates.failedMessages,
        localUpdates.unconfirmed,
        localUpdates.ephemeral,
        translationsStore,
        selectedChatBlockedOrSuspendedUsersStore,
        messageLocalUpdates,
        localUpdates.recentlySentMessages,
        messageFiltersStore,
    ],
    ([
        serverEvents,
        selectedThreadId,
        failedMessages,
        unconfirmedMessages,
        ephemeralMessages,
        translations,
        selectedChatBlockedOrSuspendedUsers,
        messageLocalUpdates,
        recentlySentMessages,
        messageFilters,
    ]) => {
        if (selectedThreadId === undefined) return [];
        const ctx = selectedThreadId;
        const failedState = failedMessages.get(ctx);
        const failed = failedState ? [...failedState.values()] : [];
        const unconfirmedState = unconfirmedMessages.get(ctx);
        const unconfirmed = unconfirmedState ? [...unconfirmedState.values()] : [];
        const ephemeralState = ephemeralMessages.get(ctx);
        const ephemeral = ephemeralState ? [...ephemeralState.values()] : [];
        return mergeEventsAndLocalUpdates(
            serverEvents,
            [...unconfirmed, ...failed, ...ephemeral],
            new DRange(),
            translations,
            selectedChatBlockedOrSuspendedUsers,
            messageLocalUpdates,
            recentlySentMessages,
            messageFilters,
        );
    },
);

export const confirmedThreadEventIndexesLoadedStore = svelteDerived(
    [threadEventsStore],
    ([events]) => {
        const ranges = new DRange();
        events.forEach((e) => ranges.add(e.index));
        return ranges;
    },
);

export const selectedThreadDraftMessageStore = svelteDerived(
    [selectedThreadIdStore, localUpdates.draftMessages],
    ([selectedThreadId, draftMessages]) =>
        selectedThreadId ? draftMessages.get(selectedThreadId) : undefined,
);

export const identityStateStore = writable<IdentityState>({ kind: "loading_user" });

export const selectedChatUserIdsStore = new SafeSetStore<string>();
export const selectedChatUserGroupKeysStore = new SafeSetStore<string>();
export const selectedChatExpandedDeletedMessageStore = new SafeSetStore<number>();
export const failedMessagesStore = localUpdates.failedMessages;
export const unconfirmedStore = localUpdates.unconfirmed;
