import type { DiscordUser, SenderContext } from "../domain";

// The Discord user a message was relayed from, if the Discord bot relayed it from Discord
export function discordAuthor(senderContext: SenderContext | undefined): DiscordUser | undefined {
    return senderContext?.kind === "bot" ? senderContext.discordAuthor : undefined;
}

export function discordDisplayName(user: DiscordUser): string {
    return user.displayName ?? user.username;
}

export function discordAvatarUrl(user: DiscordUser): string {
    if (user.avatar !== undefined) {
        return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`;
    }
    // Discord's own default avatars, picked from the user's id
    const index = (BigInt(user.id) >> 22n) % 6n;
    return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
}
