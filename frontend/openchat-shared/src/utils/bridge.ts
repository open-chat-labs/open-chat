import type { BridgedFrom, BridgePlatform, DiscordUser, SenderContext } from "../domain";
import { buildBlobUrl } from "./blobs";

export const BRIDGE_PLATFORM_NAMES: Record<BridgePlatform, string> = {
    discord: "Discord",
    telegram: "Telegram",
};

// Where a message was relayed from, if a bridge bot relayed it from another platform
export function bridgedFrom(senderContext: SenderContext | undefined): BridgedFrom | undefined {
    return senderContext?.kind === "bot" ? senderContext.bridgedFrom : undefined;
}

// Identifies the author across platforms, since a bridge bot sends every message it relays
export function bridgedAuthorKey(bridged: BridgedFrom | undefined): string | undefined {
    return bridged === undefined ? undefined : `${bridged.kind}:${bridged.author.id}`;
}

export function bridgedAuthorName(bridged: BridgedFrom): string {
    switch (bridged.kind) {
        case "discord":
            return bridged.author.displayName ?? bridged.author.username;
        case "telegram":
            return bridged.author.displayName;
    }
}

// The url of the author's avatar, if they have one
export function bridgedAuthorAvatarUrl(
    bridged: BridgedFrom,
    blobUrlPattern: string,
): string | undefined {
    switch (bridged.kind) {
        case "discord":
            return discordAvatarUrl(bridged.author);
        case "telegram": {
            const avatar = bridged.author.avatar;
            return avatar === undefined
                ? undefined
                : buildBlobUrl(blobUrlPattern, avatar.canisterId, avatar.blobId, "blobs");
        }
    }
}

function discordAvatarUrl(user: DiscordUser): string {
    if (user.avatar !== undefined) {
        return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`;
    }
    // Discord's own default avatars, picked from the user's id
    const index = (BigInt(user.id) >> 22n) % 6n;
    return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
}
