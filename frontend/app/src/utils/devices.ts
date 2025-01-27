/* eslint-disable @typescript-eslint/ban-ts-comment */
export const isTouchDevice: boolean =
    process.env.NODE_ENV !== "test" &&
    //@ts-ignore
    ("ontouchstart" in window || navigator.maxTouchPoints > 0 || navigator.msMaxTouchPoints > 0);

export const supportsHover = window.matchMedia("(hover: hover)").matches;

// Often we *don't* want to include things like touch screen laptops so we want to also check that hover is *not* supported
export const isTouchOnlyDevice = isTouchDevice && !supportsHover;

export const mobileOperatingSystem = getMobileOperatingSystem();
export const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

/**
 * Determine the mobile operating system.
 * This function returns one of 'iOS', 'Android', 'Windows Phone', or 'unknown'.
 *
 * @returns {String}
 */
function getMobileOperatingSystem(): "iOS" | "Android" | "Windows Phone" | "unknown" {
    if (process.env.NODE_ENV === "test") {
        return "unknown";
    }

    //@ts-ignore
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;

    // Windows Phone must come first because its UA also contains "Android"
    if (/windows phone/i.test(userAgent)) {
        return "Windows Phone";
    }

    if (/android/i.test(userAgent)) {
        return "Android";
    }

    // iOS detection from: http://stackoverflow.com/a/9039885/177710
    //@ts-ignore
    if (/iPad|iPhone|iPod/.test(userAgent) && !window.MSStream) {
        return "iOS";
    }

    return "unknown";
}
