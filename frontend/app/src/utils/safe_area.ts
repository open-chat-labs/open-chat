import { isStandalone, mobileOperatingSystem } from "./devices";

export function detectNeedsSafeInset() {
    const body = document.body;
    if (mobileOperatingSystem === "iOS" && isStandalone) {
        body.classList.add("needs-safe-inset");
        return;
    }

    if (body.classList.contains("native-android")) {
        body.classList.add("needs-safe-inset");
        return;
    }
}

let lastScrollY = 0;
let rafId: number | undefined;

function trackVirtualKeyboard() {
    rafId = undefined;
    const threshold = 100; // prevent accidental triggering
    const scrollY = window.scrollY;
    const delta = scrollY - lastScrollY;
    const keyboardVisible = delta > threshold;
    lastScrollY = scrollY;
    if (keyboardVisible) {
        document.body.classList.add("keyboard");
    } else {
        document.body.classList.remove("keyboard");
    }
}

// Coalesce bursts of scroll/resize events into one check per frame
function scheduleTrack() {
    if (rafId === undefined) {
        rafId = window.requestAnimationFrame(trackVirtualKeyboard);
    }
}

export function setupKeyboardTracking() {
    window.addEventListener("scroll", scheduleTrack, { passive: true });
    window.addEventListener("resize", scheduleTrack);

    return () => {
        window.removeEventListener("scroll", scheduleTrack);
        window.removeEventListener("resize", scheduleTrack);
        if (rafId !== undefined) {
            window.cancelAnimationFrame(rafId);
            rafId = undefined;
        }
    };
}
