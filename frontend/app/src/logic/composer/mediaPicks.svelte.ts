import type { AttachmentContent, MessageContext, OpenChat } from "@client";
import type { MediaAttachment } from "@openchat/ui/src/lib/types";

// The photos and videos picked for a message (native plan 06 "Selecting media", "live in the
// composer"): the composer's media and the attach panel's selection are one list, in the order
// picked, numbered by it, up to ten. Each goes into the composer as it's picked, its thumbnail
// first and its content once it's prepared (a video's takes a while). A message holds one
// attachment, so the first goes with the caption and the others follow it, a message each.

/** At most this many photos and videos go with one message. */
export const MAX_MEDIA = 10;

/** A photo or video to pick: its id (unique among those offered), kind and thumbnail. */
export type PickSource = { id: string; video: boolean; thumb?: string; duration?: string };

/** One picked: its content once it's prepared. */
export type PickedMedia = PickSource & { content: AttachmentContent | undefined };

/** What a tap on one did: picked it, put it back, or nothing, ten being picked already. */
export type PickOutcome = "picked" | "unpicked" | "full";

export class MediaPicks {
    #picks = $state.raw<PickedMedia[]>([]);

    /** Those picked, in the order they were. */
    get picks(): readonly PickedMedia[] {
        return this.#picks;
    }

    get count(): number {
        return this.#picks.length;
    }

    /** How many more may be picked. */
    get room(): number {
        return MAX_MEDIA - this.#picks.length;
    }

    /** Its number in the selection (1 for the first picked), or undefined, not picked. */
    numberOf(id: string): number | undefined {
        const i = this.#picks.findIndex((p) => p.id === id);
        return i < 0 ? undefined : i + 1;
    }

    /** Picks it, or, picked, puts it back (those after it move up a number). */
    toggle(source: PickSource): PickOutcome {
        if (this.numberOf(source.id) !== undefined) {
            this.remove(source.id);
            return "unpicked";
        }
        return this.add(source);
    }

    /** Picks it (one from the camera or a picker, never picked before), unless ten are. */
    add(source: PickSource): PickOutcome {
        if (this.#picks.length >= MAX_MEDIA) return "full";
        this.#picks = [...this.#picks, { ...source, content: undefined }];
        return "picked";
    }

    remove(id: string): void {
        this.#picks = this.#picks.filter((p) => p.id !== id);
    }

    /** The composer's thumbnail at `index` removed. */
    removeAt(index: number): void {
        this.#picks = this.#picks.filter((_, i) => i !== index);
    }

    clear(): void {
        if (this.#picks.length > 0) this.#picks = [];
    }

    /** Its content is prepared (unless it's been put back meanwhile). */
    prepared(id: string, content: AttachmentContent): void {
        if (this.numberOf(id) === undefined) return;
        this.#picks = this.#picks.map((p) => (p.id === id ? { ...p, content } : p));
    }

    /** The contents prepared, in the order picked. */
    contents(): AttachmentContent[] {
        return this.#picks.flatMap((p) => (p.content === undefined ? [] : [p.content]));
    }
}

/** The picks as the composer's media tray shows them: each thumbnail, a video with its length. */
export function picksTray(picks: readonly PickedMedia[]): MediaAttachment {
    return {
        type: "media",
        items: picks.map((p) =>
            p.video
                ? {
                      kind: "video",
                      bg:
                          p.thumb === undefined
                              ? undefined
                              : `center/cover no-repeat url("${p.thumb}")`,
                      dur: p.duration,
                  }
                : { kind: "image", src: p.thumb },
        ),
    };
}

/** How sending the photos and videos after the first went: all posted, or the rest left. */
export type MoreSent =
    | { kind: "posted" }
    | { kind: "refused"; reason: string; left: AttachmentContent[] };

/**
 * Sends the photos and videos that follow the first (once it's posted) to the chat or thread
 * (`context`), one message each, in order, each waiting for the last to show. Refused, it stops:
 * those not sent are `left`.
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
