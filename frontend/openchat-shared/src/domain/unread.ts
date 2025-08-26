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

export function mergeUnreadCounts(
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

export function mergeCombinedUnreadCounts({ chats, threads }: CombinedUnreadCounts): UnreadCounts {
    return mergePairOfUnreadCounts(chats, threads);
}
