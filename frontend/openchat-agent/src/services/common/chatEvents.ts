import {
    type ChannelIdentifier,
    type ChatEvent,
    type ChatIdentifier,
    type DirectChatIdentifier,
    type EventsResponse, type EventsSuccessResult,
    type GroupChatIdentifier,
    type IndexRange, isSuccessfulEventsResponse, MAX_MISSING,
    type Message, offline, ResponseTooLargeError
} from "openchat-shared";
import { MAX_EVENTS } from "openchat-shared";
import {
    type Database,
    getCachedEvents,
    getCachedEventsByIndex, getCachedEventsWindowByMessageIndex, loadMessagesByMessageIndex,
    mergeSuccessResponses,
    setCachedEvents
} from "../../utils/caching";
import {chunkedChatEventsFromBackend, chunkedChatEventsWindowFromBackend} from "./chunked";

export interface IChatEventsReader<C extends ChatIdentifier = ChatIdentifier> {
    chatEvents(
        chatId: C,
        startIndex: number,
        ascending: boolean,
        threadRootMessageIndex: number | undefined,
        latestKnownUpdate: bigint | undefined,
        maxEvents: number,
    ): Promise<EventsResponse<ChatEvent>>;

    chatEventsByIndex(
        chatId: C,
        eventIndexes: number[],
        threadRootMessageIndex: number | undefined,
        latestKnownUpdate: bigint | undefined,
    ): Promise<EventsResponse<ChatEvent>>;

    chatEventsWindow(
        chatId: C,
        messageIndex: number,
        threadRootMessageIndex: number | undefined,
        latestKnownUpdate: bigint | undefined,
        maxEvents: number,
    ): Promise<EventsResponse<ChatEvent>>;

    messagesByMessageIndex(
        chatId: C,
        threadRootMessageIndex: number | undefined,
        messageIndexes: number[],
        latestKnownUpdate: bigint | undefined,
    ): Promise<EventsResponse<Message>>;
}

export class CachedChatEventsReader {
    constructor(
        private userClient: IChatEventsReader<DirectChatIdentifier>,
        private readonly groupClient: IChatEventsReader<GroupChatIdentifier>,
        private readonly communityClient: IChatEventsReader<ChannelIdentifier>,
        private readonly db: Database,
    ) {}

    setUserClient(userClient: IChatEventsReader<DirectChatIdentifier>) {
        this.userClient = userClient;
    }

    chatEvents(
        chatId: ChatIdentifier,
        eventIndexRange: IndexRange,
        startIndex: number,
        ascending: boolean,
        threadRootMessageIndex: number | undefined,
        latestKnownUpdate: bigint | undefined,
        maxEvents: number = MAX_EVENTS
    ): Promise<EventsResponse<ChatEvent>> {
        const reader = this.eventsReader(chatId.kind);
        return this.chatEventsViaCache(
            reader,
            chatId,
            eventIndexRange,
            startIndex,
            ascending,
            threadRootMessageIndex,
            latestKnownUpdate,
            maxEvents
        );
    }

    chatEventsByIndex(
        chatId: ChatIdentifier,
        eventIndexes: number[],
        threadRootMessageIndex: number | undefined,
        latestKnownUpdate: bigint | undefined
    ): Promise<EventsResponse<ChatEvent>> {
        const reader = this.eventsReader(chatId.kind);
        return this.chatEventsByIndexViaCache(reader, chatId, eventIndexes, threadRootMessageIndex, latestKnownUpdate);
    }

    chatEventsWindow(
        chatId: ChatIdentifier,
        eventIndexRange: IndexRange,
        messageIndex: number,
        threadRootMessageIndex: number | undefined,
        latestKnownUpdate: bigint | undefined,
        maxEvents: number = MAX_EVENTS
    ): Promise<EventsResponse<ChatEvent>> {
        const reader = this.eventsReader(chatId.kind);
        return this.chatEventsWindowViaCache(reader, chatId, eventIndexRange, messageIndex, threadRootMessageIndex, latestKnownUpdate, maxEvents);
    }

