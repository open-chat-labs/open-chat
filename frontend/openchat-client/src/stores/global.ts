/* eslint-disable no-case-declarations */
import {
    ChatMap,
    CommunityMap,
    chatScopesEqual,
    type ChatIdentifier,
    type ChatListScope,
    type ChatSummary,
} from "openchat-shared";
import { derived } from "svelte/store";
import { app } from "../state/app.svelte";
import { createDummyStore } from "./dummyStore";
import { messagesRead } from "./markRead";
import { safeWritable } from "./safeWritable";

// These dummy stores only exist to help us keep things in sync while we migrate stuff
export const dummyServerCommunities = createDummyStore();
export const dummyServerDirectChats = createDummyStore();
export const dummyServerGroupChats = createDummyStore();
export const dummyServerFavourites = createDummyStore();

export type PinnedByScope = Map<ChatListScope["kind"], ChatIdentifier[]>;

// This should always be referenced via app.chatListScope where possible - this store only exists for backward compatibility and will be removed
export const chatListScopeStore = safeWritable<ChatListScope>({ kind: "none" }, chatScopesEqual);

export type CombinedUnreadCounts = {
    threads: UnreadCounts;
    chats: UnreadCounts;
};

export type UnreadCounts = {
    muted: number;
    unmuted: number;
    mentions: boolean;
};

export function emptyUnreadCounts(): UnreadCounts {
    return {
        muted: 0,
        unmuted: 0,
        mentions: false,
    };
}

export function emptyCombinedUnreadCounts(): CombinedUnreadCounts {
    return {
        chats: emptyUnreadCounts(),
        threads: emptyUnreadCounts(),
    };
}

function hasUnreadMentions(chat: ChatSummary): boolean {
    if (chat.kind === "direct_chat") return false;
    return (
        chat.membership.mentions.filter(
            (m) => !messagesRead.isRead({ chatId: chat.id }, m.messageIndex, m.messageId),
        ).length > 0
    );
}

function mergeUnreadCounts(
    unreadMessages: number,
    muted: boolean,
    mentions: boolean,
    counts: UnreadCounts,
    increment: number = 1,
): UnreadCounts {
    const toAdd = unreadMessages > 0 ? increment : 0;
    return {
        mentions: counts.mentions || mentions,
        unmuted: muted ? counts.unmuted : counts.unmuted + toAdd,
        muted: muted ? counts.muted + toAdd : counts.muted,
    };
}

function combinedUnreadCountForChats(chats: (ChatSummary | undefined)[]): CombinedUnreadCounts {
    return chats.reduce(
        (counts, chat) => {
            if (chat === undefined) return counts;

            const muted = chat.membership.notificationsMuted;
            const unreadMessages = messagesRead.unreadMessageCount(
                chat.id,
                chat.latestMessage?.event.messageIndex,
            );
            const mentions = unreadMessages > 0 && hasUnreadMentions(chat);
            const unreadThreads = messagesRead.staleThreadCountForChat(
                chat.id,
                chat.membership.latestThreads,
            );
            return {
                chats: mergeUnreadCounts(unreadMessages, muted, mentions, counts.chats),
                threads: mergeUnreadCounts(
                    unreadThreads,
                    muted,
                    false,
                    counts.threads,
                    unreadThreads,
                ),
            };
        },
        { chats: emptyUnreadCounts(), threads: emptyUnreadCounts() } as CombinedUnreadCounts,
    );
}

export function mergeCombinedUnreadCounts({ chats, threads }: CombinedUnreadCounts): UnreadCounts {
    return mergePairOfUnreadCounts(chats, threads);
}

export function mergeListOfCombinedUnreadCounts(
    counts: CombinedUnreadCounts[],
): CombinedUnreadCounts {
    return counts.reduce(
        (result, count) => mergePairOfCombinedUnreadCounts(result, count),
        emptyCombinedUnreadCounts(),
    );
}

export function mergePairOfCombinedUnreadCounts(
    a: CombinedUnreadCounts,
    b: CombinedUnreadCounts,
): CombinedUnreadCounts {
    return {
        chats: mergePairOfUnreadCounts(a.chats, b.chats),
        threads: mergePairOfUnreadCounts(a.threads, b.threads),
    };
}

export function mergePairOfUnreadCounts(a: UnreadCounts, b: UnreadCounts): UnreadCounts {
    return {
        muted: a.muted + b.muted,
        unmuted: a.unmuted + b.unmuted,
        mentions: a.mentions || b.mentions,
    };
}

// the messagesRead store is used as part of the derivation so that it gets recomputed when messages are read
export const unreadGroupCounts = derived(
    [dummyServerGroupChats, messagesRead],
    ([_, _$messagesRead]) => {
        return combinedUnreadCountForChats(Array.from(app.serverGroupChats.values()));
    },
);

export const unreadDirectCounts = derived(
    [dummyServerDirectChats, messagesRead],
    ([_, _$messagesRead]) => {
        return combinedUnreadCountForChats(Array.from(app.serverDirectChats.values()));
    },
);

export function getAllServerChats(): ChatMap<ChatSummary> {
    const groupChats = app.serverGroupChats.values();
    const directChats = app.serverDirectChats.values();
    const channels = [...app.serverCommunities.values()].flatMap((c) => c.channels);
    return ChatMap.fromList([...groupChats, ...directChats, ...channels]);
}

export const allServerChats = derived(
    [dummyServerGroupChats, dummyServerDirectChats, dummyServerCommunities],
    () => {
        return getAllServerChats();
    },
);

export const unreadFavouriteCounts = derived(
    [
        messagesRead,
        dummyServerGroupChats,
        dummyServerDirectChats,
        dummyServerCommunities,
        dummyServerFavourites,
    ],
    () => {
        const allChats = getAllServerChats();
        const chats = [...app.serverFavourites.values()].map((id) => allChats.get(id));
        return combinedUnreadCountForChats(chats);
    },
);

export const unreadCommunityChannelCounts = derived([dummyServerCommunities, messagesRead], () => {
    return app.serverCommunities.reduce((map, [id, community]) => {
        map.set(id, combinedUnreadCountForChats(community.channels));
        return map;
    }, new CommunityMap<CombinedUnreadCounts>());
});

export const globalUnreadCount = derived(
    [unreadGroupCounts, unreadDirectCounts, unreadCommunityChannelCounts],
    ([$groupCounts, $directCounts, $communities]) => {
        return mergeListOfCombinedUnreadCounts([
            $groupCounts,
            $directCounts,
            mergeListOfCombinedUnreadCounts(Array.from($communities.values())),
        ]);
    },
);
