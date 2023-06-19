import {
    ChatEvent,
    ChatSummary,
    ChatSummaryUpdates,
    DirectChatSummary,
    DirectChatSummaryUpdates,
    EventWrapper,
    GroupChatDetails,
    GroupChatDetailsUpdates,
    GroupChatSummary,
    GroupChatSummaryUpdates,
    GroupSubtype,
    GroupSubtypeUpdate,
    Member,
    Mention,
    Message,
    ThreadRead,
    ThreadSyncDetails,
    ThreadSyncDetailsUpdates,
    GroupCanisterGroupChatSummary,
    GroupCanisterGroupChatSummaryUpdates,
    UserCanisterGroupChatSummary,
    UserCanisterGroupChatSummaryUpdates,
    GroupCanisterSummaryResponse,
    GroupCanisterSummaryUpdatesResponse,
    GroupCanisterThreadDetails,
    UpdatedEvent,
    ChatMap,
    Metrics,
} from "openchat-shared";
import { toRecord } from "./list";
import { applyOptionUpdate, mapOptionUpdate } from "./mapping";
import Identicon from "identicon.js";
import md5 from "md5";
import { OPENCHAT_BOT_AVATAR_URL, OPENCHAT_BOT_USER_ID } from "../constants";

// this is used to merge both the overall list of chats with updates and also the list of participants
// within a group chat
function mergeThings<A, U>(
    keyFn: (a: A | U) => string,
    mergeFn: (existing: A | undefined, updated: U) => A | undefined,
    things: A[],
    updates: { added: A[]; updated: U[]; removed: Set<string> }
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

export function mergeUpdates(
    chat: ChatSummary | undefined,
    updatedChat: ChatSummaryUpdates
): ChatSummary | undefined {
    if (!chat) return undefined;

    if (chat.chatId !== updatedChat.chatId) {
        throw new Error("Cannot update chat from a chat with a different chat id");
    }

    if (chat.kind === "group_chat" && updatedChat.kind === "group_chat") {
        return mergeUpdatedGroupChat(chat, updatedChat);
    }

    if (chat.kind === "direct_chat" && updatedChat.kind === "direct_chat") {
        return mergeUpdatedDirectChat(chat, updatedChat);
    }

    throw new Error("Cannot update chat with a chat of a different kind");
}

function mergeUpdatedDirectChat(
    chat: DirectChatSummary,
    updatedChat: DirectChatSummaryUpdates
): DirectChatSummary {
    return {
        ...chat,
        readByThemUpTo: updatedChat.readByThemUpTo ?? chat.readByThemUpTo,
        latestEventIndex: getLatestEventIndex(chat, updatedChat),
        latestMessage: getLatestMessage(chat, updatedChat),
        metrics: updatedChat.metrics ?? chat.metrics,
        membership: {
            ...chat.membership,
            readByMeUpTo: updatedChat.readByMeUpTo ?? chat.membership.readByMeUpTo,
            notificationsMuted:
                updatedChat.notificationsMuted ?? chat.membership.notificationsMuted,
            myMetrics: updatedChat.myMetrics ?? chat.membership.myMetrics,
            archived: updatedChat.archived ?? chat.membership.archived,
        },
    };
}

function mergeUpdatedGroupChat(
    chat: GroupChatSummary,
    updatedChat: GroupChatSummaryUpdates
): GroupChatSummary {
    const latestMessage = getLatestMessage(chat, updatedChat);
    const readByMeUpTo = updatedChat.readByMeUpTo ?? chat.membership.readByMeUpTo;
    return {
        ...chat,
        name: updatedChat.name ?? chat.name,
        description: updatedChat.description ?? chat.description,
        lastUpdated: updatedChat.lastUpdated,
        latestEventIndex: getLatestEventIndex(chat, updatedChat),
        latestMessage,
        blobReference: applyOptionUpdate(chat.blobReference, updatedChat.avatarBlobReferenceUpdate),
        memberCount: updatedChat.memberCount ?? chat.memberCount,
        permissions: updatedChat.permissions ?? chat.permissions,
        metrics: updatedChat.metrics ?? chat.metrics,
        public: updatedChat.public ?? chat.public,
        subtype: mergeSubtype(updatedChat.subtype, chat.subtype),
        frozen: applyOptionUpdate(chat.frozen, updatedChat.frozen) ?? false,
        dateLastPinned: updatedChat.dateLastPinned ?? chat.dateLastPinned,
        dateReadPinned: updatedChat.dateReadPinned ?? chat.dateReadPinned,
        membership: {
            ...chat.membership,
            readByMeUpTo:
                latestMessage !== undefined && readByMeUpTo !== undefined
                    ? Math.min(readByMeUpTo, latestMessage.event.messageIndex)
                    : readByMeUpTo,
            notificationsMuted:
                updatedChat.notificationsMuted ?? chat.membership.notificationsMuted,
            role:
                updatedChat.myRole ??
                (chat.membership.role === "none" ? "member" : chat.membership.role),
            mentions: mergeMentions(chat.membership.mentions, updatedChat.mentions),
            myMetrics: updatedChat.myMetrics ?? chat.membership.myMetrics,
            latestThreads: mergeThreadSyncDetails(
                updatedChat.latestThreads,
                chat.membership.latestThreads
            ),
            archived: updatedChat.archived ?? chat.membership.archived,
        },
    };
}

function mergeThreadSyncDetails(
    updated: ThreadSyncDetailsUpdates[] | undefined,
    existing: ThreadSyncDetails[]
) {
    if (updated === undefined) return existing;

    return Object.values(
        updated.reduce(
            (merged, thread) => {
                const existing = merged[thread.threadRootMessageIndex];
                if (existing !== undefined || thread.latestEventIndex !== undefined) {
                    merged[thread.threadRootMessageIndex] = {
                        threadRootMessageIndex: thread.threadRootMessageIndex,
                        lastUpdated: thread.lastUpdated,
                        readUpTo: thread.readUpTo ?? existing?.readUpTo,
                        latestEventIndex: thread.latestEventIndex ?? existing.latestEventIndex,
                        latestMessageIndex:
                            thread.latestMessageIndex ?? existing.latestMessageIndex,
                    };
                }
                return merged;
            },
            toRecord(existing, (t) => t.threadRootMessageIndex)
        )
    );
}

function mergeSubtype(
    updated: GroupSubtypeUpdate | undefined,
    existing: GroupSubtype
): GroupSubtype {
    if (updated === undefined || updated.kind === "no_change") {
        return existing;
    } else if (updated.kind === "set_to_none") {
        return undefined;
    } else {
        return updated.subtype;
    }
}

function mergeMentions(existing: Mention[], incoming: Mention[]): Mention[] {
    return [
        ...existing,
        ...incoming.filter(
            (m1) => existing.find((m2) => m1.messageId === m2.messageId) === undefined
        ),
    ];
}

function getLatestEventIndex(chat: ChatSummary, updatedChat: ChatSummaryUpdates): number {
    return Math.max(updatedChat.latestEventIndex ?? 0, chat.latestEventIndex);
}

function getLatestMessage(
    chat: ChatSummary,
    updatedChat: ChatSummaryUpdates
): EventWrapper<Message> | undefined {
    if (chat.latestMessage === undefined) return updatedChat.latestMessage;
    if (updatedChat.latestMessage === undefined) return chat.latestMessage;

    // Otherwise take the one with the highest event index, if they match, take the server version since it may have had
    // subsequent updates (eg. deleted)
    return updatedChat.latestMessage.index >= chat.latestMessage.index
        ? updatedChat.latestMessage
        : chat.latestMessage;
}

export function mergeGroupChatDetails(
    previous: GroupChatDetails,
    updates: GroupChatDetailsUpdates
): GroupChatDetails {
    return {
        latestEventIndex: updates.latestEventIndex,
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
            })
        ),
        invitedUsers: updates.invitedUsers ?? previous.invitedUsers,
        pinnedMessages: mergePinnedMessages(
            previous.pinnedMessages,
            updates.pinnedMessagesAdded,
            updates.pinnedMessagesRemoved
        ),
        rules: updates.rules ?? previous.rules,
    };
}

