import type { ChatIdentifier, Message, OpenChat } from "@client";
import { quickReactions } from "@src/stores/quickReactions";

/**
 * Adds the reaction to a message in a chat, or takes it off if the user had it. The library's
 * pickers keep no favourites of their own (the old trees' picker counted its picks), so every
 * reaction added counts towards the quick ones.
 */
export async function toggleReaction(
    client: Pick<OpenChat, "toggleReaction">,
    chatId: ChatIdentifier,
    msg: Message,
    emoji: string,
): Promise<void> {
    const toggled = await client.toggleReaction({ chatId }, msg, emoji);
    if (toggled === "added") {
        quickReactions.incrementFavourite(emoji);
        quickReactions.reload();
    }
}
