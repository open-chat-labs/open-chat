import {
    type CommunityIdentifier,
    type GroupAndCommunitySummaryUpdatesArgs,
    type GroupChatIdentifier,
    type WaitAllResult,
    getOrAdd,
} from "@shared";

type SummarySource = {
    localUserIndex: string;
    // Absent for a chat that has just been added, which is fetched in full
    lastUpdated?: bigint;
};

/** The summary-updates requests for these groups and communities, by the local user index to ask */
export function summaryUpdatesArgsByLocalUserIndex(
    groups: (SummarySource & { id: GroupChatIdentifier })[],
    communities: (SummarySource & { id: CommunityIdentifier })[],
): Map<string, GroupAndCommunitySummaryUpdatesArgs[]> {
    const byLocalUserIndex: Map<string, GroupAndCommunitySummaryUpdatesArgs[]> = new Map();
    for (const group of groups) {
        getOrAdd(byLocalUserIndex, group.localUserIndex, []).push({
            canisterId: group.id.groupId,
            isCommunity: false,
            inviteCode: undefined,
            updatesSince: group.lastUpdated,
        });
    }
    for (const community of communities) {
        getOrAdd(byLocalUserIndex, community.localUserIndex, []).push({
            canisterId: community.id.communityId,
            isCommunity: true,
            inviteCode: undefined,
            updatesSince: community.lastUpdated,
        });
    }
    return byLocalUserIndex;
}

/** One result from several, skipping any that were never started */
export function mergeWaitAllResults<T>(
    results: (WaitAllResult<T> | undefined)[],
): WaitAllResult<T> {
    const success: T[] = [];
    const errors: unknown[] = [];
    for (const result of results) {
        if (result === undefined) continue;
        success.push(...result.success);
        errors.push(...result.errors);
    }
    return { success, errors };
}
