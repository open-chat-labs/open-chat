import type { Message, MessageActivityEvent } from "openchat-client";
import { SvelteMap } from "svelte/reactivity";

class ActivityFeedState {
    #initialised = $state(false);
    #activityEvents = $state<MessageActivityEvent[]>([]);
    #latestTimestamp = $derived(this.#activityEvents[0]?.timestamp ?? 0n);
    #messages = $state<Map<bigint, Message>>(new SvelteMap());

    populateMessages(events: MessageActivityEvent[]) {
        events.forEach((ev) => {
            if (ev.message !== undefined && !this.#messages.has(ev.messageId)) {
                this.#messages.set(ev.messageId, ev.message);
            }
        });
    }

    getMessage(messageId: bigint): Message | undefined {
        return this.#messages.get(messageId);
    }

    get initialised() {
        return this.#initialised;
    }

    get activityEvents() {
        return this.#activityEvents;
    }

    get latestTimestamp() {
        return this.#latestTimestamp;
    }

    set activityEvents(val: MessageActivityEvent[]) {
        this.#activityEvents = val;
        this.#initialised = true;
    }
}

export const activityFeedState = new ActivityFeedState();
