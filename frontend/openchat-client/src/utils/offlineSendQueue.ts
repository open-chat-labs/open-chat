import {
    canRetryMessage,
    messageContextToString,
    type MessageContent,
    type MessageContext,
    type SendMessageResponse,
} from "@shared";
import type { Readable } from "svelte/store";

// Messages sent without a connection wait to be sent until the app is back online, rather than
// failing (#10591). Only the new UIs queue them (`OpenChatConfig.queueOfflineSends`): the old ones
// show a failed message with Retry, as they always have.

/**
 * Why a send failed. `connectivity`: the message never reached OpenChat, because the device had
 * no connection; it is queued and sent once the app is back online, with no Retry. `backend`: it
 * got there and was refused, or the call failed while online; it is failed, with Retry.
 */
export type SendFailureCause = "connectivity" | "backend";

/** How a send ended without succeeding: what came back, or what was thrown. */
export type SendFailure =
    | { kind: "response"; response: SendMessageResponse }
    | { kind: "thrown"; error: unknown };

// What a request which never got a response looks like once it has crossed the worker: the
// agent's `HttpFetchErrorCode` ("Failed to fetch HTTP request: …", wrapped in an `HttpError`), or
// the browser's own fetch `TypeError` from an upload ("Failed to fetch" in Chromium, "NetworkError
// when attempting to fetch resource" in Firefox, "Load failed" in Safari).
const TRANSPORT_FAILURES = [
    "Failed to fetch",
    "NetworkError when attempting to fetch resource",
    "Load failed",
    "Network request failed",
];

/** Whether a thrown error is a request that never got a response, a transport failure. */
export function isTransportError(error: unknown): boolean {
    if (error === null || typeof error !== "object") return false;
    const message = (error as { message?: unknown }).message;
    return typeof message === "string" && TRANSPORT_FAILURES.some((text) => message.includes(text));
}

/**
 * Why a send failed: no connectivity, or a backend failure.
 *
 * - The agent's `offline` response: it didn't try, the device being offline (`offline()`, the
 *   browser's `navigator.onLine` or a connection the app's traffic says is unusable).
 * - Anything else that came back is the backend's answer (a refusal, an error code): backend.
 * - A thrown error while the app is offline: connectivity, whatever it was, as the request can't
 *   have got through.
 * - A thrown error while online: connectivity only if the request got no response at all
 *   (`isTransportError`), the connection having dropped before the browser says so. A rejection,
 *   a canister error, an HTTP error status or a timeout waiting for the reply: backend.
 */
export function sendFailureCause(failure: SendFailure, offline: boolean): SendFailureCause {
    if (failure.kind === "response") {
        return failure.response.kind === "offline" ? "connectivity" : "backend";
    }
    return offline || isTransportError(failure.error) ? "connectivity" : "backend";
}

/**
 * Whether a message can wait for the connection to be sent. Not one the network builds or signs
 * (a crypto transfer, a prize, a P2P swap), which mustn't go out later on its own; nor a poll,
 * which can't be retried either (`canRetryMessage`). Those keep today's behaviour.
 */
export function canQueueMessage(content: MessageContent): boolean {
    return canRetryMessage(content);
}

// How many sends of a message in a row may get no response while the app says it's online before
// it shows as failed, with Retry. A request that never gets through while the device is online
// (an upload a firewall or an extension blocks, say) would otherwise go again every minute for
// ever, with no Retry. A real offline spell doesn't count: the queue waits for that as long as it
// lasts.
export const MAX_ONLINE_TRANSPORT_FAILURES = 3;

/**
 * Whether a message that couldn't be sent for want of a connection stays queued: always while
 * the app is offline; while it says it's online, until its sends have got no response
 * `MAX_ONLINE_TRANSPORT_FAILURES` times in a row (`onlineTransportFailures`, this one included).
 */
export function staysQueued(offline: boolean, onlineTransportFailures: number): boolean {
    return offline || onlineTransportFailures < MAX_ONLINE_TRANSPORT_FAILURES;
}

/** A queued message: where it is, which it is, and when it was written (the order it's sent in). */
export type QueuedSend = {
    context: MessageContext;
    messageId: bigint;
    timestamp: bigint;
};

/** `sent`: it went (or failed for a backend reason, now shown failed). `queued`: no connection yet. */
export type ResendOutcome = "sent" | "queued";

/**
 * The queued messages of each chat (or thread) in the order they were written, the chats in the
 * order of their oldest message.
 */
