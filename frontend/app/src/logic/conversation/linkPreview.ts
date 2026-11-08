import {
    i18nKey,
    type EventWrapper,
    type Message,
    type MessageContext,
    type OpenChat,
    type ResourceKey,
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

/** The link of the message's preview at `index` (as its bubble lists them), if there's one. */
export function previewLink(msg: Pick<Message, "ogPreviews">, index: number): string | undefined {
    return msg.ogPreviews[index]?.url;
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
