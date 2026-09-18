import {
    type ChannelIdentifier,
    type ChatStateFull,
    type CommunitySummary,
    type GroupAndCommunitySummaryUpdatesArgs,
    type GroupAndCommunitySummaryUpdatesResponseBatch,
    type GroupChatIdentifier,
    type GroupChatSummary,
} from "@shared";
import { getUpdatedEvents, mergeGroupChatUpdates } from "./chat";
import { mergeCommunityUpdates } from "./community";
import { emptyTouched, type SyncTouched } from "./sync";

export type RefreshTarget =
    | { kind: "group"; chat: GroupChatSummary }
    | { kind: "community"; chat: CommunitySummary };

/** The cached group, or the cached community holding the channel, that a refresh of `chatId` asks about */
export function refreshTarget(
    state: ChatStateFull,
    chatId: GroupChatIdentifier | ChannelIdentifier,
): RefreshTarget | undefined {
    if (chatId.kind === "group_chat") {
        const chat = state.groupChats.find((g) => g.id.groupId === chatId.groupId);
        return chat === undefined ? undefined : { kind: "group", chat };
    }
    const chat = state.communities.find((c) => c.id.communityId === chatId.communityId);
    return chat === undefined ? undefined : { kind: "community", chat };
}

export function refreshArgs(target: RefreshTarget): GroupAndCommunitySummaryUpdatesArgs {
    return target.kind === "group"
        ? {
              canisterId: target.chat.id.groupId,
              isCommunity: false,
              inviteCode: undefined,
              updatesSince: target.chat.lastUpdated,
          }
        : {
              canisterId: target.chat.id.communityId,
              isCommunity: true,
              inviteCode: undefined,
              updatesSince: target.chat.lastUpdated,
          };
}

export type RefreshResult =
    // Nothing has changed since the cached summary
    | { kind: "unchanged" }
    | { kind: "updated"; state: ChatStateFull; touched: SyncTouched; chat: RefreshTarget }
    // The answer is something only a full updates pass knows what to do with
    | { kind: "needs_full_pass" };

/**
 * Applies one group's or community's summary updates to the cached state, as an updates pass
 * would with no User canister updates for it. Anything else in the answer - the canister not
 * found (possibly deleted), an error, or a full summary rather than updates - is left to a full
 * updates pass, which knows how to handle those.
 */
export function applyRefresh(
    state: ChatStateFull,
    target: RefreshTarget,
    batch: GroupAndCommunitySummaryUpdatesResponseBatch,
): RefreshResult {
    if (batch.notFound.length > 0 || batch.errors.length > 0 || batch.excessUpdates.length > 0) {
        return { kind: "needs_full_pass" };
    }
    const update = batch.updates[0];
    if (update === undefined) return { kind: "unchanged" };

    if (target.kind === "group" && update.kind === "group_updates") {
        if (update.value.id.groupId !== target.chat.id.groupId) return { kind: "needs_full_pass" };
        const [chat] = mergeGroupChatUpdates([target.chat], [], [update.value]);
        return {
            kind: "updated",
            state: {
                ...state,
                groupChats: state.groupChats.map((g) => (g === target.chat ? chat : g)),
            },
            touched: {
                ...emptyTouched(),
                groupChats: new Set([chat.id.groupId]),
                updatedEvents: getUpdatedEvents([], [update.value], []),
            },
            chat: { kind: "group", chat },
        };
    }
    if (target.kind === "community" && update.kind === "community_updates") {
        if (update.value.id.communityId !== target.chat.id.communityId) {
            return { kind: "needs_full_pass" };
        }
        const [chat] = mergeCommunityUpdates([target.chat], [], [update.value]);
        return {
            kind: "updated",
            state: {
                ...state,
                communities: state.communities.map((c) => (c === target.chat ? chat : c)),
            },
            touched: {
                ...emptyTouched(),
                communities: new Set([chat.id.communityId]),
                updatedEvents: getUpdatedEvents([], [], [update.value]),
            },
            chat: { kind: "community", chat },
        };
    }
    return { kind: "needs_full_pass" };
}
