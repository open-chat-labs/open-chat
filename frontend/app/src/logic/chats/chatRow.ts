import {
    chatIdentifierToString,
    chatMatchesSearch,
    getDisplayDate,
    getTypingString,
    latestMessageExpired,
    ownGroupAvatarUrl,
    ownUserAvatarUrl,
    unreadMentionCount,
    type ChatIdentifier,
    type ChatSummary,
    type CommunitySummary,
    type GroupAvatarLookups,
    type MessageFormatter,
    type OpenChat,
    type TypersByKey,
    type UserLookup,
} from "@client";
import { buildDisplayName } from "@src/utils/user";
import { latestMessagePreview, type PreviewText } from "./latestMessagePreview";
import { typedMentions, type MentionLookups } from "../conversation/typedMentions";
import { swatchFor, type Swatch } from "../swatch";

export { swatchFor, type Swatch };

// ChatSummary to a chat list's rows: ChatListPanel's on the web (src/web/DATA.md, ChatListPanel
// rows), ChatRow's in the native Chats tab. The client's lookups (names, avatars, message text,
// dates, unread counts) come in through RowContext, so this stays pure. Who's typing and who's
// online change far more often than the chats do, so they go over a built row (`liveRow`) rather
// than into RowContext, which would build every row again.

/** A chat list row: ChatRow's props, with the chat's id and its section (ChatListPanel's). */
export type ChatListRow = {
    /** The chat's id (chatIdentifierToString). */
    id: string;
    title: string;
    preview: string;
    previewIcon: "forward" | undefined;
    time: string;
    kind: "user" | "group" | "channel";
    color: Swatch;
    /**
     * The avatar: the user's for a DM, else the group's or channel's (`chatAvatarUrl`). None when
     * the chat has no picture of its own: ChatRow then shows its swatch.
     */
    avatarUrl: string | undefined;
    locked: boolean;
    unreadCount: number;
    /** Unread mentions of the user (a group or channel only). */
    mentions: number;
    muted: boolean;
    pinned: boolean;
    section: "Pinned" | "Chats";
    liveCall: "" | "video";
    selected: boolean;
    /**
     * A DM whose other user's account is suspended (by a platform moderator): ChatRow dims the
     * avatar, marks it and tags the name. Never a group or channel (they're frozen, not suspended).
     */
    suspended: boolean;
};

export type RowContext = {
    userName: (userId: string) => string;
    /** Whether a user's account is suspended (their UserSummary's `suspended`). */
    userSuspended: (userId: string) => boolean;
    /** The latest message as the row shows it (app/src/logic/chats/latestMessagePreview). */
    preview: (chat: ChatSummary) => string;
    /** A chat's display date as the list shows it (a time today, else a short date). */
    date: (timestamp: bigint) => string;
    unread: (chat: ChatSummary) => number;
    /**
     * A chat's unread mentions of the user (unreadMentionCount). Only for a list that shows them
     * (`withMentionsAndAvatars`): without it every row has none.
     */
    mentions?: (chat: ChatSummary) => number;
    /** A chat the user can't read into (a preview, while suspended): no unread counts. */
    readOnly: (chat: ChatSummary) => boolean;
    /**
     * A chat's own picture, if it has one (`chatAvatarUrl`). Only for a list that shows them
     * (`withMentionsAndAvatars`): without it every row has its swatch.
     */
    avatar?: (chat: ChatSummary) => string | undefined;
    /** The pinned chats in the list's scope (chatIdentifierToString). */
    pinned: ReadonlySet<string>;
    /** The selected chat (chatIdentifierToString), if any. */
    selected?: string;
};

/** What a list's RowContext is built from: the stores' values the rows read. */
export type RowContextInputs = Pick<
    PreviewText,
    "formatter" | "me" | "translations" | "bridgedUsers"
> & {
    users: UserLookup;
    /**
     * The user groups a latest message can mention: every community's (userGroupSummariesStore),
     * as a list can hold any community's channels. Looked up only for a message that mentions one.
     */
    userGroups: MentionLookups["userGroups"];
    /** The list's scope's pinned chats (pinnedChatsStore). */
    pinned: readonly ChatIdentifier[];
    selected?: ChatIdentifier;
    /** The scope's community, for a channel's avatar where the client doesn't know its community. */
    community?: CommunitySummary;
    /**
     * The rows' unread mentions and pictures, which cost a read check per mention and the user,
     * SNS and community look-ups for every row: only a list that shows them asks (the web's; the
     * native Chats tab doesn't show them yet).
     */
    withMentionsAndAvatars?: boolean;
};

