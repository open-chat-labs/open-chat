/** A chat as the list's automatic unarchiving sees it. */
export type ArchiveState = { id: string; archived: boolean; unread: number };

/**
 * Which archived chats to bring back out of the archive (as the old row did): one with unread
 * messages, asked once while it stays archived. A chat is asked again only after it has been out
 * of the archive with no request on its way (an unarchive updates the chat before the request
 * settles, and undoes that if it fails), so a request that fails isn't repeated by itself.
 */
export class AutoUnarchive {
    #asked = new Set<string>();
    #inFlight = new Set<string>();

    /** The chats to ask to unarchive now; each is on its way until `settled`. */
    next(chats: Iterable<ArchiveState>): string[] {
        const ask: string[] = [];
        for (const chat of chats) {
            if (!chat.archived) {
                if (!this.#inFlight.has(chat.id)) this.#asked.delete(chat.id);
            } else if (chat.unread > 0 && !this.#asked.has(chat.id)) {
                this.#asked.add(chat.id);
                this.#inFlight.add(chat.id);
                ask.push(chat.id);
            }
        }
        return ask;
    }

    /** A request has settled, whichever way. */
    settled(id: string): void {
        this.#inFlight.delete(id);
    }
}
