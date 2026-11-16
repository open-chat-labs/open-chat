import {
    extractTwitchEmbeds,
    i18nKey,
    twitchPlayersAndCards,
    type EventWrapper,
    type Message,
    type MessageContext,
    type OgPreview,
    type OpenChat,
    type ResourceKey,
    type TwitchPlayerPreview,
} from "@client";

// Taking a link's preview off a message, as the old trees let its sender (once they've confirmed
// it), for every tree.

/** Whether the reader can take previews off the message: their own text message, with some. */
export function canRemovePreviews(
    msg: Pick<Message, "sender" | "content" | "ogPreviews">,
    me: string,
): boolean {
    return msg.sender === me && msg.content.kind === "text_content" && msg.ogPreviews.length > 0;
}

/**
 * What a text message shows for its links, as the old trees' LinkPreviews does: a player for each
 * Twitch link in its text (with that link's preview, if the sender fetched one, for its poster), and a
 * card for each other preview. Nothing for another kind.
 */
export function linkPreviews(msg: Pick<Message, "content" | "ogPreviews">): {
    players: TwitchPlayerPreview[];
    cards: OgPreview[];
} {
    if (msg.content.kind !== "text_content") return { players: [], cards: [] };
    return twitchPlayersAndCards(extractTwitchEmbeds(msg.content.text), msg.ogPreviews);
}

/** The link of the message's card at `index` (as its bubble lists them), if there's one. */
export function previewLink(
    msg: Pick<Message, "content" | "ogPreviews">,
    index: number,
): string | undefined {
    return linkPreviews(msg).cards[index]?.url;
}

/** Takes the link's preview off the message; what to say if it couldn't. */
export async function removeLinkPreview(
    client: Pick<OpenChat, "hideLinkPreview">,
    context: MessageContext,
    evt: EventWrapper<Message>,
    url: string,
): Promise<ResourceKey | undefined> {
    return (await client.hideLinkPreview(context, evt, url))
        ? undefined
        : i18nKey("errorRemovingLinkPreview");
}
