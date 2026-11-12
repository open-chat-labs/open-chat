import type { DexId, DiamondMembershipFees, OpenChat, PremiumItem } from "@client";

// The platform moderators' and operators' browser console hooks (`window.platformModerator`,
// `window.platformOperator`): backend actions with no screen of their own, called by hand from the
// dev tools, e.g. `platformModerator.freezeGroup("<group id>", "spam")`. Each says in the console
// whether it went through. Every tree installs them (the old desktop App and src/web's App); the
// backend checks who may call each one.

/** The client methods the hooks call. */
export type ConsoleHooksClient = Pick<
    OpenChat,
    | "addHotGroupExclusion"
    | "deleteFrozenGroup"
    | "deleteMessage"
    | "freezeGroup"
    | "removeHotGroupExclusion"
    | "setCommunityModerationFlags"
    | "setGroupModerationFlags"
    | "unfreezeGroup"
    | "addMessageFilter"
    | "removeMessageFilter"
    | "reportedMessages"
    | "unsuspendUser"
    | "addRemoveSwapProvider"
    | "setGroupUpgradeConcurrency"
    | "setCommunityUpgradeConcurrency"
    | "markLocalGroupIndexFull"
    | "reinstateMissedDailyClaims"
    | "setAirdropConfig"
    | "setDiamondMembershipFees"
    | "setTokenEnabled"
    | "stakeNeuronForSubmittingProposals"
    | "topUpNeuronForSubmittingProposals"
    | "setPremiumItemCost"
    | "updateBlockedUsernamePatterns"
    | "pauseEventLoop"
    | "resumeEventLoop"
>;

export type PlatformModeratorHooks = {
    addHotGroupExclusion(chatId: string): Promise<void>;
    deleteFrozenGroup(chatId: string): Promise<void>;
    deleteMessage(
        chatId: string,
        messageId: bigint,
        threadRootMessageIndex?: number,
    ): Promise<void>;
    deleteChannelMessage(
        communityId: string,
        channelId: number,
        messageId: bigint,
        threadRootMessageIndex?: number,
    ): Promise<void>;
    freezeGroup(chatId: string, reason: string | undefined): Promise<void>;
    removeHotGroupExclusion(chatId: string): Promise<void>;
    setCommunityModerationFlags(communityId: string, flags: number): Promise<void>;
    setGroupModerationFlags(chatId: string, flags: number): Promise<void>;
    unfreezeGroup(chatId: string): Promise<void>;
    addMessageFilter(regex: string): Promise<void>;
    removeMessageFilter(id: bigint): Promise<void>;
    /** Logs the reported messages (all, or one user's) as JSON. */
    reportedMessages(userId?: string): Promise<void>;
    unsuspendUser(userId: string): Promise<void>;
};

export type PlatformOperatorHooks = {
    addRemoveSwapProvider(swapProvider: DexId, add: boolean): Promise<void>;
    setGroupUpgradeConcurrency(value: number): Promise<void>;
    setCommunityUpgradeConcurrency(value: number): Promise<void>;
    markLocalGroupIndexFull(canisterId: string, full: boolean): Promise<void>;
    reinstateMissedDailyClaims(userId: string, days: number[]): Promise<void>;
    setAirdropConfig(
        channelId: number,
        channelName: string,
        communityId?: string,
        communityName?: string,
    ): Promise<void>;
    setDiamondMembershipFees(fees: DiamondMembershipFees[]): Promise<void>;
    setTokenEnabled(ledger: string, enabled: boolean): Promise<void>;
    stakeNeuronForSubmittingProposals(governanceCanisterId: string, stake: bigint): Promise<void>;
    topUpNeuronForSubmittingProposals(governanceCanisterId: string, amount: bigint): Promise<void>;
    setPremiumItemCost(item: PremiumItem, chitCost: number): Promise<void>;
    updateBlockedUsernamePatterns(pattern: string, add: boolean): Promise<void>;
    pauseEventLoop(): void;
    resumeEventLoop(): void;
};

declare global {
    interface Window {
        platformModerator?: PlatformModeratorHooks;
        platformOperator?: PlatformOperatorHooks;
    }
}

/** Where the hooks go: `window`, or a stand-in in a spec. */
export type ConsoleHooksHost = {
    platformModerator?: PlatformModeratorHooks;
    platformOperator?: PlatformOperatorHooks;
};

// a success logs to the console, a failure too (as an error where the old hooks said so)
async function report(
    call: Promise<boolean>,
    success: string,
    failure: string,
    details: unknown[],
    failureAsError = false,
): Promise<void> {
    if (await call) {
        console.log(success, ...details);
    } else if (failureAsError) {
        console.error(failure, ...details);
    } else {
        console.log(failure, ...details);
    }
}

