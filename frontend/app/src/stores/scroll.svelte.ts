// Only `isScrolling` is reactive: it flips to true on the first scroll event
// of a burst and back to false RESET_SCROLL_STATE_DELAY ms after the last
// one, so dependants are invalidated at most twice per gesture rather than
// once per scroll event.
let lastScrollTime = 0;
let isScrolling = $state(false);
let scrollTimeout: number;

const RESET_SCROLL_STATE_DELAY = 150;

const handleScroll = () => {
    lastScrollTime = Date.now();
    isScrolling = true;

    window.clearTimeout(scrollTimeout);
    scrollTimeout = window.setTimeout(() => {
        isScrolling = false;
    }, RESET_SCROLL_STATE_DELAY);
};

// Global listener setup
if (typeof window !== "undefined") {
    window.addEventListener("scroll", handleScroll, { passive: true, capture: true });
}

export const scrollStatus = {
    get lastScrollTime() {
        return lastScrollTime;
    },
    get isScrolling() {
        return isScrolling;
    },
    // The cooldown window (150ms after the last scroll event) coincides with
    // the reset delay above, so this is the same boolean.
    get isCooldown() {
        return isScrolling;
    },
};
