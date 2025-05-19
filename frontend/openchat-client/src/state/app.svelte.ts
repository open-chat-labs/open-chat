import { dequal } from "dequal";
import DRange from "drange";
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
    messageContextsEqual,
    type MessageFilter,
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
import { derived } from "svelte/store";
import { offlineStore } from "../stores/network";
import {
    getMessagePermissionsForSelectedChat,
    mergeChatMetrics,
    mergeEventsAndLocalUpdates,
    mergePermissions,
    mergeUnconfirmedIntoSummary,
} from "../utils/chat";
import { configKeys } from "../utils/config";
import { enumFromStringValue } from "../utils/enums";
import { setsAreEqual } from "../utils/set";
import { chatDetailsLocalUpdates } from "./chat";
import { ChatDetailsState } from "./chat/serverDetails";
import { chatSummaryLocalUpdates, ChatSummaryUpdates } from "./chat/summaryUpdates";
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
import { ChatSetStore, SafeSetStore } from "./set";
import { SnsFunctions } from "./snsFunctions.svelte";
import { hideMessagesFromDirectBlocked } from "./ui.svelte";
import { messagesRead } from "./unread/markRead.svelte";
import { blockedUsersStore, suspendedUsersStore } from "./users/users.svelte";
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

export const selectedServerChatStore = writable<ChatDetailsState | undefined>(undefined);
export const selectedChatMembersStore = derived(
    [selectedServerChatStore, chatDetailsLocalUpdates.members],
    ([chat, members]) => {
        if (chat === undefined) return new Map() as ReadonlyMap<string, Member>;
        return members.get(chat.chatId)?.apply(chat.members) ?? chat.members;
    },
);
export const selectedChatBlockedUsersStore = derived(
    [selectedServerChatStore, chatDetailsLocalUpdates.blockedUsers],
    ([chat, blockedUsers]) => {
        if (chat === undefined) return new Map() as ReadonlySet<string>;
        return blockedUsers.get(chat.chatId)?.apply(chat.blockedUsers) ?? chat.blockedUsers;
    },
);
export const selectedChatPinnedMessagesStore = derived(
    [selectedServerChatStore, chatDetailsLocalUpdates.pinnedMessages],
    ([chat, pinnedMessages]) => {
        if (chat === undefined) return new Map() as ReadonlySet<number>;
        return pinnedMessages.get(chat.chatId)?.apply(chat.pinnedMessages) ?? chat.pinnedMessages;
    },
);
export const selectedChatInvitedUsersStore = derived(
    [selectedServerChatStore, chatDetailsLocalUpdates.invitedUsers],
    ([chat, invitedUsers]) => {
        if (chat === undefined) return new Map() as ReadonlySet<string>;
        return invitedUsers.get(chat.chatId)?.apply(chat.invitedUsers) ?? chat.invitedUsers;
    },
);
export const selectedChatBotsStore = derived(
    [selectedServerChatStore, chatDetailsLocalUpdates.bots],
    ([chat, bots]) => {
        if (chat === undefined) return new Map() as ReadonlyMap<string, ExternalBotPermissions>;
        return bots.get(chat.chatId)?.apply(chat.bots) ?? chat.bots;
    },
);
export const selectedChatApiKeysStore = derived(
    [selectedServerChatStore, chatDetailsLocalUpdates.apiKeys],
    ([chat, apiKeys]) => {
        if (chat === undefined) return new Map() as ReadonlyMap<string, PublicApiKeyDetails>;
        return apiKeys.get(chat.chatId)?.apply(chat.apiKeys) ?? chat.apiKeys;
    },
);
export const selectedChatWebhooksStore = derived(
    [selectedServerChatStore, chatDetailsLocalUpdates.webhooks],
    ([chat, webhooks]) => {
        if (chat === undefined) return new Map() as ReadonlyMap<string, WebhookDetails>;
        return webhooks.get(chat.chatId)?.apply(chat.webhooks) ?? chat.webhooks;
    },
);
export const selectedChatRulesStore = derived(
    [selectedServerChatStore, chatDetailsLocalUpdates.rules],
    ([chat, rules]) => {
        if (chat === undefined) return undefined;
        return rules.get(chat.chatId) ?? chat.rules;
    },
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
export const pinnedChatsStore = derived(
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

export const unreadFavouriteCountsStore = derived(
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

export const favouritesVideoCallCountsStore = derived(
    [serverFavouritesStore, allServerChatsStore],
    ([serverFavourites, allServerChats]) => {
        const chats = [...serverFavourites.values()].map((id) => allServerChats.get(id));
        return videoCallsInProgressForChats(chats);
    },
);

export const selectedServerChatSummaryStore = derived(
    [selectedChatIdStore, allServerChatsStore],
    ([selectedChatId, allServerChats]) => {
        return selectedChatId ? allServerChats.get(selectedChatId) : undefined;
    },
);
// Note that it's ok that this method mutates the input since it is
// already a clone
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
    ],
    ([
        allServerChats,
        localChats,
        localUpdates,
        translations,
        currentUserId,
        messageFilters,
        selectedChatBlockedOrSuspendedUsers,
    ]) => {
        const withUpdates = localChats.apply(allServerChats);
        return [...withUpdates.entries()].reduce((result, [chatId, chat]) => {
            const clone = structuredClone(chat);
            const withLocal = applyLocalUpdatesToChat(clone, localUpdates.get(clone.id));
            const withUnconfirmed = mergeUnconfirmedIntoSummary(
                (k) => k, // TODO - we need to get the message formatter here
                currentUserId,
                withLocal,
                messageLocalUpdates.data,
                translations,
                selectedChatBlockedOrSuspendedUsers,
                currentUserId,
                messageFilters,
            );
            // only overwrite the chat if turns out to be different from the original to try
            // to minimise downstream effects
            result.set(chatId, dequal(chat, withUnconfirmed) ? chat : withUnconfirmed);
            return result;
        }, new ChatMap<ChatSummary>());
    },
);

export const favouritesStore = derived(
    [serverFavouritesStore, localUpdates.favourites],
    ([serverFavourites, local]) => {
        return local.apply(serverFavourites);
    },
);

// all chats filtered by scope including previews and local updates
// the final client view of chat summaries with all updates merged in
export const chatSummariesStore = derived(
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

export const chatSummariesListStore = derived(
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

export const selectedChatSummaryStore = derived(
    [selectedChatIdStore, chatSummariesStore],
    ([selectedChatId, chatSummaries]) => {
        if (selectedChatId === undefined) return undefined;
        return chatSummaries.get(selectedChatId);
    },
);
export const proposalTopicsStore = derived(
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

export const isProposalGroupStore = derived([selectedChatSummaryStore], ([selectedChatSummary]) => {
    return (
        selectedChatSummary !== undefined &&
        selectedChatSummary.kind !== "direct_chat" &&
        selectedChatSummary.subtype?.kind === "governance_proposals"
    );
});

export const threadsByChatStore = derived([chatSummariesStore], ([chatSummaries]) => {
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

export const numberOfThreadsStore = derived(threadsByChatStore, (threadsByChat) =>
    threadsByChat.map((_, ts) => ts.length).reduce((total, [_, n]) => total + n, 0),
);

export const threadsFollowedByMeStore = derived(threadsByChatStore, (threadsByChat) => {
    return threadsByChat.reduce<ChatMap<Set<number>>>((result, [chatId, threads]) => {
        const set = new Set<number>();
        for (const thread of threads) {
            set.add(thread.threadRootMessageIndex);
        }
        result.set(chatId, set);
        return result;
    }, new ChatMap<Set<number>>());
});

export const messagePermissionsForSelectedChatStore = derived(
    selectedChatSummaryStore,
    (selectedChatSummary) => {
        return getMessagePermissionsForSelectedChat(selectedChatSummary, "message");
    },
);
export const threadPermissionsForSelectedChatStore = derived(
    selectedChatSummaryStore,
    (selectedChatSummary) => {
        return getMessagePermissionsForSelectedChat(selectedChatSummary, "thread");
    },
);
export const proposalTalliesStore = new SafeMapStore<string, Tally>();

export const selectedChatDraftMessageStore = derived(
    [selectedChatIdStore, localUpdates.draftMessages],
    ([selectedChatId, draftMessages]) =>
        selectedChatId ? draftMessages.get({ chatId: selectedChatId }) : undefined,
);

export const communityChannelVideoCallCountsStore = derived([communitiesStore], ([communities]) => {
    return [...communities.entries()].reduce((map, [id, community]) => {
        map.set(id, videoCallsInProgressForChats(community.channels));
        return map;
    }, new CommunityMap<VideoCallCounts>());
});

export const groupVideoCallCountsStore = derived(serverGroupChatsStore, (serverGroupChats) => {
    return videoCallsInProgressForChats([...serverGroupChats.values()]);
});

export const directVideoCallCountsStore = derived(serverDirectChatsStore, (serverDirectChats) => {
    return videoCallsInProgressForChats([...serverDirectChats.values()]);
});

export const serverEventsStore = writable<EventWrapper<ChatEvent>[]>([]);
export const serverThreadEventsStore = writable<EventWrapper<ChatEvent>[]>([]);
export const expiredServerEventRanges = writable<DRange>(new DRange());
export const eventsStore = derived(
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
    ]) => {
        if (selectedChatId === undefined) return [];
        const ctx = { chatId: selectedChatId };
        const failedState = failedMessages.get(ctx);
        const failed = failedState ? [...failedState.values()] : [];
        const unconfirmedState = unconfirmedMessages.get(ctx);
        const unconfirmed = unconfirmedState ? [...unconfirmedState.values()] : [];
        const ephemeralState = ephemeralMessages.get(ctx);
        const ephemeral = ephemeralState ? [...ephemeralState.values()] : [];
        // TODO this is hiding all the message local updates which still need to be sorted out
        return mergeEventsAndLocalUpdates(
            serverEvents,
            [...unconfirmed, ...failed, ...ephemeral],
            expiredEventRanges,
            translations,
            selectedChatBlockedOrSuspendedUsers,
            messageLocalUpdates,
            recentlySentMessages,
        );
    },
);

export const messageActivitySummaryStore = derived(
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

export const directChatBotsStore = derived(
    [serverDirectChatBotsStore, localUpdates.directChatBots],
    ([serverDirectChatBots, local]) => {
        return local.apply(serverDirectChatBots);
    },
);

export const unreadGroupCountsStore = derived(
    [serverGroupChatsStore, messagesRead],
    ([serverGroupChats, messagesRead]) => {
        return messagesRead.combinedUnreadCountForChats(serverGroupChats);
    },
);

export const unreadDirectCountsStore = derived(
    [serverDirectChatsStore, messagesRead],
    ([serverDirectChats, messagesRead]) => {
        return messagesRead.combinedUnreadCountForChats(serverDirectChats);
    },
);

export const unreadCommunityChannelCountsStore = derived(
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

export const globalUnreadCountStore = derived(
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

export const selectedThreadDraftMessageStore = derived(
    [selectedThreadIdStore, localUpdates.draftMessages],
    ([selectedThreadId, draftMessages]) =>
        selectedThreadId ? draftMessages.get(selectedThreadId) : undefined,
);

export const identityStateStore = writable<IdentityState>({ kind: "loading_user" });

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

    // but it can be a plain value once that's all gone
    #translations: MessageMap<string> = new MessageMap();

    constructor() {
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
        selectedCommunityReferralsStore.subscribe((v) => (this.#selectedCommunityReferrals = v));
        selectedCommunityInvitedUsersStore.subscribe(
            (v) => (this.#selectedCommunityInvitedUsers = v),
        );
        selectedCommunityMembersStore.subscribe((v) => (this.#selectedCommunityMembers = v));
        selectedCommunitySummaryStore.subscribe((v) => (this.#selectedCommunitySummary = v));
        selectedCommunityRulesStore.subscribe((v) => (this.#selectedCommunityRules = v));

        translationsStore.subscribe((v) => (this.#translations = v));
        walletConfigStore.subscribe((v) => (this.#walletConfig = v));
        selectedThreadIdStore.subscribe((v) => (this.#selectedThreadId = v));
        selectedChatIdStore.subscribe((v) => (this.#selectedChatId = v));
        selectedCommunityIdStore.subscribe((v) => (this.#selectedCommunityId = v));
        selectedServerChatSummaryStore.subscribe((v) => (this.#selectedServerChatSummary = v));
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
        selectedChatBlockedUsersStore.subscribe((v) => (this.#selectedChatBlockedUsers = v));
        selectedChatInvitedUsersStore.subscribe((v) => (this.#selectedChatInvitedUsers = v));
        directChatBotsStore.subscribe((v) => (this.#directChatBots = v));
        identityStateStore.subscribe((v) => (this.#identityState = v));
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
        return snsFunctionsStore.current;
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

    setCurrentUser(user: CreatedUser) {
        currentUserStore.set(user);
    }

    getProposalTally(governanceCanisterId: string, proposalId: bigint) {
        return proposalTalliesStore.get(`${governanceCanisterId}_${proposalId}`);
    }

    setProposalTally(governanceCanisterId: string, proposalId: bigint, tally: Tally) {
        proposalTalliesStore.set(`${governanceCanisterId}_${proposalId}`, tally);
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

    get locale() {
        return this.#locale;
    }

    get offline() {
        return this.#offline;
    }

    set messageFilters(val: MessageFilter[]) {
        messageFiltersStore.set(val);
    }

    get currentUser() {
        return currentUserStore.current;
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
        return achievementsStore;
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

    updateIdentityState(fn: (prev: IdentityState) => IdentityState) {
        identityStateStore.update(fn);
    }

    get nextCommunityIndex() {
        return this.#nextCommunityIndex;
    }

    get chatsInitialised() {
        return chatsInitialisedStore.current;
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
                $state.snapshot(chatId),
                $state.snapshot(this.#selectedChatId),
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

    // TODO - this is only called from tests
    set serverCommunities(val: CommunityMap<CommunitySummary>) {
        serverCommunitiesStore.fromMap(val);
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
