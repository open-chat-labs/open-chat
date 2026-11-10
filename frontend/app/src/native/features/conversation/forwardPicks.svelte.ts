import type { ChatIdentifier } from "@client";
import { SvelteMap } from "svelte/reactivity";

/** What the forward sheet forwards: the chats picked, in the order they were picked, and the note. */
export type ForwardPicked = { chatIds: ChatIdentifier[]; note: string };

/**
 * What the forward sheet holds (ForwardSheet): the search, the chats picked (by their identifier as
 * a string, kept while a search hides them) and the note. Each time the sheet opens it starts
 * afresh, the same message forwarded again too.
 */
export class ForwardPicks<M> {
    query = $state("");
    note = $state("");
    readonly #picked = new SvelteMap<string, ChatIdentifier>();
    // the message the sheet is open on; none while it's closed
    #shown: M | undefined;

    /** The message the sheet is open on (none: it's closed). One opened starts afresh. */
    show(message: M | undefined): void {
        if (message !== undefined && message !== this.#shown) {
            this.query = "";
            this.note = "";
            this.#picked.clear();
        }
        this.#shown = message;
    }

    /** How many chats are picked. */
    get count(): number {
        return this.#picked.size;
    }

    isPicked(id: string): boolean {
        return this.#picked.has(id);
    }

    toggle(id: string, chatId: ChatIdentifier): void {
        if (this.#picked.has(id)) this.#picked.delete(id);
        else this.#picked.set(id, chatId);
    }

    /** What to forward, the note trimmed; nothing while no chat is picked. */
    picked(): ForwardPicked | undefined {
        if (this.#picked.size === 0) return undefined;
        return { chatIds: [...this.#picked.values()], note: this.note.trim() };
    }
}
