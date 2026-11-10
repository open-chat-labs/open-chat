// Search in a chat asked for from its details' Search tile (native plan 10): the details go back
// to the conversation under them, which opens its search bar. The conversation owns its search,
// so it registers how to open it while it's mounted, by its chat (`chatIdentifierToString`).

const openers = new Map<string, () => void>();

/** Registers how the conversation for `chatKey` opens its search. Returns the call that unregisters it. */
export function onSearchRequest(chatKey: string, open: () => void): () => void {
    openers.set(chatKey, open);
    return () => {
        // a conversation for the same chat mounted since keeps its own
        if (openers.get(chatKey) === open) openers.delete(chatKey);
    };
}

/** Opens the search of the conversation for `chatKey`; whether one was there to open it. */
export function requestSearch(chatKey: string): boolean {
    const open = openers.get(chatKey);
    open?.();
    return open !== undefined;
}
