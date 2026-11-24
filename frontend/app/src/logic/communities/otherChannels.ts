import type { ChannelMatch } from "@client";

// A community's channels the user isn't in (the old mobile list's "Other channels", the native
// Communities tab's "Not joined · tap to read" rows), from what `exploreChannels` finds.

/** Those found that aren't among the user's chats, in the order found. */
export function otherChannels(
    found: readonly ChannelMatch[],
    joined: { has: (id: ChannelMatch["id"]) => boolean },
): ChannelMatch[] {
    return found.filter((c) => !joined.has(c.id));
}

/**
 * Whether a channel the user isn't in can be opened to read: a public one, or one they're invited
 * to.
 */
export function canReadChannel(channel: Pick<ChannelMatch, "public" | "invited">): boolean {
    return channel.public || channel.invited;
}
