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

function trackVirtualKeyboard() {
    const threshold = 100; // prevent accidental triggering
    const delta = window.scrollY - lastScrollY;
    const keyboardVisible = delta > threshold;
    lastScrollY = window.scrollY;
    if (keyboardVisible) {
        document.body.classList.add("keyboard");
    } else {
        document.body.classList.remove("keyboard");
    }
}

export function setupKeyboardTracking() {
    window.addEventListener("scroll", trackVirtualKeyboard);
    window.addEventListener("resize", trackVirtualKeyboard);

    return () => {
        window.removeEventListener("scroll", trackVirtualKeyboard);
        window.removeEventListener("resize", trackVirtualKeyboard);
    }
}
