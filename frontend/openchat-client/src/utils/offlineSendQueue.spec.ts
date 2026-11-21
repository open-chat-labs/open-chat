import { CommonResponses, type MessageContext } from "@shared";
import { writable } from "./stores";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
    canQueueMessage,
    isTransportError,
    OfflineSendQueue,
    QUEUE_RETRY_DELAYS_MS,
    sendFailureCause,
    sendOrder,
    type QueuedSend,
    type ResendOutcome,
} from "./offlineSendQueue";

const chatA: MessageContext = { chatId: { kind: "group_chat", groupId: "a" } };
const chatB: MessageContext = { chatId: { kind: "group_chat", groupId: "b" } };
const threadA: MessageContext = { ...chatA, threadRootMessageIndex: 3 };

function q(context: MessageContext, messageId: number, timestamp: number): QueuedSend {
    return { context, messageId: BigInt(messageId), timestamp: BigInt(timestamp) };
}

describe("why a send failed", () => {
    test("the agent's offline response is no connectivity", () => {
        const failure = { kind: "response", response: CommonResponses.offline() } as const;
        expect(sendFailureCause(failure, false)).toBe("connectivity");
        expect(sendFailureCause(failure, true)).toBe("connectivity");
    });

    test("an answer from the backend is a backend failure, offline now or not", () => {
        const failure = {
            kind: "response",
            response: { kind: "error", code: 12, message: undefined },
        } as const;
        expect(sendFailureCause(failure, false)).toBe("backend");
        expect(sendFailureCause(failure, true)).toBe("backend");
    });

    test("anything thrown while offline is no connectivity", () => {
        const error = { name: "HttpError", message: "Request timed out after 300000 msec" };
        expect(sendFailureCause({ kind: "thrown", error }, true)).toBe("connectivity");
    });

    test("a request that got no response, while still online, is no connectivity", () => {
        const error = {
            name: "HttpError",
            message: "Failed to fetch HTTP request: TypeError: Failed to fetch",
        };
        expect(sendFailureCause({ kind: "thrown", error }, false)).toBe("connectivity");
    });

    test("a rejection, an HTTP error or a timeout while online is a backend failure", () => {
        for (const message of [
            "Call was rejected: Reject code: 5, IC0503 Canister trapped",
            "Server returned an error: Code: 503 (Service Unavailable)",
            "Timeout waiting for response",
        ]) {
            const error = { name: "HttpError", message };
            expect(sendFailureCause({ kind: "thrown", error }, false)).toBe("backend");
        }
    });

    test("transport failures in each browser's words", () => {
        expect(isTransportError(new TypeError("Failed to fetch"))).toBe(true);
        expect(
            isTransportError(new TypeError("NetworkError when attempting to fetch resource.")),
        ).toBe(true);
        expect(isTransportError(new TypeError("Load failed"))).toBe(true);
        expect(isTransportError("Failed to fetch")).toBe(false);
        expect(isTransportError(undefined)).toBe(false);
        expect(isTransportError({ message: "IC0503" })).toBe(false);
    });
});

describe("what can wait for the connection", () => {
    test("text and attachments, which upload as part of the send", () => {
        expect(canQueueMessage({ kind: "text_content", text: "hi" })).toBe(true);
        expect(
            canQueueMessage({
                kind: "image_content",
                height: 1,
                width: 1,
                mimeType: "image/png",
                thumbnailData: "",
                blobUrl: undefined,
                blobReference: undefined,
                blobData: undefined,
                caption: undefined,
            }),
        ).toBe(true);
    });

    test("not what the network builds or signs, nor a poll", () => {
        for (const kind of [
            "crypto_content",
            "prize_content_initial",
            "p2p_swap_content_initial",
            "poll_content",
        ] as const) {
            expect(canQueueMessage({ kind } as Parameters<typeof canQueueMessage>[0])).toBe(false);
        }
    });
});

describe("the order queued messages go in", () => {
    test("each chat's oldest first, the chats by their oldest", () => {
        const order = sendOrder([
            q(chatB, 4, 40),
            q(chatA, 2, 20),
            q(chatB, 1, 10),
            q(chatA, 3, 30),
        ]);
        expect(order.map((list) => list.map((x) => Number(x.messageId)))).toEqual([
            [1, 4],
            [2, 3],
        ]);
    });

    test("a thread is a chat of its own", () => {
        const order = sendOrder([q(chatA, 1, 10), q(threadA, 2, 20)]);
        expect(order).toHaveLength(2);
    });
});

