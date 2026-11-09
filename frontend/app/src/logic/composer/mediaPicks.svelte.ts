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

/**
 * One picked: its content once it's prepared. `key` is this pick's own: one put back and picked
 * again keeps its id (a Recents tile's) but is a new pick, with a new key, and a job preparing the
 * earlier one no longer touches it.
 */
export type PickedMedia = PickSource & { key: number; content: AttachmentContent | undefined };

/** What a tap on one did: picked it, put it back, or nothing, ten being picked already. */
export type PickOutcome = "picked" | "unpicked" | "full";

/**
 * A photo or video not sent (a send refused part way), to pick again with its content: `thumb`
 * is the content's own, not one the picks made.
 */
export type LeftMedia = { id: string; video: boolean; thumb?: string; content: AttachmentContent };

/**
 * What a send takes: the contents prepared, in the order picked, and the picks they're from (by
 * key: one put back and picked again while the send posts is a new pick, and stays).
 */
export type TakenMedia = { picks: readonly PickedMedia[]; contents: AttachmentContent[] };

export class MediaPicks {
    #picks = $state.raw<PickedMedia[]>([]);
    // the thumbnails made for picks (a file's object URL), let go of as each goes
    #made = new Map<string, string>();
    // those being prepared, by key, each settling once it's prepared or dropped
    #jobs = new Map<number, Promise<void>>();
    #nextKey = 0;
    readonly #revoke: (thumb: string) => void;

    /** `revoke` lets go of a thumbnail `add` made (URL.revokeObjectURL). */
    constructor(revoke: (thumb: string) => void = () => {}) {
        this.#revoke = revoke;
    }

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

    /** The key of the pick with this id, or undefined, not picked. */
    keyOf(id: string): number | undefined {
        return this.#picks.find((p) => p.id === id)?.key;
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

    /**
     * Picks it (one from the camera or a picker, never picked before), unless ten are. `thumb`
     * makes its thumbnail once it's in (an object URL, let go of as it goes).
     */
    add(source: PickSource, thumb?: () => string): PickOutcome {
        if (this.#picks.length >= MAX_MEDIA) return "full";
        let picked: PickSource = source;
        if (thumb !== undefined) {
            const made = thumb();
            this.#made.set(source.id, made);
            picked = { ...source, thumb: made };
        }
        this.#picks = [...this.#picks, { ...picked, key: this.#nextKey++, content: undefined }];
        return "picked";
    }

    /**
     * Picks again, ahead of those picked since, those a send left (in their order), as many as
     * there's room for. Returns how many there wasn't room for.
     */
    restore(left: readonly LeftMedia[]): number {
        const back = left.slice(0, this.room).map(({ id, video, thumb, content }) => ({
            id,
            video,
            thumb,
            key: this.#nextKey++,
            content,
        }));
        if (back.length > 0) this.#picks = [...back, ...this.#picks];
        return left.length - back.length;
    }

    remove(id: string): void {
        this.#drop((p) => p.id === id);
    }

    /** The composer's thumbnail at `index` removed. */
    removeAt(index: number): void {
        this.#drop((_, i) => i === index);
    }

    /** Those a send took (`take`), once sent: those picked since, or picked again, stay. */
    removeSent(taken: readonly PickedMedia[]): void {
        const sent = new Set(taken.map((p) => p.key));
        this.#drop((p) => sent.has(p.key));
    }

    clear(): void {
        this.#drop(() => true);
    }

    /** The component holding them goes: their thumbnails are let go of. */
    dispose(): void {
        this.#made.forEach((thumb) => this.#revoke(thumb));
        this.#made.clear();
    }

    /** The pick `key`'s content is on its way: `job` settles once it's prepared (or dropped). */
    preparing(key: number, job: Promise<void>): void {
        this.#jobs.set(
            key,
            job.catch(() => {}).finally(() => this.#jobs.delete(key)),
        );
    }

    /** The pick `key`'s content is prepared (nothing, if it's been put back meanwhile). */
    prepared(key: number, content: AttachmentContent): void {
        if (!this.#picks.some((p) => p.key === key)) return;
        this.#picks = this.#picks.map((p) => (p.key === key ? { ...p, content } : p));
    }

    /**
     * The pick `key` couldn't be prepared: it's put back. False if it had been already (nothing to
     * say about it then).
     */
    unprepared(key: number): boolean {
        const picked = this.#picks.some((p) => p.key === key);
        this.#drop((p) => p.key === key);
        return picked;
    }

    /** Those picked now, by id: what a send takes (those picked while it waits aren't). */
    ids(): string[] {
        return this.#picks.map((p) => p.id);
    }

    /**
     * What a send of those picked (`ids`) takes, once none of them is still being prepared (one
     * put back and picked again meanwhile is prepared afresh, and waited for too): the contents
     * prepared, in the order picked, and the picks they're from, the ones to take out once sent
     * (`removeSent`, by key). One that couldn't be prepared, or is put back, is left out of both.
     */
    async take(ids: readonly string[]): Promise<TakenMedia> {
        const wanted = new Set(ids);
        const jobs = () =>
            this.#picks.flatMap((p) => (wanted.has(p.id) ? (this.#jobs.get(p.key) ?? []) : []));
        for (let waiting = jobs(); waiting.length > 0; waiting = jobs()) await Promise.all(waiting);
        const taken = this.#picks.filter((p) => wanted.has(p.id) && p.content !== undefined);
        return {
            picks: taken,
            contents: taken.flatMap((p) => (p.content === undefined ? [] : [p.content])),
        };
    }

    // takes those out, letting go of the thumbnails made for them
    #drop(out: (pick: PickedMedia, index: number) => boolean) {
        const kept: PickedMedia[] = [];
        this.#picks.forEach((p, i) => {
            if (!out(p, i)) {
                kept.push(p);
                return;
            }
            const made = this.#made.get(p.id);
            if (made !== undefined) {
                this.#made.delete(p.id);
                this.#revoke(made);
            }
        });
        if (kept.length !== this.#picks.length) this.#picks = kept;
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

/** One a send left, to pick again: a photo shows as itself, a video as its thumbnail. */
export function leftMedia(id: string, content: AttachmentContent): LeftMedia {
    switch (content.kind) {
        case "image_content":
            return { id, video: false, thumb: content.blobUrl ?? content.thumbnailData, content };
        case "video_content":
            return { id, video: true, thumb: content.thumbnailData, content };
        default:
            return { id, video: false, content };
    }
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
