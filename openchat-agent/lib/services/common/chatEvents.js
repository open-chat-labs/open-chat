import { enoughVisibleMessages, nextIndex } from "../../domain/chat/chat.utils";
const MAX_RECURSION = 10;
export async function getChatEventsInLoop(getChatEventsFunc, eventIndexRange, startIndex, ascending, previouslyLoadedEvents = [], iterations = 0) {
    var _a;
    const response = await getChatEventsFunc(startIndex, ascending);
    if (response === "events_failed") {
        return response;
    }
    // merge the retrieved events with the events accumulated from the previous iteration(s)
    // todo - we also need to merge affected events
    const merged = ascending
        ? [...previouslyLoadedEvents, ...response.events]
        : [...response.events, ...previouslyLoadedEvents];
    // check whether we have accumulated enough messages to display
    if (enoughVisibleMessages(ascending, eventIndexRange, merged)) {
        console.log("we got enough visible messages to display now");
        return Object.assign(Object.assign({}, response), { events: merged });
    }
    else if (iterations < MAX_RECURSION) {
        const idx = (_a = nextIndex(ascending, merged)) !== null && _a !== void 0 ? _a : startIndex;
        if (response.events.length === 0) {
            return new Promise((resolve) => {
                setTimeout(() => {
                    console.log("Got no events although one canister has said some exist. Waiting a short duration to allow other canisters to catch up", ascending, eventIndexRange, startIndex, previouslyLoadedEvents.length, iterations);
                    resolve(getChatEventsInLoop(getChatEventsFunc, eventIndexRange, idx, ascending, merged, iterations + 1));
                }, 200);
            });
        }
        // recurse and get the next chunk since we don't yet have enough events
        console.log("We don't have enough visible events, recursing", response.events);
        return getChatEventsInLoop(getChatEventsFunc, eventIndexRange, idx, ascending, merged, iterations + 1);
    }
    else {
        throw new Error(`Reached the maximum number of iterations of ${MAX_RECURSION} when trying to load events: ascending (${ascending}), range (${eventIndexRange}), so far (${previouslyLoadedEvents.length})`);
    }
}
//# sourceMappingURL=chatEvents.js.map