/**
 * The RowContext every chat list builds from the client and the stores: names as the client shows
 * them, the latest message as `latestMessagePreview` has it with its mentions as the @names typed
 * (`typedMentions`; the old trees show it through Markdown instead), the list's dates, unread
 * counts, and, for a list that asks (`withMentionsAndAvatars`), the chats' own pictures
 * (`chatAvatarUrl`) and unread mentions. The counts read `messagesRead`'s state, so a list builds
 * its context again as that store changes.
 */
export function rowContext(
    client: Pick<
        OpenChat,
        | "displayName"
        | "getContentAsText"
        | "formatMessageDate"
        | "unreadMessageCount"
        | "isMessageRead"
        | "isChatReadOnly"
        | "tryGetNervousSystem"
        | "getCommunityForChannel"
    >,
    {
        formatter,
        me,
        users,
        userGroups,
        translations,
        bridgedUsers,
        pinned,
        selected,
        community,
        withMentionsAndAvatars = false,
    }: RowContextInputs,
): RowContext {
    const groupAvatars = groupAvatarLookups(client, community);
    // the preview shows its mentions as the @names typed: the list is built again as the users
    // load (it follows allUsersStore), so a mention of someone loaded later gets their name then
    const typed = typedMentions({ users, userGroups });
    const extras: Pick<RowContext, "mentions" | "avatar"> = withMentionsAndAvatars
        ? {
              mentions: (chat) =>
                  unreadMentionCount(chat, (index, id) =>
                      client.isMessageRead({ chatId: chat.id }, index, id),
                  ),
              avatar: (chat) => chatAvatarUrl(chat, users, groupAvatars),
          }
        : {};
    return {
        userName: (userId) => client.displayName(users.get(userId)),
        // the list is built again as allUsersStore changes, so a suspension shows as it loads
        userSuspended: (userId) => users.get(userId)?.suspended ?? false,
        preview: (chat) =>
            latestMessagePreview(chat, {
                formatter,
                me,
                displayName: (userId, kind) => buildDisplayName(users, userId, kind, false),
                translations,
                contentText: (content) => typed(client.getContentAsText(formatter, content)),
                bridgedUsers,
                users,
            }),
        date: (timestamp) =>
            client.formatMessageDate(
                timestamp,
                formatter("today"),
                formatter("yesterday"),
                true,
                true,
            ),
        unread: (chat) =>
            client.unreadMessageCount(chat.id, chat.latestMessage?.event.messageIndex),
        readOnly: (chat) => client.isChatReadOnly(chat.id),
        ...extras,
        pinned: new Set(pinned.map(chatIdentifierToString)),
        selected: selected && chatIdentifierToString(selected),
    };
}

/**
 * Where a chat list looks up a group's or channel's own picture (ownGroupAvatarUrl): an SNS's logo,
 * and a channel's community's avatar, if the community has one. The community is the client's for
 * the channel, else the list's (`community`). Unlike the client's groupAvatarUrl, a community with
 * no avatar gives none, not its identicon.
 */
export function groupAvatarLookups(
    client: Pick<OpenChat, "tryGetNervousSystem" | "getCommunityForChannel">,
    community?: CommunitySummary,
): GroupAvatarLookups {
    return {
        snsLogo: (governanceCanisterId) =>
            client.tryGetNervousSystem(governanceCanisterId)?.token.logo,
        communityAvatar: (channelId) =>
            (client.getCommunityForChannel(channelId) ?? community)?.avatar.blobUrl,
    };
}

/**
 * A chat's own picture: a DM's user's avatar (ownUserAvatarUrl), else the group's or channel's
 * (ownGroupAvatarUrl: its avatar, a proposals chat's SNS logo, a channel's community's). None when
 * it has none, where the old trees show the client's default pictures and the new web UI's ChatRow
 * shows its swatch (the user's decision, GAPS.md).
 */
export function chatAvatarUrl(
    chat: ChatSummary,
    users: UserLookup,
    groups: GroupAvatarLookups,
): string | undefined {
    return chat.kind === "direct_chat"
        ? ownUserAvatarUrl(users.get(chat.them.userId))
        : ownGroupAvatarUrl(chat, groups);
}

