import type {
    ChatEvent,
    DirectChatSummary,
    DirectChatSummaryUpdates,
    EventWrapper,
    GroupChatDetails,
    GroupChatDetailsUpdates,
    GroupChatSummary,
    Member,
    ThreadSyncDetails,
    GroupCanisterGroupChatSummary,
    GroupCanisterGroupChatSummaryUpdates,
    UserCanisterGroupChatSummary,
    UserCanisterGroupChatSummaryUpdates,
    GroupCanisterThreadDetails,
    UpdatedEvent,
    Metrics,
    CommunityDetails,
    CommunityDetailsUpdates,
    CommunityCanisterCommunitySummaryUpdates,
    ChannelIdentifier,
    UserGroupDetails,
} from "openchat-shared";
import {
    ChatMap,
    applyOptionUpdate,
    bigIntMax,
    mapOptionUpdate,
    OPENCHAT_BOT_AVATAR_URL,
    OPENCHAT_BOT_USER_ID,
    OPENCHAT_VIDEO_CALL_AVATAR_URL,
    OPENCHAT_VIDEO_CALL_USER_ID,
} from "openchat-shared";
import { toRecord } from "./list";
import { identity } from "./mapping";
import Identicon from "identicon.js";
import md5 from "md5";

// this is used to merge both the overall list of chats with updates and also the list of participants
// within a group chat
function mergeThings<A, U>(
    keyFn: (a: A | U) => string,
    mergeFn: (existing: A | undefined, updated: U) => A | undefined,
    things: A[],
    updates: { added: A[]; updated: U[]; removed: Set<string> },
): A[] {
    // if there's nothing to do - do nothing
    if (updates.added.length === 0 && updates.updated.length === 0 && updates.removed.size === 0)
        return things;

    // create a lookup of all existing and added things
    const dict = toRecord(things.concat(updates.added), keyFn);

    // delete all removed things
    updates.removed.forEach((key) => {
        delete dict[key];
    });

    // merge in all updates
    const updated = updates.updated.reduce((dict, updated) => {
        const key = keyFn(updated);
        const merged = mergeFn(dict[key], updated);
        if (merged) {
            dict[key] = merged;
        }
        return dict;
    }, dict);

    // return the result
    return Object.values(updated);
}

export function mergeCommunityDetails(
    previous: CommunityDetails,
    updates: CommunityDetailsUpdates,
): CommunityDetails {
    return {
        lastUpdated: updates.lastUpdated,
        members: mergeThings((p) => p.userId, mergeParticipants, previous.members, {
            added: [],
            updated: updates.membersAddedOrUpdated,
            removed: updates.membersRemoved,
        }),
        blockedUsers: new Set<string>(
            mergeThings(identity, identity, [...previous.blockedUsers], {
                added: [...updates.blockedUsersAdded],
                updated: [],
                removed: updates.blockedUsersRemoved,
            }),
        ),
        referrals: new Set<string>(
            mergeThings(identity, identity, [...previous.referrals], {
                added: [...updates.referralsAdded],
                updated: [],
                removed: updates.referralsRemoved,
            }),
        ),
        invitedUsers: updates.invitedUsers ?? previous.invitedUsers,
        rules: updates.rules ?? previous.rules,
        userGroups: mergeUserGroups(
            previous.userGroups,
            updates.userGroups,
            updates.userGroupsDeleted,
        ),
    };
}

function mergeUserGroups(
    previous: Map<number, UserGroupDetails>,
    updated: UserGroupDetails[],
    deleted: Set<number>,
): Map<number, UserGroupDetails> {
    deleted.forEach((id) => previous.delete(id));
    updated.forEach((g) => previous.set(g.id, g));
    return new Map(previous);
}

export function mergeGroupChatDetails(
    previous: GroupChatDetails,
    updates: GroupChatDetailsUpdates,
): GroupChatDetails {
    return {
        timestamp: updates.timestamp,
        members: mergeThings((p) => p.userId, mergeParticipants, previous.members, {
            added: [],
            updated: updates.membersAddedOrUpdated,
            removed: updates.membersRemoved,
        }),
        blockedUsers: new Set<string>(
            mergeThings(identity, identity, [...previous.blockedUsers], {
                added: [...updates.blockedUsersAdded],
                updated: [],
                removed: updates.blockedUsersRemoved,
            }),
        ),
        invitedUsers: updates.invitedUsers ?? previous.invitedUsers,
        pinnedMessages: mergePinnedMessages(
            previous.pinnedMessages,
            updates.pinnedMessagesAdded,
            updates.pinnedMessagesRemoved,
        ),
        rules: updates.rules ?? previous.rules,
    };
}

