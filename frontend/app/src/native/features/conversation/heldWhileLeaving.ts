// What the conversation shows of its chat, held once the chat isn't selected any more. Going back
// changes the URL at once, and with it the selection (RouteEffects): the client drops the chat's
// events and details then, while the screen is still sliding out. The screen keeps showing what it
// had until it's gone, rather than an empty list. Before the chat is first selected there is
// nothing to hold, so the initial value shows.

export class HeldWhileLeaving<T> {
    #value: T;

    constructor(initial: T) {
        this.#value = initial;
    }

    /** `live` while the screen's chat is selected (and kept); what was kept last once it isn't. */
    of(selected: boolean, live: T): T {
        if (selected) this.#value = live;
        return this.#value;
    }
}