export function chatTitle(chat: ChatSummary, ctx: Pick<RowContext, "userName">): string {
    return chat.kind === "direct_chat" ? ctx.userName(chat.them.userId) : chat.name;
}

/**
 * A chat's unread count; none once its latest message has disappeared (as the old row), and none
 * for a chat the user can't read into (a preview, while suspended: the old desktop row's).
 */
export function unreadCount(
    chat: ChatSummary,
    ctx: Pick<RowContext, "unread" | "readOnly">,
    now = Date.now(),
): number {
    return latestMessageExpired(chat, now) || ctx.readOnly(chat) ? 0 : ctx.unread(chat);
}

/**
 * A chat's unread mentions, none when it has no unread count (`unreadCount`) or the list doesn't
 * show them (no `mentions` in its context).
 */
export function unreadMentions(
    chat: ChatSummary,
    ctx: Pick<RowContext, "mentions" | "readOnly">,
    now = Date.now(),
): number {
    if (ctx.mentions === undefined) return 0;
    return latestMessageExpired(chat, now) || ctx.readOnly(chat) ? 0 : ctx.mentions(chat);
}

/** Whether the preview gets the forward icon: the latest message, still there, was forwarded. */
export function latestForwarded(chat: ChatSummary, now = Date.now()): boolean {
    const latest = chat.latestMessage?.event;
    return (
        latest !== undefined &&
        latest.forwarded &&
        latest.content.kind !== "deleted_content" &&
        !latestMessageExpired(chat, now)
    );
}

export function chatRow(chat: ChatSummary, ctx: RowContext, now = Date.now()): ChatListRow {
    const id = chatIdentifierToString(chat.id);
    const pinned = ctx.pinned.has(id);
    return {
        id,
        title: chatTitle(chat, ctx),
        preview: ctx.preview(chat),
        previewIcon: latestForwarded(chat, now) ? "forward" : undefined,
        time: ctx.date(getDisplayDate(chat)),
        kind:
            chat.kind === "direct_chat" ? "user" : chat.kind === "group_chat" ? "group" : "channel",
        color: swatchFor(id),
        avatarUrl: ctx.avatar?.(chat),
        // a private group or channel shows a lock
        locked: chat.kind !== "direct_chat" && !chat.public,
        unreadCount: unreadCount(chat, ctx, now),
        mentions: unreadMentions(chat, ctx, now),
        muted: chat.membership.notificationsMuted,
        pinned,
        section: pinned ? "Pinned" : "Chats",
        liveCall: chat.videoCallInProgress !== undefined ? "video" : "",
        selected: ctx.selected === id,
        suspended: chat.kind === "direct_chat" && ctx.userSuspended(chat.them.userId),
    };
}

/** Who's typing in a chat and whether a DM's other user is online, which go over its built row. */
export type LiveRow = {
    /** "Lucy is typing" / "3 members are typing" (getTypingString), in place of the preview. */
    typing: string | undefined;
    /** A DM's other user is online (a DM's row only). */
    online: boolean;
};

/** What a chat's live row state is read from. */
export type LiveRowInputs = {
    formatter: MessageFormatter;
    users: UserLookup;
    /** Who's typing where (typing's byContext). */
    typers: TypersByKey;
    /** The users who are online (`OnlineUsers`). */
    online: ReadonlySet<string>;
};

/**
 * Who's typing in a chat (in the chat itself, not its threads) and, for a DM, whether the other
 * user is online. Presence is a DM row's dot only.
 */
export function liveRow(chat: ChatSummary, inputs: LiveRowInputs): LiveRow {
    return {
        typing: getTypingString(inputs.formatter, inputs.users, { chatId: chat.id }, inputs.typers),
        online: chat.kind === "direct_chat" && inputs.online.has(chat.them.userId),
    };
}

/**
 * Whether a chat is in the list: an archived one only while a search is on, and then a chat only
 * if it matches the search as the old list's does (chatMatchesSearch: a group's name or
 * description, a direct chat's username or display name).
 */
export function listed(chat: ChatSummary, query: string, users: UserLookup): boolean {
    const q = query.trim().toLowerCase();
    return q === "" ? !chat.membership.archived : chatMatchesSearch(q, chat, users);
}