function mergePinnedMessages(
    current: Set<number>,
    added: Set<number>,
    removed: Set<number>,
): Set<number> {
    removed.forEach((m) => current.delete(m));
    added.forEach((m) => current.add(m));
    return current;
}

function mergeParticipants(_: Member | undefined, updated: Member) {
    return updated;
}

export function mergeDirectChatUpdates(
    directChats: DirectChatSummary[],
    updates: DirectChatSummaryUpdates[],
): DirectChatSummary[] {
    const lookup = ChatMap.fromList(updates);

    return directChats.map((c) => {
        const u = lookup.get(c.id);

        if (u === undefined) return c;

        return {
            kind: "direct_chat",
            id: c.id,
            them: c.them,
            readByThemUpTo: u.readByThemUpTo ?? c.readByThemUpTo,
            dateCreated: c.dateCreated,
            lastUpdated: u.lastUpdated,
            latestEventIndex: u.latestEventIndex ?? c.latestEventIndex,
            latestMessage: u.latestMessage ?? c.latestMessage,
            latestMessageIndex: u.latestMessageIndex ?? c.latestMessageIndex,
            metrics: u.metrics ?? c.metrics,
            eventsTTL: applyOptionUpdate(c.eventsTTL, u.eventsTTL),
            eventsTtlLastUpdated: bigIntMax(
                c.eventsTtlLastUpdated ?? BigInt(0),
                u.eventsTtlLastUpdated ?? BigInt(0),
            ),
            videoCallInProgress: applyOptionUpdate(c.videoCallInProgress, u.videoCallInProgress),
            membership: {
                ...c.membership,
                readByMeUpTo: u.readByMeUpTo ?? c.membership.readByMeUpTo,
                notificationsMuted: u.notificationsMuted ?? c.membership.notificationsMuted,
                myMetrics: u.myMetrics ?? c.membership.myMetrics,
                archived: u.archived ?? c.membership.archived,
                rulesAccepted: false,
                lapsed: false,
            },
        };
    });
}