function mergePinnedMessages(
    current: Set<number>,
    added: Set<number>,
    removed: Set<number>
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
    updates: DirectChatSummaryUpdates[]
): DirectChatSummary[] {
    const lookup = ChatMap.fromList(updates);

    return directChats.map((c) => {
        const u = lookup.get(c.chatId);

        if (u === undefined) return c;

        return {
            kind: "direct_chat",
            id: c.them,
            chatId: c.them,
            them: c.them,
            readByThemUpTo: u.readByThemUpTo ?? c.readByThemUpTo,
            dateCreated: c.dateCreated,
            latestEventIndex: u.latestEventIndex ?? c.latestEventIndex,
            latestMessage: u.latestMessage ?? c.latestMessage,
            metrics: u.metrics ?? c.metrics,
            membership: {
                ...c.membership,
                readByMeUpTo: u.readByMeUpTo ?? c.membership.readByMeUpTo,
                notificationsMuted: u.notificationsMuted ?? c.membership.notificationsMuted,
                myMetrics: u.myMetrics ?? c.membership.myMetrics,
                archived: u.archived ?? c.membership.archived,
            },
        };
    });
}

export function mergeGroupChatUpdates(
    groupChats: GroupChatSummary[],
    userCanisterUpdates: UserCanisterGroupChatSummaryUpdates[],
    groupCanisterUpdates: GroupCanisterGroupChatSummaryUpdates[]
): GroupChatSummary[] {
    const userLookup = ChatMap.fromList<UserCanisterGroupChatSummaryUpdates>(userCanisterUpdates);
    const groupLookup =
        ChatMap.fromList<GroupCanisterGroupChatSummaryUpdates>(groupCanisterUpdates);

    return groupChats.map((c) => {
        const u = userLookup.get(c.chatId);
        const g = groupLookup.get(c.chatId);

        if (u === undefined && g === undefined) return c;

        const latestMessage = g?.latestMessage ?? c.latestMessage;
        const readByMeUpTo = u?.readByMeUpTo ?? c.membership.readByMeUpTo;

        const blobReferenceUpdate = mapOptionUpdate(g?.avatarId, (avatarId) => ({
            blobId: avatarId,
            canisterId: c.chatId.id,
        }));

        return {
            kind: "group_chat",
            chatId: c.chatId,
            id: c.chatId,
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
            readByMeUpTo:
                readByMeUpTo !== undefined && latestMessage !== undefined
                    ? Math.min(readByMeUpTo, latestMessage.event.messageIndex)
                    : readByMeUpTo,
            latestEventIndex: g?.latestEventIndex ?? c.latestEventIndex,
            latestMessage,
            metrics: g?.metrics ?? c.metrics,
            blobReference: applyOptionUpdate(c.blobReference, blobReferenceUpdate),
            dateLastPinned: g?.dateLastPinned ?? c.dateLastPinned,
            dateReadPinned: u?.dateReadPinned ?? c.dateReadPinned,
            gate: applyOptionUpdate(c.gate, g?.gate) ?? { kind: "no_gate" },
            level: "group",
            membership: {
                ...c.membership,
                mentions:
                    g === undefined
                        ? c.membership.mentions
                        : [...g.mentions, ...c.membership.mentions],
                role: g?.myRole ?? c.membership.role,
                latestThreads: mergeThreads(
                    c.membership.latestThreads,
                    g?.latestThreads ?? [],
                    u?.threadsRead ?? {}
                ),
                notificationsMuted: g?.notificationsMuted ?? c.membership.notificationsMuted,
                myMetrics: g?.myMetrics ?? c.membership.myMetrics,
                archived: u?.archived ?? c.membership.archived,
            },
        };
    });
}

