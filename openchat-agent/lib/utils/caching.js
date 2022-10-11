import { openDB } from "idb";
import { UnsupportedValueError } from "./error";
import { logger } from "./logger";
const CACHE_VERSION = 47;
const MAX_EVENTS = 150;
function padMessageIndex(i) {
    return i.toString().padStart(10, "0");
}
export function cachingLocallyDisabled() {
    return !!localStorage.getItem("openchat_nocache");
}
export function createCacheKey(chatId, index, threadRootMessageIndex) {
    return threadRootMessageIndex === undefined
        ? `${chatId}_${padMessageIndex(index)}`
        : `${chatId}_${threadRootMessageIndex}_${padMessageIndex(index)}`;
}
export function openCache(principal) {
    if (process.env.NODE_ENV === "test" || !process.env.CLIENT_CACHING) {
        return undefined;
    }
    try {
        return openDB(`openchat_db_${principal}`, CACHE_VERSION, {
            upgrade(db, _oldVersion, _newVersion) {
                try {
                    if (db.objectStoreNames.contains("chat_events")) {
                        db.deleteObjectStore("chat_events");
                    }
                    if (db.objectStoreNames.contains("thread_events")) {
                        db.deleteObjectStore("thread_events");
                    }
                    if (db.objectStoreNames.contains("chats")) {
                        db.deleteObjectStore("chats");
                    }
                    if (db.objectStoreNames.contains("group_details")) {
                        db.deleteObjectStore("group_details");
                    }
                    const chatEvents = db.createObjectStore("chat_events");
                    chatEvents.createIndex("messageIdx", "messageKey");
                    const threadEvents = db.createObjectStore("thread_events");
                    threadEvents.createIndex("messageIdx", "messageKey");
                    db.createObjectStore("chats");
                    db.createObjectStore("group_details");
                    if (!db.objectStoreNames.contains("soft_disabled")) {
                        db.createObjectStore("soft_disabled");
                    }
                }
                catch (err) {
                    logger.error("Unable to upgrade indexDB", err);
                }
            },
        });
    }
    catch (err) {
        logger.error("Unable to open indexDB", err);
    }
}
export async function removeCachedChat(db, userId, chatId) {
    const fromCache = await getCachedChats(db, userId);
    if (fromCache !== undefined) {
        fromCache.chatSummaries = fromCache.chatSummaries.filter((c) => c.chatId !== chatId);
        await setCachedChats(db, userId, fromCache);
    }
}
export async function getCachedChats(db, userId) {
    return await (await db).get("chats", userId);
}
export async function setCachedChats(db, userId, data) {
    if (!data.wasUpdated) {
        return;
    }
    const latestMessages = {};
    // irritating hoop jumping to keep typescript happy here
    const chatSummaries = data.chatSummaries
        .filter((c) => !(c.kind === "group_chat" && c.myRole === "previewer"))
        .map((c) => {
        const latestMessage = c.latestMessage
            ? makeSerialisable(c.latestMessage, c.chatId)
            : undefined;
        if (latestMessage) {
            latestMessages[c.chatId] = Object.assign(Object.assign({}, latestMessage), { chatId: c.chatId, messageKey: createCacheKey(c.chatId, latestMessage.event.messageIndex) });
        }
        if (c.kind === "direct_chat") {
            return Object.assign(Object.assign({}, c), { latestMessage });
        }
        if (c.kind === "group_chat") {
            return Object.assign(Object.assign({}, c), { latestMessage });
        }
        throw new UnsupportedValueError("Unrecognised chat type", c);
    });
    const tx = (await db).transaction(["chats", "chat_events"], "readwrite");
    const chatsStore = tx.objectStore("chats");
    const eventStore = tx.objectStore("chat_events");
    const promises = [
        chatsStore.put({
            wasUpdated: true,
            chatSummaries,
            timestamp: data.timestamp,
            blockedUsers: data.blockedUsers,
            pinnedChats: data.pinnedChats,
            avatarIdUpdate: undefined,
            affectedEvents: {},
        }, userId),
        ...Object.entries(latestMessages).flatMap(([chatId, message]) => [
            eventStore.put(message, createCacheKey(chatId, message.index)),
        ]),
        ...Object.entries(data.affectedEvents)
            .flatMap(([chatId, indexes]) => indexes.map((i) => createCacheKey(chatId, i)))
            .map((key) => eventStore.delete(key)),
    ];
    await Promise.all(promises);
    await tx.done;
}
export async function getCachedEventsWindow(db, eventIndexRange, chatId, messageIndex) {
    console.log("cache: window: ", eventIndexRange, messageIndex);
    const start = Date.now();
    const [events, missing, totalMiss] = await aggregateEventsWindow(db, eventIndexRange, chatId, messageIndex);
    if (!totalMiss && missing.size === 0) {
        console.log("cache hit: ", events.length, Date.now() - start);
    }
    events.sort((a, b) => a.index - b.index);
    return [{ events, affectedEvents: [], latestEventIndex: undefined }, missing, totalMiss];
}
async function aggregateEventsWindow(db, [min, max], chatId, middleMessageIndex) {
    const events = [];
    const resolvedDb = await db;
    const missing = new Set();
    const middleEvent = await resolvedDb.getFromIndex("chat_events", "messageIdx", createCacheKey(chatId, middleMessageIndex));
    const midpoint = middleEvent === null || middleEvent === void 0 ? void 0 : middleEvent.index;
    if (midpoint === undefined) {
        console.log("cache total miss: could not even find the starting event index for the message window");
        return [[], missing, true];
    }
    const half = MAX_EVENTS / 2;
    const lowerBound = Math.max(min, midpoint - half);
    const upperBound = Math.min(max, midpoint + half);
    console.log("aggregate events window: events from ", lowerBound, " to ", upperBound);
    const range = IDBKeyRange.bound(createCacheKey(chatId, lowerBound), createCacheKey(chatId, upperBound));
    for (let i = lowerBound; i <= upperBound; i++) {
        missing.add(i);
    }
    const result = await resolvedDb.getAll("chat_events", range);
    result.forEach((evt) => {
        missing.delete(evt.index);
        events.push(evt);
    });
    console.log("aggregate events window: missing indexes: ", missing);
    return [events, missing, false];
}
async function aggregateEvents(db, [min, max], chatId, startIndex, ascending, threadRootMessageIndex) {
    const events = [];
    const resolvedDb = await db;
    const missing = new Set();
    const lowerBound = ascending ? startIndex : Math.max(min, startIndex - MAX_EVENTS);
    const upperBound = ascending ? Math.min(max, startIndex + MAX_EVENTS) : startIndex;
    const range = IDBKeyRange.bound(createCacheKey(chatId, lowerBound, threadRootMessageIndex), createCacheKey(chatId, upperBound, threadRootMessageIndex));
    for (let i = lowerBound; i <= upperBound; i++) {
        missing.add(i);
    }
    const store = threadRootMessageIndex === undefined ? "chat_events" : "thread_events";
    const result = await resolvedDb.getAll(store, range);
    result.forEach((evt) => {
        missing.delete(evt.index);
        events.push(evt);
    });
    console.log("aggregate events: missing indexes: ", missing);
    return [events, missing];
}
export async function getCachedMessageByIndex(db, eventIndex, chatId, threadRootMessageIndex) {
    const key = createCacheKey(chatId, eventIndex, threadRootMessageIndex);
    const store = threadRootMessageIndex !== undefined ? "thread_events" : "chat_events";
    return (await db).get(store, key);
}
export async function getCachedEventsByIndex(db, eventIndexes, chatId, threadRootMessageIndex) {
    const missing = new Set();
    const returnedEvents = await Promise.all(eventIndexes.map((idx) => {
        return getCachedMessageByIndex(db, idx, chatId, threadRootMessageIndex).then((evt) => {
            if (evt === undefined) {
                missing.add(idx);
            }
            return evt;
        });
    }));
    const events = returnedEvents.filter((evt) => evt !== undefined);
    return [{ events, affectedEvents: [], latestEventIndex: undefined }, missing];
}
export async function getCachedEvents(db, eventIndexRange, chatId, startIndex, ascending, threadRootMessageIndex) {
    console.log("cache: ", eventIndexRange, startIndex, ascending);
    const start = Date.now();
    const [events, missing] = await aggregateEvents(db, eventIndexRange, chatId, startIndex, ascending, threadRootMessageIndex);
    if (missing.size === 0) {
        console.log("cache hit: ", events.length, Date.now() - start);
    }
    else {
        console.log("cache miss: ", missing);
    }
    return [{ events, affectedEvents: [], latestEventIndex: undefined }, missing];
}
export function mergeSuccessResponses(a, b) {
    var _a, _b;
    return {
        events: [...a.events, ...b.events].sort((a, b) => a.index - b.index),
        affectedEvents: [...a.affectedEvents, ...b.affectedEvents],
        latestEventIndex: a.latestEventIndex === undefined && b.latestEventIndex === undefined
            ? undefined
            : Math.max((_a = a.latestEventIndex) !== null && _a !== void 0 ? _a : -1, (_b = b.latestEventIndex) !== null && _b !== void 0 ? _b : -1),
    };
}
// we need to strip out the blobData promise from any media content because that cannot be serialised
function makeSerialisable(ev, chatId, threadRootMessageIndex) {
    if (ev.event.kind !== "message")
        return Object.assign(Object.assign({}, ev), { chatId, messageKey: undefined });
    return Object.assign(Object.assign({}, ev), { chatId, messageKey: createCacheKey(chatId, ev.event.messageIndex, threadRootMessageIndex), event: Object.assign(Object.assign({}, ev.event), { content: removeBlobData(ev.event.content), repliesTo: removeReplyContent(ev.event.repliesTo, chatId) }) });
}
function removeBlobData(content) {
    if ("blobData" in content) {
        return Object.assign(Object.assign({}, content), { blobData: undefined });
    }
    return content;
}
function removeReplyContent(repliesTo, chatId) {
    if ((repliesTo === null || repliesTo === void 0 ? void 0 : repliesTo.kind) === "rehydrated_reply_context") {
        return {
            kind: "raw_reply_context",
            chatIdIfOther: repliesTo.chatId === chatId ? undefined : repliesTo.chatId,
            eventIndex: repliesTo.eventIndex,
        };
    }
    return repliesTo;
}
export async function setCachedEvents(db, chatId, resp, threadRootMessageIndex) {
    if (resp === "events_failed")
        return;
    const store = threadRootMessageIndex !== undefined ? "thread_events" : "chat_events";
    const tx = (await db).transaction([store], "readwrite", {
        durability: "relaxed",
    });
    const eventStore = tx.objectStore(store);
    await Promise.all(resp.events.concat(resp.affectedEvents).map(async (event) => {
        await eventStore.put(makeSerialisable(event, chatId), createCacheKey(chatId, event.index, threadRootMessageIndex));
    }));
    await tx.done;
}
export function setCachedMessageFromSendResponse(db, chatId, threadRootMessageIndex) {
    return ([resp, message]) => {
        if (resp.kind !== "success")
            return [resp, message];
        const event = messageToEvent(message, resp);
        setCachedMessageIfNotExists(db, chatId, event, threadRootMessageIndex).catch((err) => logger.error("Unable to write message to cache: ", err));
        return [resp, message];
    };
}
export function setCachedMessageFromNotification(chatId, threadRootMessageIndex, message) {
    if (!process.env.CLIENT_CACHING)
        return;
    if (db === undefined) {
        throw new Error("Unable to open indexDB, cannot set message from notification");
    }
    setCachedMessageIfNotExists(db, chatId, message, threadRootMessageIndex).catch((err) => logger.error("Unable to write notification message to the cache", err));
}
async function setCachedMessageIfNotExists(db, chatId, messageEvent, threadRootMessageIndex) {
    const key = createCacheKey(chatId, messageEvent.index, threadRootMessageIndex);
    const store = threadRootMessageIndex !== undefined ? "thread_events" : "chat_events";
    const tx = (await db).transaction([store], "readwrite", {
        durability: "relaxed",
    });
    const eventStore = tx.objectStore(store);
    if ((await eventStore.count(key)) === 0) {
        await eventStore.add(makeSerialisable(messageEvent, chatId), key);
    }
    await tx.done;
}
function messageToEvent(message, resp) {
    return {
        event: Object.assign(Object.assign({}, message), { messageIndex: resp.messageIndex }),
        index: resp.eventIndex,
        timestamp: resp.timestamp,
    };
}
export async function getCachedGroupDetails(db, chatId) {
    return (await db).get("group_details", chatId);
}
export async function setCachedGroupDetails(db, chatId, groupDetails) {
    await (await db).put("group_details", groupDetails, chatId);
}
export async function storeSoftDisabled(value) {
    if (db !== undefined) {
        await (await db).put("soft_disabled", value, "soft_disabled");
    }
}
export async function getSoftDisabled() {
    if (db !== undefined) {
        const res = await (await db).get("soft_disabled", "soft_disabled");
        return res !== null && res !== void 0 ? res : false;
    }
    return false;
}
let db;
export function getDb() {
    return db;
}
export function initDb(principal) {
    db = openCache(principal);
    return db;
}
export function closeDb() {
    db = undefined;
}
// for now this is only used for loading pinned messages so we can ignore the idea of
// thread root message index, but it might come up later
export async function loadMessagesByMessageIndex(db, chatId, messagesIndexes) {
    const resolvedDb = await db;
    const missing = new Set();
    const messages = [];
    await Promise.all([...messagesIndexes].map(async (msgIdx) => {
        const evt = await resolvedDb.getFromIndex("chat_events", "messageIdx", createCacheKey(chatId, msgIdx));
        if ((evt === null || evt === void 0 ? void 0 : evt.event.kind) === "message") {
            messages.push(evt);
            return evt.event;
        }
        missing.add(msgIdx);
        return undefined;
    }));
    return {
        messageEvents: messages,
        missing,
    };
}
//# sourceMappingURL=caching.js.map