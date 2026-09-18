import { vi } from "vitest";
import {
    RESUME_HEARTBEAT_GAP_MS,
    RESUME_HEARTBEAT_INTERVAL_MS,
    RESUME_MIN_HIDDEN_MS,
    watchForResume,
} from "./resumeDetector";

let visibility: DocumentVisibilityState = "visible";
let clock = 0;

function setVisibility(state: DocumentVisibilityState) {
    visibility = state;
    document.dispatchEvent(new Event("visibilitychange"));
}

// Moves the clock without running any timers, as when the machine is asleep
function sleep(ms: number) {
    clock += ms;
}

// Moves the clock and runs the timers due within it
function advance(ms: number) {
    clock += ms;
    vi.advanceTimersByTime(ms);
}

describe("watchForResume", () => {
    let stop: (() => void) | undefined;
    const onResume = vi.fn();

    beforeAll(() => {
        Object.defineProperty(document, "visibilityState", {
            configurable: true,
            get: () => visibility,
        });
    });

    beforeEach(() => {
        vi.useFakeTimers();
        visibility = "visible";
        clock = 0;
        onResume.mockReset();
        stop = watchForResume(onResume, () => clock);
    });

    afterEach(() => {
        stop?.();
        vi.useRealTimers();
    });

    test("reports coming back after being hidden for long enough", () => {
        setVisibility("hidden");
        sleep(RESUME_MIN_HIDDEN_MS + 1000);
        setVisibility("visible");
        expect(onResume).toHaveBeenCalledOnce();
        expect(onResume).toHaveBeenCalledWith("visible", RESUME_MIN_HIDDEN_MS + 1000);
    });

    test("ignores a quick switch away and back", () => {
        setVisibility("hidden");
        advance(RESUME_MIN_HIDDEN_MS - 1000);
        setVisibility("visible");
        expect(onResume).not.toHaveBeenCalled();
    });

    test("reports a freeze while visible, as when the machine sleeps with the app on screen", () => {
        advance(RESUME_HEARTBEAT_INTERVAL_MS * 3);
        expect(onResume).not.toHaveBeenCalled();

        sleep(10 * 60 * 1000);
        advance(RESUME_HEARTBEAT_INTERVAL_MS);
        expect(onResume).toHaveBeenCalledOnce();
        expect(onResume.mock.calls[0][0]).toBe("clock_jump");
        expect(onResume.mock.calls[0][1]).toBeGreaterThanOrEqual(RESUME_HEARTBEAT_GAP_MS);
    });

    test("does not treat throttled timers in a hidden tab as a freeze", () => {
        setVisibility("hidden");
        sleep(RESUME_HEARTBEAT_GAP_MS * 2);
        advance(RESUME_HEARTBEAT_INTERVAL_MS);
        expect(onResume).not.toHaveBeenCalled();
    });

    test("reports a suspension noticed by both routes only once", () => {
        setVisibility("hidden");
        sleep(10 * 60 * 1000);
        setVisibility("visible");
        advance(RESUME_HEARTBEAT_INTERVAL_MS);
        expect(onResume).toHaveBeenCalledOnce();
        expect(onResume.mock.calls[0][0]).toBe("visible");
    });

    test("stops reporting once stopped", () => {
        stop?.();
        stop = undefined;
        setVisibility("hidden");
        sleep(10 * 60 * 1000);
        setVisibility("visible");
        sleep(10 * 60 * 1000);
        advance(RESUME_HEARTBEAT_INTERVAL_MS);
        expect(onResume).not.toHaveBeenCalled();
    });
});