export function mergeGroupChatUpdates(
    groupChats: GroupChatSummary[],
    userCanisterUpdates: UserCanisterGroupChatSummaryUpdates[],
    groupCanisterUpdates: GroupCanisterGroupChatSummaryUpdates[],
): GroupChatSummary[] {
    const userLookup = ChatMap.fromList(userCanisterUpdates);
    const groupLookup = ChatMap.fromList(groupCanisterUpdates);

    return groupChats.map((c) => {
        const u = userLookup.get(c.id);
        const g = groupLookup.get(c.id);

        if (u === undefined && g === undefined) return c;

        const latestMessageIndex = g?.latestMessageIndex ?? c.latestMessageIndex;
        let latestMessage = g?.latestMessage ?? c.latestMessage;
        if (
            latestMessage !== undefined &&
            latestMessage.event.messageIndex !== latestMessageIndex
        ) {
            latestMessage = undefined;
        }
        const readByMeUpTo = u?.readByMeUpTo ?? c.membership.readByMeUpTo;

        const blobReferenceUpdate = mapOptionUpdate(g?.avatarId, (avatarId) => ({
            blobId: avatarId,
            canisterId: c.id.groupId,
        }));

        return {
            kind: "group_chat",
            id: c.id,
            name: g?.name ?? c.name,
            description: g?.description ?? c.description,
            minVisibleEventIndex: c.minVisibleEventIndex,
            minVisibleMessageIndex: c.minVisibleMessageIndex,
            lastUpdated: g?.lastUpdated ?? c.lastUpdated,
            memberCount: g?.memberCount ?? c.memberCount,
            public: g?.public ?? c.public,
            permissions: g?.permissions ?? c.permissions,
            historyVisible: c.historyVisible,
            subtype: applyOptionUpdate(c.subtype, g?.subtype),
            previewed: false,
            frozen: applyOptionUpdate(c.frozen, g?.frozen) ?? false,
            latestEventIndex: g?.latestEventIndex ?? c.latestEventIndex,
            latestMessage,
            latestMessageIndex,
            metrics: g?.metrics ?? c.metrics,
            blobReference: applyOptionUpdate(c.blobReference, blobReferenceUpdate),
            dateLastPinned: g?.dateLastPinned ?? c.dateLastPinned,
            dateReadPinned: u?.dateReadPinned ?? c.dateReadPinned,
            gateConfig: applyOptionUpdate(c.gateConfig, g?.gateConfig) ?? {
                gate: { kind: "no_gate" },
                expiry: undefined,
            },
            level: "group",
            eventsTTL: applyOptionUpdate(c.eventsTTL, g?.eventsTTL),
            eventsTtlLastUpdated: bigIntMax(
                c.eventsTtlLastUpdated ?? BigInt(0),
                g?.eventsTtlLastUpdated ?? BigInt(0),
            ),
            membership: {
                ...c.membership,
                mentions:
                    g === undefined
                        ? c.membership.mentions
                        : [...(g?.membership?.mentions ?? []), ...c.membership.mentions],
                role: g?.membership?.myRole ?? c.membership.role,
                latestThreads: mergeThreads(
                    c.membership.latestThreads,
                    g?.membership?.latestThreads ?? [],
                    g?.membership?.unfollowedThreads ?? [],
                    u?.threadsRead ?? {},
                ),
                readByMeUpTo:
                    readByMeUpTo !== undefined && latestMessage !== undefined
                        ? Math.min(readByMeUpTo, latestMessage.event.messageIndex)
                        : readByMeUpTo,
                notificationsMuted:
                    g?.membership?.notificationsMuted ?? c.membership.notificationsMuted,
                myMetrics: g?.membership?.myMetrics ?? c.membership.myMetrics,
                archived: u?.archived ?? c.membership.archived,
                rulesAccepted: g?.membership?.rulesAccepted ?? c.membership.rulesAccepted,
                lapsed: g?.membership?.lapsed ?? c.membership.lapsed,
            },
            localUserIndex: c.localUserIndex,
            videoCallInProgress: applyOptionUpdate(c.videoCallInProgress, g?.videoCallInProgress),
            isInvited: false,
            messagesVisibleToNonMembers:
                g?.messagesVisibleToNonMembers ?? c.messagesVisibleToNonMembers,
        };
    });
}

export function mergeGroupChats(
    userCanisterGroups: UserCanisterGroupChatSummary[],
    groupCanisterGroups: GroupCanisterGroupChatSummary[],
): GroupChatSummary[] {
    const userCanisterGroupLookup = ChatMap.fromList(userCanisterGroups);

    return groupCanisterGroups.map((g) => {
        const u = userCanisterGroupLookup.get(g.id);

        return {
            kind: "group_chat",
            id: g.id,
            name: g.name,
            description: g.description,
            minVisibleEventIndex: g.minVisibleEventIndex,
            minVisibleMessageIndex: g.minVisibleMessageIndex,
            lastUpdated: g.lastUpdated,
            memberCount: g.memberCount,
            public: g.public,
            permissions: g.permissions,
            historyVisible: g.historyVisible,
            subtype: g.subtype,
            previewed: false,
            frozen: g.frozen,
            latestEventIndex: g.latestEventIndex,
            latestMessage: g.latestMessage,
            latestMessageIndex: g.latestMessageIndex,
            metrics: g.metrics,
            blobReference:
                g.avatarId !== undefined
                    ? { blobId: g.avatarId, canisterId: g.id.groupId }
                    : undefined,
            dateLastPinned: g.dateLastPinned,
            dateReadPinned: u?.dateReadPinned,
            gateConfig: g.gateConfig,
            level: "group",
            eventsTTL: g.eventsTTL,
            eventsTtlLastUpdated: g.eventsTtlLastUpdated,
            membership: {
                ...g.membership,
                latestThreads: mergeThreads(
                    [],
                    g.membership.latestThreads,
                    [],
                    u?.threadsRead ?? {},
                ),
                readByMeUpTo: u?.readByMeUpTo,
                archived: u?.archived ?? false,
            },
            localUserIndex: g.localUserIndex,
            videoCallInProgress: g.videoCallInProgress,
            isInvited: false,
            messagesVisibleToNonMembers: g.messagesVisibleToNonMembers,
        };
    });
}

