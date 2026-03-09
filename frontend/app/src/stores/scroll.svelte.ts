let lastScrollTime = $state(0);
let isScrolling = $state(false);
let scrollTimeout: number;

const RESET_SCROLL_STATE_DELAY = 150;
const COOLDOWN_THRESHOLD = 150;

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
    get isCooldown() {
        return isScrolling || Date.now() - lastScrollTime < COOLDOWN_THRESHOLD;
    },
};