describe("the queue", () => {
    let offline: ReturnType<typeof writable<boolean>>;
    let queued: QueuedSend[];
    let resend: ReturnType<typeof vi.fn<(q: QueuedSend) => Promise<ResendOutcome>>>;
    let queue: OfflineSendQueue;

    function make() {
        queue = new OfflineSendQueue({
            queued: () => queued,
            resend,
            offline,
            setTimeout: (fn, ms) => setTimeout(fn, ms),
            clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
        });
    }

    // each resend takes the message off the queue, as the client's does when it goes
    function sends(): ReturnType<typeof vi.fn<(q: QueuedSend) => Promise<ResendOutcome>>> {
        return vi.fn(async (x: QueuedSend) => {
            queued = queued.filter((y) => y !== x);
            return "sent" as ResendOutcome;
        });
    }

    beforeEach(() => {
        vi.useFakeTimers();
        offline = writable(true);
        queued = [];
        resend = sends();
        make();
    });

    afterEach(() => {
        queue.stop();
        vi.useRealTimers();
    });

    test("nothing goes while offline", async () => {
        queued = [q(chatA, 1, 10)];
        queue.start();
        await vi.runAllTimersAsync();
        expect(resend).not.toHaveBeenCalled();
    });

    test("started online, it sends what's queued (a reload while queued)", async () => {
        offline.set(false);
        queued = [q(chatA, 1, 10)];
        queue.start();
        await vi.runAllTimersAsync();
        expect(resend).toHaveBeenCalledTimes(1);
    });

    test("back online, each chat's messages go once, oldest first, one at a time", async () => {
        const a1 = q(chatA, 1, 10);
        const a2 = q(chatA, 2, 20);
        const b1 = q(chatB, 3, 15);
        queued = [a2, b1, a1];
        const inFlight: string[] = [];
        let releaseA1: () => void = () => {};
        resend = vi.fn((x: QueuedSend) => {
            inFlight.push(String(x.messageId));
            queued = queued.filter((y) => y !== x);
            if (x === a1) {
                return new Promise<ResendOutcome>((resolve) => {
                    releaseA1 = () => resolve("sent");
                });
            }
            return Promise.resolve<ResendOutcome>("sent");
        });
        make();
        queue.start();
        offline.set(false);
        await vi.advanceTimersByTimeAsync(0);
        // a2 waits for a1; chat B goes alongside
        expect(inFlight).toEqual(["1", "3"]);
        releaseA1();
        await vi.runAllTimersAsync();
        expect(inFlight).toEqual(["1", "3", "2"]);
    });

    test("one queued again holds back the rest of its chat, and is tried again after a while", async () => {
        const a1 = q(chatA, 1, 10);
        const a2 = q(chatA, 2, 20);
        queued = [a1, a2];
        let attempts = 0;
        resend = vi.fn(async (x: QueuedSend) => {
            attempts++;
            if (attempts === 1) return "queued" as ResendOutcome;
            queued = queued.filter((y) => y !== x);
            return "sent" as ResendOutcome;
        });
        make();
        offline.set(false);
        queue.start();
        await vi.advanceTimersByTimeAsync(0);
        expect(resend).toHaveBeenCalledTimes(1);
        await vi.advanceTimersByTimeAsync(QUEUE_RETRY_DELAYS_MS[0]);
        expect(resend.mock.calls.map(([x]) => Number(x.messageId))).toEqual([1, 1, 2]);
    });

    test("a message queued while the app says it's online is tried again after a while", async () => {
        offline.set(false);
        queue.start();
        await vi.advanceTimersByTimeAsync(0);
        queued = [q(chatA, 1, 10)];
        queue.queued();
        await vi.advanceTimersByTimeAsync(QUEUE_RETRY_DELAYS_MS[0] - 1);
        expect(resend).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(1);
        expect(resend).toHaveBeenCalledTimes(1);
    });

    test("going offline cancels the wait; coming back sends at once", async () => {
        offline.set(false);
        queue.start();
        queued = [q(chatA, 1, 10)];
        queue.queued();
        offline.set(true);
        await vi.advanceTimersByTimeAsync(QUEUE_RETRY_DELAYS_MS[0] * 2);
        expect(resend).not.toHaveBeenCalled();
        offline.set(false);
        await vi.advanceTimersByTimeAsync(0);
        expect(resend).toHaveBeenCalledTimes(1);
    });

    test("stopped (logout), nothing more goes", async () => {
        queue.start();
        queue.stop();
        queued = [q(chatA, 1, 10)];
        offline.set(false);
        await vi.runAllTimersAsync();
        expect(resend).not.toHaveBeenCalled();
    });

    test("a resend that throws stays queued, not lost", async () => {
        queued = [q(chatA, 1, 10)];
        resend = vi.fn(async () => {
            throw new Error("boom");
        });
        make();
        offline.set(false);
        queue.start();
        await vi.advanceTimersByTimeAsync(0);
        expect(queued).toHaveLength(1);
    });
});
