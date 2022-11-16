import { enoughVisibleMessages, nextIndex } from "../../utils/chat";
import type { ChatEvent, EventWrapper, EventsResponse, IndexRange } from "openchat-shared";

const MAX_RECURSION = 10;

export async function getChatEventsInLoop<T extends ChatEvent>(
    getChatEventsFunc: (startIndex: number, ascending: boolean) => Promise<EventsResponse<T>>,
    eventIndexRange: IndexRange,
    startIndex: number,
    ascending: boolean,
    myUserId: string,
    previouslyLoadedEvents: EventWrapper<T>[] = [],
    iterations = 0
): Promise<EventsResponse<T>> {
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
    if (enoughVisibleMessages(ascending, eventIndexRange, merged, myUserId)) {
        console.log("we got enough visible messages to display now");
        return { ...response, events: merged };
    } else if (iterations < MAX_RECURSION) {
        const idx = nextIndex(ascending, merged) ?? startIndex;
        if (response.events.length === 0) {
            return new Promise<EventsResponse<T>>((resolve) => {
                setTimeout(() => {
                    console.log(
                        "Got no events although one canister has said some exist. Waiting a short duration to allow other canisters to catch up",
                        ascending,
                        eventIndexRange,
                        startIndex,
                        previouslyLoadedEvents.length,
                        iterations
                    );
                    resolve(
                        getChatEventsInLoop(
                            getChatEventsFunc,
                            eventIndexRange,
                            idx,
                            ascending,
                            myUserId,
                            merged,
                            iterations + 1
                        )
                    );
                }, 200);
            });
        }
        // recurse and get the next chunk since we don't yet have enough events
        console.log("We don't have enough visible events, recursing", response.events);
        return getChatEventsInLoop(
            getChatEventsFunc,
            eventIndexRange,
            idx,
            ascending,
            myUserId,
            merged,
            iterations + 1
        );
    } else {
        throw new Error(
            `Reached the maximum number of iterations of ${MAX_RECURSION} when trying to load events: ascending (${ascending}), range (${eventIndexRange}), so far (${previouslyLoadedEvents.length})`
        );
    }
}
