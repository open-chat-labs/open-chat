import type {
    BridgedUser,
    BridgedUserId,
    BridgedUserSummary,
    BridgePlatform,
    ChatEvent,
    DiscordUser,
    EventWrapper,
    SenderContext,
} from "../domain";
import { buildBlobUrl } from "./blobs";

export const BRIDGE_PLATFORM_NAMES: Record<BridgePlatform, string> = {
    discord: "Discord",
    telegram: "Telegram",
};

// The account a message was relayed from, if a bridge bot relayed it from another platform
export function bridgedFrom(senderContext: SenderContext | undefined): BridgedUserId | undefined {
    return senderContext?.kind === "bot" ? senderContext.bridgedFrom : undefined;
}

// Whether a message is shown as the user's own: one they sent, or one a bridge bot relayed from an
// account they've linked. Only its look follows the link. What they can do with it, eg. edit or
// delete it, still goes by who sent it, which for a relayed message is the bridge bot.
export function shownAsMine(
    sentByMe: boolean,
    linkedUserId: string | undefined,
    currentUserId: string,
): boolean {
    return sentByMe || (linkedUserId !== undefined && linkedUserId === currentUserId);
}

// Identifies an account across platforms, eg. to key the registry's profiles, and to group the
// messages a bridge bot sends by their authors
export function bridgedUserKey(id: BridgedUserId | undefined): string | undefined {
    return id === undefined ? undefined : `${id.kind}:${id.id}`;
}

export function bridgedUserId(user: BridgedUser): BridgedUserId {
    return { kind: user.kind, id: user.profile.id };
}

// The accounts the messages in `events` were relayed from
export function bridgedUserIdsFromEvents(events: EventWrapper<ChatEvent>[]): BridgedUserId[] {
    const ids = new Map<string, BridgedUserId>();
    for (const e of events) {
        const id = e.event.kind === "message" ? bridgedFrom(e.event.senderContext) : undefined;
        if (id !== undefined) {
            ids.set(bridgedUserKey(id)!, id);
        }
    }
    return [...ids.values()];
}

// Undefined until the profile has been fetched
export function bridgedAuthorName(summary: BridgedUserSummary | undefined): string | undefined {
    const user = summary?.user;
    switch (user?.kind) {
        case "discord":
            return user.profile.displayName ?? user.profile.username;
        case "telegram":
            return user.profile.displayName;
        case undefined:
            return undefined;
    }
}

// The url of the author's avatar, if they have one
export function bridgedAuthorAvatarUrl(
    id: BridgedUserId,
    summary: BridgedUserSummary | undefined,
    blobUrlPattern: string,
): string | undefined {
    const user = summary?.user;
    if (id.kind === "discord") {
        return discordAvatarUrl(id.id, user?.kind === "discord" ? user.profile : undefined);
    }
    const avatar = user?.kind === "telegram" ? user.profile.avatar : undefined;
    return avatar === undefined
        ? undefined
        : buildBlobUrl(blobUrlPattern, avatar.canisterId, avatar.blobId, "blobs");
}

function discordAvatarUrl(id: string, profile: DiscordUser | undefined): string {
    if (profile?.avatar !== undefined) {
        return `https://cdn.discordapp.com/avatars/${id}/${profile.avatar}.png?size=128`;
    }
    // Discord's own default avatars, picked from the user's id
    const index = (BigInt(id) >> 22n) % 6n;
    return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
}
