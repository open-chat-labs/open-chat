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
        if (!messageContextsEqual(this.#id, id)) {
            throw new Error("We should not be getting events for the wrong thread - investigate");
        }
        this.#events = fn(this.#events);
    }

    static empty(id?: ThreadIdentifier) {
        return new ThreadServerState(id);
    }
}
