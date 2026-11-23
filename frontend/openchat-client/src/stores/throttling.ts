import { get, writable } from "svelte/store";

const localStorageKey = "openchat_most_recent_sent_message_times";

// The throttle counts the messages sent in the last minute, across every chat
const WINDOW_MS = 60_000;

export const throttleDeadline = writable<number>(0);

export const mostRecentStore = writable<number[]>([]);

/**
 * Whether a send now is throttled. Only a send that's allowed counts towards the throttle: one
 * refused doesn't, or a user (or the offline queue) trying again while throttled would keep
 * themselves throttled (#10595).
 */
export function shouldThrottle(diamond: boolean): boolean {
    let throttled = false;
    mostRecentStore.update((val) => {
        const attempt = trySend(Date.now(), diamond, val);
        localStorage.setItem(localStorageKey, JSON.stringify(attempt.times));
        throttleDeadline.set(attempt.allowed ? 0 : attempt.nextAllowedAt);
        throttled = !attempt.allowed;
        return attempt.times;
    });
    return throttled;
}

export function initialiseMostRecentSentMessageTimes(diamond: boolean) {
    const val = localStorage.getItem(localStorageKey);
    if (!val) return;
    const times = JSON.parse(val) as number[];
    const now = Date.now();
    const withinLastMinute = timesInWindow(now, times);
    const nextAllowedAt = nextSendAllowedAt(now, diamond, withinLastMinute);
    // as it always has (`checkTimes` did this before #10599): a reload while throttled still is
    throttleDeadline.set(nextAllowedAt > now ? nextAllowedAt : 0);
    mostRecentStore.set(withinLastMinute);
}

/** The send times (`times`, as `mostRecentStore` holds them) still counted at `now`: the last minute's. */
export function timesInWindow(now: number, times: readonly number[]): number[] {
    const oneMinuteAgo = now - WINDOW_MS;
    return times.filter((t) => t >= oneMinuteAgo);
}

/**
 * When the next send is allowed: `now` if one is now, otherwise the moment enough of the last
 * minute's sends (`times`) have left the window to leave room for one more.
 */
export function nextSendAllowedAt(now: number, diamond: boolean, times: readonly number[]): number {
    const within = timesInWindow(now, times).sort((a, b) => a - b);
    const max = getMaxMessagesPerMinute(diamond);
    if (within.length < max) return now;
    // a time is in the window up to a minute after it, inclusive
    return within[within.length - max] + WINDOW_MS + 1;
}

/**
 * A send tried at `now`, with `times` sent before it: allowed if the minute's limit leaves room.
 * The window's times after it (`times`) include it only if it was allowed; refused, it says when
 * the next send is (`nextAllowedAt`).
 */
export function trySend(
    now: number,
    diamond: boolean,
    times: readonly number[],
): { allowed: boolean; times: number[]; nextAllowedAt: number } {
    const within = timesInWindow(now, times);
    const nextAllowedAt = nextSendAllowedAt(now, diamond, within);
    const allowed = nextAllowedAt <= now;
    return { allowed, times: allowed ? [...within, now] : within, nextAllowedAt };
}

/**
 * How many more messages can be sent now without being throttled: what the limit allows in a
 * minute, less those sent in the last minute (`times`, as `mostRecentStore` holds them).
 */
export function sendsLeft(now: number, diamond: boolean, times: readonly number[]): number {
    return Math.max(0, getMaxMessagesPerMinute(diamond) - timesInWindow(now, times).length);
}

/** How many more messages can be sent now without being throttled. */
export function sendsLeftNow(diamond: boolean): number {
    return sendsLeft(Date.now(), diamond, get(mostRecentStore));
}

/** How long until the throttle allows the next send, in ms: 0 if it does now. */
export function msUntilNextSendAllowed(diamond: boolean): number {
    const now = Date.now();
    return Math.max(0, nextSendAllowedAt(now, diamond, get(mostRecentStore)) - now);
}

export function getMaxMessagesPerMinute(diamond: boolean): number {
    return diamond ? 20 : 10;
}