    messagesByMessageIndex(
        chatId: ChatIdentifier,
        threadRootMessageIndex: number | undefined,
        messageIndexes: number[],
        latestKnownUpdate: bigint | undefined
    ): Promise<EventsResponse<Message>> {
        const reader = this.eventsReader(chatId.kind);
        return this.messagesByMessageIndexViaCache(reader, chatId, threadRootMessageIndex, messageIndexes, latestKnownUpdate);
    }

    private async chatEventsViaCache(
        reader: IChatEventsReader,
        chatId: ChatIdentifier,
        eventIndexRange: IndexRange,
        startIndex: number,
        ascending: boolean,
        threadRootMessageIndex: number | undefined,
        latestKnownUpdate: bigint | undefined,
        maxEvents: number,
    ): Promise<EventsResponse<ChatEvent>> {
        const [cachedEvents, missing] = await getCachedEvents(
            this.db,
            eventIndexRange,
            { chatId, threadRootMessageIndex },
            startIndex,
            ascending,
        );

        // we may or may not have all the requested events
        if (missing.size >= MAX_MISSING) {
            // if we have exceeded the maximum number of missing events, let's just consider it a complete miss and go to the api
            console.log("We didn't get enough back from the cache, going to the api");
            return reader.chatEvents(
                chatId,
                startIndex,
                ascending,
                threadRootMessageIndex,
                latestKnownUpdate,
                maxEvents
            )
                .then((resp) => {
                    setCachedEvents(this.db, chatId, resp, threadRootMessageIndex);
                    return resp;
                })
                .catch((err) => {
                    if (err instanceof ResponseTooLargeError) {
                        console.log(
                            "Response size too large, we will try to split the payload into a a few chunks",
                        );
                        return chunkedChatEventsFromBackend(
                            (index: number, chunkSize: number) =>
                                reader.chatEvents(
                                    chatId,
                                    index,
                                    ascending,
                                    threadRootMessageIndex,
                                    latestKnownUpdate,
                                    chunkSize,
                                ),
                            eventIndexRange,
                            startIndex,
                            ascending,
                        ).then((resp) => {
                            setCachedEvents(this.db, chatId, resp, threadRootMessageIndex);
                            return resp;
                        });
                    } else {
                        throw err;
                    }
                });
        } else {
            return this.handleMissingEvents(
                reader,
                chatId,
                [cachedEvents, missing],
                threadRootMessageIndex,
                latestKnownUpdate,
            );
        }
    }

    private chatEventsByIndexViaCache(
        reader: IChatEventsReader,
        chatId: ChatIdentifier,
        eventIndexes: number[],
        threadRootMessageIndex: number | undefined,
        latestKnownUpdate: bigint | undefined,
    ): Promise<EventsResponse<ChatEvent>>
    {
        return getCachedEventsByIndex(this.db, eventIndexes, { chatId, threadRootMessageIndex }).then(
            (res) =>
                this.handleMissingEvents(reader, chatId, res, threadRootMessageIndex, latestKnownUpdate),
        );
    }

