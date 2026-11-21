// The longest a query's retry waits for the browser to come back online before giving up
export const OFFLINE_RETRY_WAIT_MS = 60_000;

type OnlineEvents = Pick<EventTarget, "addEventListener" | "removeEventListener">;

/**
 * Resolves once the browser reports it is online: at once if it already does, otherwise on its
 * `online` event, or after `timeoutMs` if that comes first. Resolves to whether it is online.
 *
 * Only the browser's own report counts, not a connection judged unusable from the app's traffic:
 * that one is only cleared by a request getting through, so waiting on it could wait for ever.
 */
export function waitForOnline(
    timeoutMs: number = OFFLINE_RETRY_WAIT_MS,
    isOnline: () => boolean = () => navigator.onLine,
    events: OnlineEvents = globalThis,
): Promise<boolean> {
    if (isOnline()) return Promise.resolve(true);
    return new Promise((resolve) => {
        const finish = () => {
            clearTimeout(timer);
            events.removeEventListener("online", finish);
            resolve(isOnline());
        };
        const timer = setTimeout(finish, timeoutMs);
        events.addEventListener("online", finish);
    });
}