export function mergeGroupChats(
    userCanisterGroups: UserCanisterGroupChatSummary[],
    groupCanisterGroups: GroupCanisterGroupChatSummary[]
): GroupChatSummary[] {
    const userCanisterGroupLookup = ChatMap.fromList(userCanisterGroups);

    return groupCanisterGroups.map((g) => {
        const u = userCanisterGroupLookup.get(g.chatId);

        return {
            kind: "group_chat",
            chatId: g.chatId,
            id: g.chatId,
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
            metrics: g.metrics,
            blobReference:
                g.avatarId !== undefined
                    ? { blobId: g.avatarId, canisterId: g.chatId.id }
                    : undefined,
            dateLastPinned: g.dateLastPinned,
            dateReadPinned: u?.dateReadPinned,
            gate: g.gate,
            level: "group",
            membership: {
                joined: g.joined,
                role: g.myRole,
                mentions: g.mentions,
                latestThreads: mergeThreads([], g.latestThreads, u?.threadsRead ?? {}),
                myMetrics: g.myMetrics,
                notificationsMuted: g.notificationsMuted,
                readByMeUpTo: u?.readByMeUpTo,
                archived: u?.archived ?? false,
            },
        };
    });
}

function mergeThreads(
    current: ThreadSyncDetails[],
    groupCanisterUpdates: GroupCanisterThreadDetails[],
    readUpToUpdates: Record<number, number>
): ThreadSyncDetails[] {
    const threadsRecord = toRecord(current, (t) => t.threadRootMessageIndex);

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

export function isSuccessfulGroupSummaryResponse(
    response: GroupCanisterSummaryResponse
): response is GroupCanisterGroupChatSummary {
    return "chatId" in response;
}

export function isSuccessfulGroupSummaryUpdatesResponse(
    response: GroupCanisterSummaryUpdatesResponse
): response is GroupCanisterGroupChatSummaryUpdates {
    return "chatId" in response;
}

export function getUpdatedEvents(
    directChats: DirectChatSummaryUpdates[],
    groupChats: GroupCanisterGroupChatSummaryUpdates[]
): ChatMap<UpdatedEvent[]> {
    const result = new ChatMap<UpdatedEvent[]>();

    directChats.forEach((c) => result.set(c.chatId, c.updatedEvents));
    groupChats.forEach((c) => result.set(c.chatId, c.updatedEvents));

    return result;
}

export function identity<T>(x: T): T {
    return x;
}

export function getFirstUnreadMessageIndex(chat: ChatSummary): number | undefined {
    if (chat.chatId.kind === "group_chat" && chat.membership.role === "none") return undefined;
    return chat.membership.readByMeUpTo;
}

export function threadsReadFromChat(chat: ChatSummary): ThreadRead[] {
    return chat.membership.latestThreads
        .filter((t) => t.readUpTo !== undefined)
        .map((t) => ({
            threadRootMessageIndex: t.threadRootMessageIndex,
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            readUpTo: t.readUpTo!,
        }));
}

export function buildBlobUrl(
    pattern: string,
    canisterId: string,
    blobId: bigint,
    blobType: "blobs" | "avatar" | "banner"
): string {
    return `${pattern
        .replace("{canisterId}", canisterId)
        .replace("{blobType}", blobType)}${blobId}`;
}

export function buildUserAvatarUrl(pattern: string, userId: string, avatarId?: bigint): string {
    return avatarId !== undefined
        ? buildBlobUrl(pattern, userId, avatarId, "avatar")
        : userId === OPENCHAT_BOT_USER_ID
        ? OPENCHAT_BOT_AVATAR_URL
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
    events: EventWrapper<ChatEvent>[]
): number | undefined {
    if (events.length === 0) return undefined;
    return ascending ? events[events.length - 1].index + 1 : events[0].index - 1;
}