    private async chatEventsWindowViaCache(
        reader: IChatEventsReader,
        chatId: ChatIdentifier,
        eventIndexRange: IndexRange,
        messageIndex: number,
        threadRootMessageIndex: number | undefined,
        latestKnownUpdate: bigint | undefined,
        maxEvents: number,
    ): Promise<EventsResponse<ChatEvent>>
    {
        const [cachedEvents, missing, totalMiss] = await getCachedEventsWindowByMessageIndex(
            this.db,
            eventIndexRange,
            { chatId, threadRootMessageIndex },
            messageIndex,
        );
        if (totalMiss || missing.size >= MAX_MISSING) {
            // if we have exceeded the maximum number of missing events, let's just consider it a complete miss and go to the api
            console.log(
                "We didn't get enough back from the cache, going to the api",
                missing.size,
                totalMiss,
            );
            return reader.chatEventsWindow(
                chatId,
                messageIndex,
                threadRootMessageIndex,
                latestKnownUpdate,
                maxEvents,
            )
                .then((resp) => {
                    setCachedEvents(this.db, chatId, resp, threadRootMessageIndex);
                    return resp;
                })
                .catch((err) => {
                    if (err instanceof ResponseTooLargeError) {
                        console.log(
                            "Response size too large, we will try to split the window request into a a few chunks",
                        );
                        return chunkedChatEventsWindowFromBackend(
                            (index: number, ascending: boolean, chunkSize: number) =>
                                reader.chatEvents(
                                    chatId,
                                    index,
                                    ascending,
                                    threadRootMessageIndex,
                                    latestKnownUpdate,
                                    chunkSize,
                                ),
                            (index: number, chunkSize: number) =>
                                reader.chatEventsWindow(
                                    chatId,
                                    index,
                                    threadRootMessageIndex,
                                    latestKnownUpdate,
                                    chunkSize,
                                ),
                            eventIndexRange,
                            messageIndex,
                        ).then((resp) => {
                            setCachedEvents(this.db, chatId, resp, threadRootMessageIndex);
                            return resp;
                        });
                    } else {
                        throw err;
                    }
                });
        } else {
            return this.handleMissingEvents(
                reader,
                chatId,
                [cachedEvents, missing],
                threadRootMessageIndex,
                latestKnownUpdate,
            );
        }
    }

    private async messagesByMessageIndexViaCache(
        reader: IChatEventsReader,
        chatId: ChatIdentifier,
        threadRootMessageIndex: number | undefined,
        messageIndexes: number[],
        latestKnownUpdate: bigint | undefined,
    ): Promise<EventsResponse<Message>>
    {
        const fromCache = await loadMessagesByMessageIndex(
            this.db,
            chatId,
            threadRootMessageIndex,
            messageIndexes,
        );
        if (fromCache.missing.size > 0) {
            console.log("Missing idxs from the cached: ", fromCache.missing);

            const resp = await reader.messagesByMessageIndex(
                chatId,
                threadRootMessageIndex,
                [...fromCache.missing],
                latestKnownUpdate,
            ).then((resp) => {
                setCachedEvents(this.db, chatId, resp, threadRootMessageIndex);
                return resp;
            });

            return isSuccessfulEventsResponse(resp)
                ? {
                    events: [...fromCache.messageEvents, ...resp.events],
                    expiredEventRanges: [],
                    expiredMessageRanges: [],
                    latestEventIndex: resp.latestEventIndex,
                }
                : resp;
        }
        return {
            events: fromCache.messageEvents,
            expiredEventRanges: [],
            expiredMessageRanges: [],
            latestEventIndex: undefined,
        };
    }

    private async handleMissingEvents(
        reader: IChatEventsReader,
        chatId: ChatIdentifier,
        [cachedEvents, missing]: [EventsSuccessResult<ChatEvent>, Set<number>],
        threadRootMessageIndex: number | undefined,
        latestKnownUpdate: bigint | undefined,
    ): Promise<EventsResponse<ChatEvent>> {
        if (missing.size === 0 || offline()) {
            return Promise.resolve(cachedEvents);
        } else {
            return reader.chatEventsByIndex(
                chatId,
                [...missing],
                threadRootMessageIndex,
                latestKnownUpdate,
            )
                .then((resp) => {
                    setCachedEvents(this.db, chatId, resp, threadRootMessageIndex);

                    if (isSuccessfulEventsResponse(resp)) {
                        return mergeSuccessResponses(cachedEvents, resp);
                    }
                    return resp;
                });
        }
    }

    private eventsReader(kind: ChatIdentifier["kind"]): IChatEventsReader {
        switch (kind) {
            case "direct_chat": return this.userClient;
            case "group_chat": return this.groupClient;
            case "channel": return this.communityClient;
        }
    }
}
