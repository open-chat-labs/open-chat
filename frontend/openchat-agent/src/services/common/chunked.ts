import {
    MAX_EVENTS,
    ResponseTooLargeError,
    type ChatEvent,
    type EventsResponse,
    type EventsSuccessResult,
    type IndexRange,
} from "openchat-shared";

function mergeEventsResponse<T extends ChatEvent>(
    a: EventsSuccessResult<T>,
    b: EventsSuccessResult<T>,
): EventsSuccessResult<T> {
    return {
        events: [...a.events, ...b.events],
        expiredEventRanges: [...a.expiredEventRanges, ...b.expiredEventRanges],
        expiredMessageRanges: [...a.expiredMessageRanges, ...b.expiredMessageRanges],
        latestEventIndex: Math.max(a.latestEventIndex ?? 0, b.latestEventIndex ?? 0),
    };
}

export async function chunkedChatEventsFromBackend(
    eventsFn: (index: number, chunkSize: number) => Promise<EventsResponse<ChatEvent>>,
    [minIndex, maxIndex]: IndexRange,
    startIndex: number,
    ascending: boolean,
): Promise<EventsResponse<ChatEvent>> {
    const chunkSize = MAX_EVENTS / 5;
    let index = startIndex;

    let aggregatedResponse: EventsSuccessResult<ChatEvent> = {
        events: [],
        expiredEventRanges: [],
        expiredMessageRanges: [],
        latestEventIndex: undefined,
    };

    while (
        aggregatedResponse.events.length < MAX_EVENTS &&
        index >= minIndex &&
        index <= maxIndex
    ) {
        try {
            const resp = await eventsFn(index, chunkSize);

            // if we get any failures we will need to bail otherwise things are going to get very messed up
            if (resp === "events_failed") return resp;

            aggregatedResponse = ascending
                ? mergeEventsResponse(aggregatedResponse, resp)
                : mergeEventsResponse(resp, aggregatedResponse);
            if (resp.events.length > 0) {
                index = ascending
                    ? resp.events[resp.events.length - 1].index + 1
                    : resp.events[0].index - 1;
            }
        } catch (err) {
            if (err instanceof ResponseTooLargeError) {
                // Possible that we still have a size problem. If so, just log the error and bail out
                // if we see this condition we will have to think again but I'd rather avoid the complexity if we don't need it
                console.error("Response size still too large with chunk size: ", chunkSize);
            }
            throw err;
        }
    }

    return aggregatedResponse;
}

export async function chunkedChatEventsWindowFromBackend(
    eventsFn: (
        index: number,
        ascending: boolean,
        chunkSize: number,
    ) => Promise<EventsResponse<ChatEvent>>,
    eventsWindowFn: (index: number, chunkSize: number) => Promise<EventsResponse<ChatEvent>>,
    [minIndex, maxIndex]: IndexRange,
    messageIndex: number,
): Promise<EventsResponse<ChatEvent>> {
    const chunkSize = MAX_EVENTS / 5;

    let highIndex = messageIndex;
    let lowIndex = messageIndex;

    let aggregatedResponse: EventsSuccessResult<ChatEvent> = {
        events: [],
        expiredEventRanges: [],
        expiredMessageRanges: [],
        latestEventIndex: undefined,
    };

    while (
        aggregatedResponse.events.length < MAX_EVENTS &&
        (lowIndex >= minIndex || highIndex <= maxIndex)
    ) {
        try {
            if (lowIndex === highIndex) {
                // these will be equal on the first iteration
                const resp = await eventsWindowFn(lowIndex, chunkSize);

                // if we get any failures we will need to bail otherwise things are going to get very messed up
                if (resp === "events_failed") return resp;

                aggregatedResponse = mergeEventsResponse(aggregatedResponse, resp);
            } else {
                // in this branch we want to concurrently expand the window in both directions and then merge in the results
                if (lowIndex >= minIndex) {
                    const above = await eventsFn(lowIndex, false, chunkSize);

                    if (above === "events_failed") return "events_failed";

                    aggregatedResponse = mergeEventsResponse(above, aggregatedResponse);
                }

                if (highIndex <= maxIndex) {
                    const below = await eventsFn(highIndex, true, chunkSize);

                    if (below === "events_failed") return "events_failed";

                    aggregatedResponse = mergeEventsResponse(aggregatedResponse, below);
                }
            }

            if (aggregatedResponse.events.length > 0) {
                lowIndex = aggregatedResponse.events[0].index - 1;
                highIndex =
                    aggregatedResponse.events[aggregatedResponse.events.length - 1].index + 1;
            }
        } catch (err) {
            if (err instanceof ResponseTooLargeError) {
                // Possible that we still have a size problem. If so, just log the error and bail out
                // if we see this condition we will have to think again but I'd rather avoid the complexity if we don't need it
                console.error("Response size still too large with chunk size: ", chunkSize);
            }
            throw err;
        }
    }

    return aggregatedResponse;
}
