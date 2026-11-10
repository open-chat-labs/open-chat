import { get, writable } from "svelte/store";

const localStorageKey = "openchat_most_recent_sent_message_times";

export const throttleDeadline = writable<number>(0);

export const mostRecentStore = writable<number[]>([]);

export function shouldThrottle(diamond: boolean): boolean {
    let throttled = false;
    mostRecentStore.update((val) => {
        const now = Date.now();
        const [withinLastMinute, isThrottled] = checkTimes(now, diamond, val);
        withinLastMinute.push(Date.now());
        localStorage.setItem(localStorageKey, JSON.stringify(withinLastMinute));
        throttled = isThrottled;
        return withinLastMinute;
    });
    return throttled;
}

export function initialiseMostRecentSentMessageTimes(diamond: boolean) {
    const val = localStorage.getItem(localStorageKey);
    if (!val) return;
    const times = JSON.parse(val) as number[];
    const now = Date.now();
    const [withinLastMinute] = checkTimes(now, diamond, times);
    mostRecentStore.set(withinLastMinute);
}

/**
 * How many more messages can be sent now without being throttled: what the limit allows in a
 * minute, less those sent in the last minute (`times`, as `mostRecentStore` holds them).
 */
export function sendsLeft(now: number, diamond: boolean, times: readonly number[]): number {
    const oneMinuteAgo = now - 60000;
    const sent = times.filter((t) => t >= oneMinuteAgo).length;
    return Math.max(0, getMaxMessagesPerMinute(diamond) - sent);
}

/** How many more messages can be sent now without being throttled. */
export function sendsLeftNow(diamond: boolean): number {
    return sendsLeft(Date.now(), diamond, get(mostRecentStore));
}

export function getMaxMessagesPerMinute(diamond: boolean): number {
    return diamond ? 20 : 10;
}

function checkTimes(now: number, diamond: boolean, times: number[]): [number[], boolean] {
    const oneMinuteAgo = now - 60000;
    const maxMessagesPerMinute = getMaxMessagesPerMinute(diamond);
    const withinLastMinute = times.filter((t) => t >= oneMinuteAgo);
    const throttled = withinLastMinute.length >= maxMessagesPerMinute;
    if (throttled) {
        const timeToWait = withinLastMinute[0] - oneMinuteAgo;
        throttleDeadline.set(now + timeToWait);
    } else {
        throttleDeadline.set(0);
    }
    return [withinLastMinute, throttled];
}
