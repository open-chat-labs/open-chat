import type { MessageActivityEvent } from "openchat-client";

class ActivityFeedState {
    #activityEvents = $state<MessageActivityEvent[]>([]);
    #latestTimestamp = $derived(this.#activityEvents[0]?.timestamp ?? 0n);

    get activityEvents() {
        return this.#activityEvents;
    }

    get latestTimestamp() {
        return this.#latestTimestamp;
    }

    set activityEvents(val: MessageActivityEvent[]) {
        this.#activityEvents = val;
    }
}

export const activityFeedState = new ActivityFeedState();
