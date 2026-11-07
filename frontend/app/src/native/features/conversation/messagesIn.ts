import { chatIdentifiersEqual, type ChatIdentifier, type ChatSummary } from "@client";

// A conversation is pushed once it can show its messages as it slides in (README, "No loaders in
// the middle of the screen"): its chat selected with its first messages in, which come from the
// device's cache (CachePrimer keeps every chat's latest events there), so quickly. Mounted before
// them, it slid in empty, and the rows rendering as they came stalled the slide midway. The wait
// is capped: with nothing in the cache, or a link to a chat that's still loading, the screen goes
// at once after it and shows its small spinner at the top of the list.

type Source<T> = { subscribe(run: (value: T) => void): () => void };

/** Whether the conversation for `chatId` has what it shows at first. */
export function messagesShown(
    chatId: ChatIdentifier,
    selected: ChatSummary | undefined,
    events: readonly unknown[],
): boolean {
    if (selected === undefined || !chatIdentifiersEqual(selected.id, chatId)) return false;
    // a new chat has nothing to load
    return events.length > 0 || selected.latestEventIndex <= 0;
}

/** Resolves once `messagesShown`, or after `maxMs`, whichever is first. */
export function messagesIn(
    chatId: ChatIdentifier,
    sources: { selected: Source<ChatSummary | undefined>; events: Source<readonly unknown[]> },
    maxMs: number,
): Promise<void> {
    return new Promise((resolve) => {
        let selected: ChatSummary | undefined;
        let events: readonly unknown[] = [];
        let done = false;
        const unsubscribes: (() => void)[] = [];
        const finish = () => {
            if (done) return;
            done = true;
            clearTimeout(timer);
            unsubscribes.forEach((unsubscribe) => unsubscribe());
            resolve();
        };
        const check = () => {
            if (messagesShown(chatId, selected, events)) finish();
        };
        const timer = setTimeout(finish, maxMs);
        unsubscribes.push(
            sources.selected.subscribe((value) => {
                selected = value;
                check();
            }),
        );
        unsubscribes.push(
            sources.events.subscribe((value) => {
                events = value;
                check();
            }),
        );
        // a store that answered at once, before the other was there to unsubscribe
        if (done) unsubscribes.forEach((unsubscribe) => unsubscribe());
    });
}
