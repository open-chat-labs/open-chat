import {
    isDeletedUser,
    type BridgedUser,
    type BridgedUserId,
    type BridgedUserSummary,
    type BridgePlatform,
    type ChatEvent,
    type ChatSummary,
    type DiscordUser,
    type EventWrapper,
    type Message,
    type SenderContext,
    type UserLookup,
    type UserSummary,
} from "../domain";

export const BRIDGE_PLATFORM_NAMES: Record<BridgePlatform, string> = {
    discord: "Discord",
    telegram: "Telegram",
    twitch: "Twitch",
};

// Where Twitch serves profile images. A Twitch profile has its image's path on it.
const TWITCH_CDN_URL = "https://static-cdn.jtvnw.net";

// The account a message was relayed from, if a bridge bot relayed it from another platform
export function bridgedFrom(senderContext: SenderContext | undefined): BridgedUserId | undefined {
    return senderContext?.kind === "bot" ? senderContext.bridgedFrom : undefined;
}

// Whether a message is shown as the user's own: one they sent, or one a bridge bot relayed from an
// account they've linked. Only its look follows the link. What they can do with it, eg. edit or
// delete it, still goes by who sent it, which for a relayed message is the bridge bot.
export function shouldShowAsMe(
    sentByMe: boolean,
    linkedUserId: string | undefined,
    currentUserId: string,
): boolean {
    return sentByMe || (linkedUserId !== undefined && linkedUserId === currentUserId);
}

// The OpenChat user who linked the account a message was relayed from, shown as its author. If
// they've deleted their account, the account's own profile is shown again.
export function linkedAuthor(
    summary: BridgedUserSummary | undefined,
    users: Pick<UserLookup, "get">,
): UserSummary | undefined {
    const user = summary?.linkedUserId !== undefined ? users.get(summary.linkedUserId) : undefined;
    return user !== undefined && !isDeletedUser(user) ? user : undefined;
}

// Whether a message counts as the user's own, so it's read without being seen: one they sent, or
// one a bridge bot relayed from an account they've linked
export function isOwnMessage(
    message: Pick<Message, "sender" | "senderContext">,
    userId: string,
    bridgedUsers: ReadonlyMap<string, BridgedUserSummary>,
): boolean {
    const from = bridgedFrom(message.senderContext);
    const linkedUserId =
        from !== undefined ? bridgedUsers.get(bridgedUserKey(from)!)?.linkedUserId : undefined;
    return shouldShowAsMe(message.sender === userId, linkedUserId, userId);
}

// Who a tip on the message goes to: its sender, or for one a bridge bot relayed, the OpenChat user who
// linked the account it came from, as OpenChat pays them. They must be in the chat, so a relayed
// message from an account no one has linked, or whose user isn't in the chat, can't be tipped. Only
// users have wallets, so nor can a message a bot or a webhook sent: its id isn't an account anyone
// controls, so the tip would be lost.
export function tipRecipient(
    message: Pick<Message, "sender" | "senderContext">,
    sender: Pick<UserSummary, "kind"> | undefined,
    bridgedUsers: ReadonlyMap<string, BridgedUserSummary>,
    isMember: (userId: string) => boolean,
): string | undefined {
    const from = bridgedFrom(message.senderContext);
    if (from === undefined) {
        const sentByBot = message.senderContext !== undefined || sender?.kind === "bot";
        return sentByBot ? undefined : message.sender;
    }
    const linkedUserId = bridgedUsers.get(bridgedUserKey(from)!)?.linkedUserId;
    return linkedUserId !== undefined && isMember(linkedUserId) ? linkedUserId : undefined;
}

// Identifies an account across platforms, eg. to key the registry's profiles, and to group the
// messages a bridge bot sends by their authors
export function bridgedUserKey(id: BridgedUserId | undefined): string | undefined {
    return id === undefined ? undefined : `${id.kind}:${id.id}`;
}

