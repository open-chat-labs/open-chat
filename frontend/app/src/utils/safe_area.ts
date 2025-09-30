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

detectNeedsSafeInset();