/** The platform moderator's hooks. */
export function platformModeratorHooks(client: ConsoleHooksClient): PlatformModeratorHooks {
    const group = (groupId: string) => ({ kind: "group_chat" as const, groupId });
    return {
        addHotGroupExclusion: (chatId) =>
            report(
                client.addHotGroupExclusion(group(chatId)),
                "Hot group exclusion added",
                "Failed to add hot group exclusion",
                [chatId],
            ),
        deleteFrozenGroup: (chatId) =>
            report(
                client.deleteFrozenGroup(group(chatId)),
                "Group deleted",
                "Failed to delete frozen group",
                [chatId],
            ),
        deleteMessage: (chatId, messageId, threadRootMessageIndex) =>
            report(
                client.deleteMessage(group(chatId), threadRootMessageIndex, messageId, true),
                "Message deleted",
                "Failed to delete message",
                [chatId, messageId, threadRootMessageIndex],
            ),
        deleteChannelMessage: (communityId, channelId, messageId, threadRootMessageIndex) =>
            report(
                client.deleteMessage(
                    { kind: "channel", communityId, channelId },
                    threadRootMessageIndex,
                    messageId,
                    true,
                ),
                "Message deleted",
                "Failed to delete message",
                [communityId, channelId, messageId, threadRootMessageIndex],
            ),
        freezeGroup: (chatId, reason) =>
            report(
                client.freezeGroup(group(chatId), reason),
                "Group frozen",
                "Failed to freeze group",
                [chatId],
            ),
        removeHotGroupExclusion: (chatId) =>
            report(
                client.removeHotGroupExclusion(group(chatId)),
                "Hot group exclusion removed",
                "Failed to remove hot group exclusion",
                [chatId],
            ),
        setCommunityModerationFlags: (communityId, flags) =>
            report(
                client.setCommunityModerationFlags(communityId, flags),
                "Community moderation flags updated",
                "Failed to set community moderation flags",
                [communityId],
            ),
        setGroupModerationFlags: (chatId, flags) =>
            report(
                client.setGroupModerationFlags(chatId, flags),
                "Group moderation flags updated",
                "Failed to set group moderation flags",
                [chatId],
            ),
        unfreezeGroup: (chatId) =>
            report(
                client.unfreezeGroup(group(chatId)),
                "Group unfrozen",
                "Failed to unfreeze group",
                [chatId],
            ),
        addMessageFilter: (regex) =>
            report(
                client.addMessageFilter(regex),
                "Message filter added",
                "Failed to add message filter",
                [regex],
            ),
        removeMessageFilter: (id) =>
            report(
                client.removeMessageFilter(id),
                "Message filter removed",
                "Failed to remove message filter",
                [id],
            ),
        reportedMessages: async (userId) => {
            console.log(JSON.parse(await client.reportedMessages(userId)));
        },
        unsuspendUser: (userId) =>
            report(client.unsuspendUser(userId), "User unsuspended", "Failed to unsuspend user", [
                userId,
            ]),
    };
}

/** The platform operator's hooks. */
export function platformOperatorHooks(client: ConsoleHooksClient): PlatformOperatorHooks {
    return {
        addRemoveSwapProvider: (swapProvider, add) =>
            report(
                client.addRemoveSwapProvider(swapProvider, add),
                `${add ? "Added" : "Removed"} swap provider`,
                "Failed to add/remove swap provider",
                [swapProvider],
                true,
            ),
        setGroupUpgradeConcurrency: (value) =>
            report(
                client.setGroupUpgradeConcurrency(value),
                "Group upgrade concurrency set",
                "Failed to set group upgrade concurrency",
                [value],
                true,
            ),
        setCommunityUpgradeConcurrency: (value) =>
            report(
                client.setCommunityUpgradeConcurrency(value),
                "Community upgrade concurrency set",
                "Failed to set community upgrade concurrency",
                [value],
                true,
            ),
        markLocalGroupIndexFull: (canisterId, full) =>
            report(
                client.markLocalGroupIndexFull(canisterId, full),
                "LocalGroupIndex marked as full",
                "Failed to mark LocalGroupIndex as full",
                [canisterId, full],
                true,
            ),
        reinstateMissedDailyClaims: (userId, days) =>
            report(
                client.reinstateMissedDailyClaims(userId, days),
                "Reinstated missed daily claims",
                "Failed to reinstate missed daily claims",
                [userId, days],
                true,
            ),
        setAirdropConfig: (channelId, channelName, communityId, communityName) =>
            report(
                client.setAirdropConfig(channelId, channelName, communityId, communityName),
                "Airdrop config set",
                "Failed to set airdrop config",
                [],
                true,
            ),
        setDiamondMembershipFees: (fees) =>
            report(
                client.setDiamondMembershipFees(fees),
                "Diamond membership fees set",
                "Failed to set diamond membership fees",
                [fees],
                true,
            ),
        setTokenEnabled: (ledger, enabled) =>
            report(
                client.setTokenEnabled(ledger, enabled),
                `Token ${enabled ? "enabled" : "disabled"}`,
                `Failed to set token ${enabled ? "enabled" : "disabled"}`,
                [ledger],
                true,
            ),
        stakeNeuronForSubmittingProposals: (governanceCanisterId, stake) =>
            report(
                client.stakeNeuronForSubmittingProposals(governanceCanisterId, stake),
                "Neuron staked successfully",
                "Failed to stake neuron",
                [],
                true,
            ),
        topUpNeuronForSubmittingProposals: (governanceCanisterId, amount) =>
            report(
                client.topUpNeuronForSubmittingProposals(governanceCanisterId, amount),
                "Neuron topped up successfully",
                "Failed to top up neuron",
                [],
                true,
            ),
        setPremiumItemCost: (item, chitCost) => client.setPremiumItemCost(item, chitCost),
        updateBlockedUsernamePatterns: (pattern, add) =>
            client.updateBlockedUsernamePatterns(pattern, add),
        pauseEventLoop: () => client.pauseEventLoop(),
        resumeEventLoop: () => client.resumeEventLoop(),
    };
}

/**
 * Puts the hooks on `host` (the window) and returns what takes them off again, for an App's
 * `onMount`. Installed for everyone, as before: the backend refuses whoever isn't a platform
 * moderator or operator.
 */
export function installConsoleHooks(
    client: ConsoleHooksClient,
    host: ConsoleHooksHost = window,
): () => void {
    const moderator = platformModeratorHooks(client);
    const operator = platformOperatorHooks(client);
    host.platformModerator = moderator;
    host.platformOperator = operator;
    return () => {
        if (host.platformModerator === moderator) delete host.platformModerator;
        if (host.platformOperator === operator) delete host.platformOperator;
    };
}