export function bridgedUserId(user: BridgedUser): BridgedUserId {
    return { kind: user.kind, id: user.profile.id };
}

// The accounts the messages in `events`, and the messages they reply to, were relayed from
export function bridgedUserIdsFromEvents(events: EventWrapper<ChatEvent>[]): BridgedUserId[] {
    return bridgedUserIdsFromMessages(
        events.flatMap((e) => (e.event.kind === "message" ? [e.event] : [])),
    );
}

// The accounts the messages, and the messages they reply to, were relayed from
export function bridgedUserIdsFromMessages(
    messages: Pick<Message, "senderContext" | "repliesTo">[],
): BridgedUserId[] {
    const ids = new Map<string, BridgedUserId>();
    for (const message of messages) {
        const repliesTo = message.repliesTo;
        for (const id of [
            bridgedFrom(message.senderContext),
            repliesTo?.kind === "rehydrated_reply_context"
                ? bridgedFrom(repliesTo.senderContext)
                : undefined,
        ]) {
            if (id !== undefined) {
                ids.set(bridgedUserKey(id)!, id);
            }
        }
    }
    return [...ids.values()];
}

// The accounts the chats' latest messages were relayed from, so the chat list can show who sent them
export function bridgedUserIdsFromLatestMessages(chats: ChatSummary[]): BridgedUserId[] {
    return bridgedUserIdsFromEvents(chats.flatMap((chat) => chat.latestMessage ?? []));
}

// Undefined until the profile has been fetched
export function bridgedAuthorName(summary: BridgedUserSummary | undefined): string | undefined {
    const user = summary?.user;
    switch (user?.kind) {
        case "discord":
            return user.profile.displayName ?? user.profile.username;
        case "telegram":
        case "twitch":
            return user.profile.displayName;
        case undefined:
            return undefined;
    }
}

// The account's profile page on its platform, if it has one. A Telegram account has one only with a
// username. A Discord author can be a webhook, whose id isn't a user's, but a linked account is
// always a user.
export function bridgedProfileUrl(user: BridgedUser): string | undefined {
    switch (user.kind) {
        case "telegram":
            return user.profile.username !== undefined
                ? `https://t.me/${encodeURIComponent(user.profile.username)}`
                : undefined;
        case "discord":
            return `https://discord.com/users/${user.profile.id}`;
        case "twitch":
            return `https://www.twitch.tv/${encodeURIComponent(user.profile.login)}`;
    }
}

// The url of the author's avatar, if they have one. A Telegram user's photo is copied to the bridges'
// CDN, at `bridgeAvatarsUrl`, which is empty where there's none. A Twitch user's is on Twitch's CDN.
export function bridgedAuthorAvatarUrl(
    id: BridgedUserId,
    summary: BridgedUserSummary | undefined,
    bridgeAvatarsUrl: string,
): string | undefined {
    const user = summary?.user;
    switch (id.kind) {
        case "discord":
            return discordAvatarUrl(id.id, user?.kind === "discord" ? user.profile : undefined);
        case "telegram": {
            const photoId = user?.kind === "telegram" ? user.profile.photoId : undefined;
            return photoId === undefined || bridgeAvatarsUrl === ""
                ? undefined
                : `${bridgeAvatarsUrl}/telegram/${id.id}/${encodeURIComponent(photoId)}.jpg`;
        }
        case "twitch": {
            const image = user?.kind === "twitch" ? user.profile.profileImage : undefined;
            return image === undefined
                ? undefined
                : `${TWITCH_CDN_URL}/${image.split("/").map(encodeURIComponent).join("/")}`;
        }
    }
}

function discordAvatarUrl(id: string, profile: DiscordUser | undefined): string {
    if (profile?.avatar !== undefined) {
        return `https://cdn.discordapp.com/avatars/${id}/${profile.avatar}.png?size=128`;
    }
    // Discord's own default avatars, picked from the user's id
    const index = (BigInt(id) >> 22n) % 6n;
    return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
}
