import DRange from "drange";
import {
    messageContextsEqual,
    type ChatEvent,
    type EventWrapper,
    type ThreadIdentifier,
} from "openchat-shared";

export class ThreadServerState {
    #id = $state<ThreadIdentifier | undefined>();
    #events = $state<EventWrapper<ChatEvent>[]>([]);
    #confirmedEventIndexesLoaded = $derived.by(() => {
        const ranges = new DRange();
        this.#events.forEach((e) => ranges.add(e.index));
        return ranges;
    });

    constructor(id?: ThreadIdentifier) {
        this.#id = id;
    }

    get id() {
        return this.#id;
    }

    get confirmedEventIndexesLoaded() {
        return this.#confirmedEventIndexesLoaded;
    }

    get events() {
        return this.#events;
    }

    updateEvents(
        id: ThreadIdentifier,
        fn: (existing: EventWrapper<ChatEvent>[]) => EventWrapper<ChatEvent>[],
    ) {
        if (!messageContextsEqual(id, this.#id)) {
            console.warn(
                "Attempting to updateThreadEvents for the wrong thread - probably a stale response",
                id,
                this.#id,
            );
            return;
        }
        this.#events = fn(this.#events);
    }

    static empty(id?: ThreadIdentifier) {
        return new ThreadServerState(id);
    }
}
