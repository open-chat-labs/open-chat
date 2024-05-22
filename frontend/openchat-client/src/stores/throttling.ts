import { writable } from "svelte/store";

const localStorageKey = "openchat_most_recent_sent_message_times";

const countdown = writable<number>(0);
export const throttleCountdown = {
    subscribe: countdown.subscribe,
    set: (n: number) => {
        countdown.set(n);
        if (n > 0) {
            const i = window.setInterval(() => {
                countdown.update((n) => {
                    if (n > 0) {
                        return n - 100;
                    }
                    window.clearInterval(i);
                    return 0;
                });
            }, 100);
        }
    },
};

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
    if (!val) return [];
    const times = JSON.parse(val) as number[];
    const now = Date.now();
    const [withinLastMinute] = checkTimes(now, diamond, times);
    mostRecentStore.set(withinLastMinute);
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
        throttleCountdown.set(timeToWait);
    }
    return [withinLastMinute, throttled];
}
