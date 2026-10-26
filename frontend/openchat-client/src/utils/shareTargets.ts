import {
    chatIdentifiersEqual,
    type ChatIdentifier,
    type ChatSummary,
    type CommunitySummary,
    type MultiUserChat,
    type ResourceKey,
} from "@shared";

/** What a chat needs for the picker to offer it: a DM's other user, or a group's or channel's name. */
export type ShareableChat =
    | { kind: "direct_chat"; id: ChatIdentifier; them: { userId: string } }
    | { kind: "group_chat" | "channel"; id: ChatIdentifier; name: string };

/** What a community needs for the picker: its name and channels. */
export type ShareableCommunity<C extends ShareableChat = ShareableChat> = {
    name: string;
    channels: C[];
};

// Where something can be shared to (the chat picker): the user's chats they can send text in,
// grouped as the old pickers group them, and searched as they search.

/** A chat something can be shared to: its summary and the name it goes by (a DM's: the other user's). */
export type ShareTarget<C extends ShareableChat = ChatSummary> = {
    chat: C;
    name: string;
    username?: string;
};

/** A community's channels something can be shared to. */
export type ShareCommunityTarget<
    C extends ShareableChat = ChatSummary,
    M extends ShareableCommunity<C> = CommunitySummary & ShareableCommunity<C>,
> = { community: M; channels: ShareTarget<C>[] };

export type ShareTargets<
    C extends ShareableChat = ChatSummary,
    M extends ShareableCommunity<C> = CommunitySummary & ShareableCommunity<C>,
> = {
    favourites: ShareTarget<C>[];
    directChats: ShareTarget<C>[];
    groupChats: ShareTarget<C>[];
    communities: ShareCommunityTarget<C, M>[];
};

export type ShareTargetsInput<C extends ShareableChat, M extends ShareableCommunity<C>> = {
    directChats: C[];
    groupChats: C[];
    communities: M[];
    isFavourite: (id: ChatIdentifier) => boolean;
    /** A DM's name, and its other user's username (searched as "@username"). */
    directChatName: (userId: string) => { name: string; username?: string };
    /** Whether the user can send text in a chat (#10115 invariant 1: only those are offered). */
    canSendText: (id: ChatIdentifier) => boolean;
    selectedChatId: ChatIdentifier | undefined;
    /** Leave the open chat out (#10115 invariant 2), as every caller does but the daily result's share. */
    excludeCurrent: boolean;
    search: string;
};

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);

/**
 * The chats something can be shared to: favourites, DMs, groups and each community's channels the
 * user can send text in, the open chat left out unless asked for. A search matches a chat's name or
 * a DM's "@username"; a community whose name matches keeps all its channels, otherwise only those
 * that match. Each group sorts by name.
 */
export function shareTargets<C extends ShareableChat, M extends ShareableCommunity<C>>(
    input: ShareTargetsInput<C, M>,
): ShareTargets<C, M> {
    const term = input.search.trim().toLocaleLowerCase();
    const offered = (chat: C) =>
        (!input.excludeCurrent || !chatIdentifiersEqual(input.selectedChatId, chat.id)) &&
        input.canSendText(chat.id);
    const target = (chat: C): ShareTarget<C> =>
        chat.kind === "direct_chat"
            ? { chat, ...input.directChatName(chat.them.userId) }
            : { chat, name: chat.name };
    const matches = (t: { name: string; username?: string }) =>
        term === "" ||
        t.name.toLocaleLowerCase().includes(term) ||
        (t.username !== undefined && `@${t.username}`.toLocaleLowerCase().includes(term));
    const targets = (chats: C[], search: boolean) =>
        chats
            .filter(offered)
            .map(target)
            .filter((t) => !search || matches(t))
            .sort(byName);

    const all = [
        ...input.groupChats,
        ...input.directChats,
        ...input.communities.flatMap((c) => c.channels),
    ];
    return {
        favourites: targets(
            all.filter((c) => input.isFavourite(c.id)),
            true,
        ),
        directChats: targets(input.directChats, true),
        groupChats: targets(input.groupChats, true),
        communities: input.communities
            .map((community) => ({
                community,
                channels: targets(community.channels, !matches(community)),
            }))
            .filter((c) => c.channels.length > 0)
            .sort((a, b) => byName(a.community, b.community)),
    };
}

/** How many chats there are to share to (favourites are counted where they belong too). */
export function shareTargetCount<C extends ShareableChat, M extends ShareableCommunity<C>>(
    targets: ShareTargets<C, M>,
): number {
    return (
        targets.directChats.length +
        targets.groupChats.length +
        targets.communities.reduce((n, c) => n + c.channels.length, 0)
    );
}

/** A group's line in the picker when it has no description: "Public group with 12 members". */
export function groupMembersLine(
    group: Pick<MultiUserChat, "public" | "memberCount" | "level">,
): ResourceKey {
    return {
        kind: "resource_key",
        key: group.public ? "publicGroupWithN" : "privateGroupWithN",
        params: { number: group.memberCount },
        level: group.level,
        lowercase: true,
    };
}

/**
 * What a share from another app (`/share?title&text&url`) puts in the chosen chat's draft
 * (#10115 invariant 3): the text, or the title without one, then the url on a line of its own; an
 * empty field adds no blank line.
 */
export function sharedDraftText({
    title,
    text,
    url,
}: {
    title?: string;
    text?: string;
    url?: string;
}): string {
    const body = text || title || undefined;
    return [body, url || undefined].filter((s) => s !== undefined).join("\n");
}