export function sendOrder(queued: QueuedSend[]): QueuedSend[][] {
    const byContext = new Map<string, QueuedSend[]>();
    for (const q of queued) {
        const key = messageContextToString(q.context);
        const list = byContext.get(key) ?? [];
        list.push(q);
        byContext.set(key, list);
    }
    const lists = [...byContext.values()].map((list) =>
        [...list].sort((a, b) =>
            a.timestamp < b.timestamp ? -1 : a.timestamp > b.timestamp ? 1 : 0,
        ),
    );
    return lists.sort((a, b) =>
        a[0].timestamp < b[0].timestamp ? -1 : a[0].timestamp > b[0].timestamp ? 1 : 0,
    );
}

// The waits before trying the queue again when a message was queued while the app said it was
// online (a request that got no response): the app may never see itself go offline and back. The
// last repeats.
export const QUEUE_RETRY_DELAYS_MS = [5_000, 10_000, 30_000, 60_000];

export type OfflineSendQueueDeps = {
    /** The messages queued now. */
    queued(): QueuedSend[];
    /** Sends a queued message again. */
    resend(queued: QueuedSend): Promise<ResendOutcome>;
    offline: Readable<boolean>;
    setTimeout(fn: () => void, ms: number): unknown;
    clearTimeout(handle: unknown): void;
};

/**
 * Sends the queued messages once the app is online: when it starts (or the user logs in) online,
 * whenever it comes back online, and, for a message queued while it said it was online, again
 * after a while (`QUEUE_RETRY_DELAYS_MS`). Each chat's messages go one at a time, oldest first;
 * one that's queued again (still no connection) holds back those after it, so they keep their
 * order. Chats go side by side.
 */
export class OfflineSendQueue {
    #deps: OfflineSendQueueDeps;
    #unsubscribe: (() => void) | undefined;
    // stopped (logout): a flush on its way sends nothing more
    #stopped = true;
    #isOffline = false;
    #flushing: Promise<void> | undefined;
    #again = false;
    #retryTimer: unknown;
    #retries = 0;

    constructor(deps: OfflineSendQueueDeps) {
        this.#deps = deps;
    }

    /** Starts watching the connection; sends what's queued if the app is online. */
    start(): void {
        if (this.#unsubscribe !== undefined) return;
        this.#stopped = false;
        let first = true;
        this.#unsubscribe = this.#deps.offline.subscribe((offline) => {
            const cameBack = this.#isOffline && !offline;
            this.#isOffline = offline;
            if (offline) {
                this.#cancelRetry();
            } else if (first || cameBack) {
                this.#retries = 0;
                void this.flush();
            }
        });
        first = false;
    }

    stop(): void {
        this.#stopped = true;
        this.#unsubscribe?.();
        this.#unsubscribe = undefined;
        this.#cancelRetry();
        this.#again = false;
    }

    /**
     * A message has just been queued. While the app says it's online (the request got no response)
     * nothing will say when to try again, so it's tried after a while.
     */
    queued(): void {
        if (this.#unsubscribe !== undefined && !this.#isOffline) this.#scheduleRetry();
    }

    /** Sends each queued message, as `OfflineSendQueue` says. */
    flush(): Promise<void> {
        if (this.#flushing !== undefined) {
            this.#again = true;
            return this.#flushing;
        }
        this.#flushing = this.#flushOnce().finally(() => {
            this.#flushing = undefined;
            if (this.#again && this.#unsubscribe !== undefined && !this.#isOffline) {
                this.#again = false;
                void this.flush();
            }
        });
        return this.#flushing;
    }

    async #flushOnce(): Promise<void> {
        this.#cancelRetry();
        let heldBack = false;
        await Promise.all(
            sendOrder(this.#deps.queued()).map(async (list) => {
                for (const q of list) {
                    if (this.#stopped) return;
                    if (this.#isOffline) {
                        heldBack = true;
                        return;
                    }
                    let outcome: ResendOutcome;
                    try {
                        outcome = await this.#deps.resend(q);
                    } catch (err) {
                        console.warn("OfflineSendQueue: resend threw", err);
                        outcome = "queued";
                    }
                    if (outcome === "queued") {
                        heldBack = true;
                        return;
                    }
                }
            }),
        );
        if (this.#stopped) return;
        if (heldBack && !this.#isOffline) {
            this.#scheduleRetry();
        } else if (!heldBack) {
            this.#retries = 0;
        }
    }

    #scheduleRetry(): void {
        if (this.#retryTimer !== undefined) return;
        const delay =
            QUEUE_RETRY_DELAYS_MS[Math.min(this.#retries, QUEUE_RETRY_DELAYS_MS.length - 1)];
        this.#retries++;
        this.#retryTimer = this.#deps.setTimeout(() => {
            this.#retryTimer = undefined;
            if (this.#unsubscribe !== undefined && !this.#isOffline) void this.flush();
        }, delay);
    }

    #cancelRetry(): void {
        if (this.#retryTimer !== undefined) {
            this.#deps.clearTimeout(this.#retryTimer);
            this.#retryTimer = undefined;
        }
    }
}