function mergeThreads(
    current: ThreadSyncDetails[],
    groupCanisterUpdates: GroupCanisterThreadDetails[],
    groupCanisterUnfollowedThreads: number[],
    readUpToUpdates: Record<number, number>,
): ThreadSyncDetails[] {
    const initial = current.filter(
        (t) => !groupCanisterUnfollowedThreads.includes(t.threadRootMessageIndex),
    );
    const threadsRecord = toRecord(initial, (t) => t.threadRootMessageIndex);

    for (const groupUpdate of groupCanisterUpdates) {
        threadsRecord[groupUpdate.threadRootMessageIndex] = {
            ...threadsRecord[groupUpdate.threadRootMessageIndex],
            ...groupUpdate,
        };
    }

    return Object.values(threadsRecord).map((t) => {
        const readUpToUpdate = readUpToUpdates[t.threadRootMessageIndex];
        return readUpToUpdate !== undefined && readUpToUpdate > (t.readUpTo ?? -1)
            ? { ...t, readUpTo: readUpToUpdate }
            : t;
    });
}

export function getUpdatedEvents(
    directChats: DirectChatSummaryUpdates[],
    groupChats: GroupCanisterGroupChatSummaryUpdates[],
    communities: CommunityCanisterCommunitySummaryUpdates[],
): ChatMap<UpdatedEvent[]> {
    const result = new ChatMap<UpdatedEvent[]>();

    directChats
        .filter((c) => c.updatedEvents.length > 0)
        .forEach((c) => result.set(c.id, c.updatedEvents));

    groupChats
        .filter((c) => c.updatedEvents.length > 0)
        .forEach((c) => result.set(c.id, c.updatedEvents));

    communities
        .flatMap((c) => c.channelsUpdated)
        .filter((c) => c.updatedEvents.length > 0)
        .forEach((c) => result.set(c.id, c.updatedEvents));

    return result;
}

export function buildBlobUrl(
    pattern: string,
    canisterId: string,
    blobId: bigint,
    blobType: "blobs" | "avatar" | "banner",
    channelId?: ChannelIdentifier,
): string {
    const blobTypeFragment =
        channelId === undefined ? blobType : `channel/${channelId.channelId}/${blobType}`;

    return `${pattern
        .replace("{canisterId}", canisterId)
        .replace("{blobType}", blobTypeFragment)}/${blobId}`;
}

export function buildTokenLogoUrl(
    pattern: string,
    canisterId: string,
    ledger: string,
    logoId: bigint,
): string {
    return `${pattern
        .replace("{canisterId}", canisterId)
        .replace("{blobType}", "logo")}?ledger=${ledger}&id=${logoId}`;
}

export function buildUserAvatarUrl(pattern: string, userId: string, avatarId?: bigint): string {
    return avatarId !== undefined
        ? buildBlobUrl(pattern, userId, avatarId, "avatar")
        : userId === OPENCHAT_BOT_USER_ID
          ? OPENCHAT_BOT_AVATAR_URL
          : userId === OPENCHAT_VIDEO_CALL_USER_ID
            ? OPENCHAT_VIDEO_CALL_AVATAR_URL
            : buildIdenticonUrl(userId);
}

function buildIdenticonUrl(userId: string): string {
    const identicon = new Identicon(md5(userId), {
        margin: 0,
        format: "svg",
    });
    return `data:image/svg+xml;base64,${identicon}`;
}

export function emptyChatMetrics(): Metrics {
    return {
        audioMessages: 0,
        edits: 0,
        icpMessages: 0,
        sns1Messages: 0,
        ckbtcMessages: 0,
        giphyMessages: 0,
        deletedMessages: 0,
        reportedMessages: 0,
        fileMessages: 0,
        pollVotes: 0,
        textMessages: 0,
        imageMessages: 0,
        replies: 0,
        videoMessages: 0,
        polls: 0,
        reactions: 0,
    };
}

export function nextIndex(
    ascending: boolean,
    events: EventWrapper<ChatEvent>[],
): number | undefined {
    if (events.length === 0) return undefined;
    return ascending ? events[events.length - 1].index + 1 : events[0].index - 1;
}
