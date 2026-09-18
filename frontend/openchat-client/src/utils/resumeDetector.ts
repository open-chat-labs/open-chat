// How long the app must have been hidden for coming back to count as resuming. A quick switch
// away and back leaves the network connection healthy, so there is nothing to recover from.
export const RESUME_MIN_HIDDEN_MS = 30_000;

// While visible a heartbeat ticks at this interval. A tick arriving much later than that means
// the page was frozen, most often because the machine slept with the app on screen, which
// raises no visibilitychange event.
export const RESUME_HEARTBEAT_INTERVAL_MS = 5_000;
export const RESUME_HEARTBEAT_GAP_MS = 30_000;

export type ResumeReason = "visible" | "clock_jump";

/**
 * Calls `onResume` when the app comes back after being suspended: shown again after being hidden
 * for at least `RESUME_MIN_HIDDEN_MS`, or found to have been frozen while visible. Each
 * suspension is reported once, whichever way it is noticed. Returns a function which stops
 * watching.
 */
export function watchForResume(
    onResume: (reason: ResumeReason, suspendedMs: number) => void,
    now: () => number = Date.now,
): () => void {
    let hiddenAt: number | undefined =
        document.visibilityState === "hidden" ? now() : undefined;
    let lastTick = now();

    const onVisibilityChange = () => {
        const time = now();
        if (document.visibilityState === "hidden") {
            hiddenAt ??= time;
            return;
        }
        // Restarted so that the first tick after coming back does not report the time spent
        // hidden, when timers are throttled, as a second suspension
        lastTick = time;
        if (hiddenAt !== undefined) {
            const hiddenFor = time - hiddenAt;
            hiddenAt = undefined;
            if (hiddenFor >= RESUME_MIN_HIDDEN_MS) {
                onResume("visible", hiddenFor);
            }
        }
    };

    const heartbeat = window.setInterval(() => {
        const time = now();
        const gap = time - lastTick;
        lastTick = time;
        // Hidden pages have their timers throttled, so a long gap then means nothing
        if (document.visibilityState === "visible" && gap >= RESUME_HEARTBEAT_GAP_MS) {
            onResume("clock_jump", gap);
        }
    }, RESUME_HEARTBEAT_INTERVAL_MS);

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
        window.clearInterval(heartbeat);
        document.removeEventListener("visibilitychange", onVisibilityChange);
    };
}
