import type { AttachmentContent, MessageContext, OpenChat } from "@client";
import { MAX_MEDIA } from "./mediaSelection.svelte";

// Photos and videos attached together (native plan 05 "Attachments in the composer": up to ten,
// one removed at a time, more added). A message holds one attachment, so the first is the draft's
// (`localUpdates.draftMessages`, kept with the chat) and goes with the text; the others, held by
// the composer, follow it in messages of their own. Media and files don't mix: media attached
// takes a file's place.

/** What's attached: the draft's attachment, and the photos and videos after it. */
export type Staged = {
    first: AttachmentContent | undefined;
    more: readonly AttachmentContent[];
};

/** A photo or video (what the composer's media tray shows, and more of which may be added). */
export function isMedia(content: AttachmentContent | undefined): boolean {
    return content?.kind === "image_content" || content?.kind === "video_content";
}

/** How many photos and videos are attached. */
export function mediaCount(staged: Staged): number {
    return (isMedia(staged.first) ? 1 : 0) + staged.more.length;
}

/**
 * `added` attached after those already there, up to ten in all; in place of anything else that
 * was attached (a file, a GIF).
 */
export function stageMedia(staged: Staged, added: readonly AttachmentContent[]): Staged {
    if (added.length === 0) return staged;
    if (isMedia(staged.first)) {
        return { first: staged.first, more: [...staged.more, ...added].slice(0, MAX_MEDIA - 1) };
    }
    return { first: added[0], more: added.slice(1, MAX_MEDIA) };
}

/** The `index`th of the tray removed: the first's place taken by the next. */
export function unstage(staged: Staged, index: number): Staged {
    if (index === 0) return { first: staged.more[0], more: staged.more.slice(1) };
    return { first: staged.first, more: staged.more.filter((_, i) => i !== index - 1) };
}

/** How sending the photos and videos after the draft's went: all posted, or the rest left. */
export type MoreSent =
    | { kind: "posted" }
    | { kind: "refused"; reason: string; left: AttachmentContent[] };

/**
 * Sends the photos and videos that follow the draft's (once it's posted) to the chat or thread
 * (`context`), one message each, in order, each waiting for the last to show. Refused, it stops:
 * those not sent are `left`, to stay attached.
 */
export async function sendMoreMedia(
    client: Pick<OpenChat, "sendContent">,
    context: MessageContext,
    more: readonly AttachmentContent[],
): Promise<MoreSent> {
    for (let i = 0; i < more.length; i++) {
        const outcome = await client.sendContent(context, more[i]);
        if (outcome.kind !== "posted") {
            return { kind: "refused", reason: outcome.kind, left: more.slice(i) };
        }
    }
    return { kind: "posted" };
}
