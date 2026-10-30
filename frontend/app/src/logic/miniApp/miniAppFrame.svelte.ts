// What's around a game's app in its card, shared by the frames in both trees: when the app's shown,
// and its full screen mode.

import { observeIntersection } from "@src/utils/sharedIntersectionObserver";

// How long a card stays shown after leaving the screen, so scrolling past it and back doesn't reload
// the app and open the game again
const OFF_SCREEN_MS = 10_000;

// Reports whether the card's on screen: in view, in a page that's showing
type Observe = (el: Element, onScreen: (visible: boolean) => void) => () => void;

/**
 * Whether a card's app is shown. It is from when the card comes on screen, which opens the game, so
 * a player sees it as it stands and anyone else is watching it, until the card's been off the screen
 * for a while.
 */
export class MiniAppPresence {
    shown = $state(false);
    #observe: Observe;
    #offScreenMs: number;
    #timer: ReturnType<typeof setTimeout> | undefined;
    #onScreen = false;
    #held = false;

    constructor(observe: Observe = observeOnScreen, offScreenMs = OFF_SCREEN_MS) {
        this.#observe = observe;
        this.#offScreenMs = offScreenMs;
    }

    // Watches the card, and returns a function which stops, after which the app isn't shown
    observe(card: Element): () => void {
        const unobserve = this.#observe(card, (visible) => this.onScreen(visible));
        return () => {
            unobserve();
            this.#clearTimer();
            this.shown = false;
        };
    }

    onScreen(visible: boolean): void {
        this.#onScreen = visible;
        this.#update();
    }

    // Keeps the app shown, whether or not the card's on screen, while it's full screen: the app's
    // over everything then, so the card doesn't count. Once released, the card's on screen or has
    // just left it.
    hold(held: boolean): void {
        this.#held = held;
        this.#update();
    }

    #update(): void {
        if (this.#onScreen || this.#held) {
            this.#clearTimer();
            this.shown = true;
        } else if (this.shown && this.#timer === undefined) {
            this.#timer = setTimeout(() => {
                this.#timer = undefined;
                this.shown = false;
            }, this.#offScreenMs);
        }
    }

    #clearTimer(): void {
        clearTimeout(this.#timer);
        this.#timer = undefined;
    }
}

// A card in view is on screen while its page is showing: a tab in the background, or a hidden app,
// shows nothing. The browser stops reporting intersections while a page is hidden, so that's watched
// too.
function observeOnScreen(el: Element, onScreen: (visible: boolean) => void): () => void {
    let inView = false;
    const report = () => onScreen(inView && document.visibilityState === "visible");
    const unobserve = observeIntersection(el, (entry) => {
        inView = entry.isIntersecting;
        report();
    });
    document.addEventListener("visibilitychange", report);
    return () => {
        document.removeEventListener("visibilitychange", report);
        unobserve();
    };
}

// What full screen mode needs of the frame's dialog element
export type FrameDialog = Pick<
    HTMLDialogElement,
    "open" | "show" | "showModal" | "close" | "addEventListener" | "removeEventListener"
>;

/**
 * A frame's full screen mode. The frame is a dialog element in the card, open in place. Going full
 * screen reopens it as a modal, which puts it in the top layer, over everything else, without moving
 * it in the document, so the app inside isn't reloaded and the game stays open.
 */
export class MiniAppFullScreen {
    on = $state(false);
    #dialog: FrameDialog | undefined;

    // Whether the browser can do it. Otherwise the frame's only ever shown in place.
    static get supported(): boolean {
        return (
            typeof HTMLDialogElement === "function" &&
            typeof HTMLDialogElement.prototype.showModal === "function"
        );
    }

    // Manages `dialog`, which is open in place, and returns a function which stops
    attach(dialog: FrameDialog): () => void {
        this.#dialog = dialog;
        // Escape closes a modal dialog, which leaves full screen: it's shown in place again
        const onClose = () => {
            if (!dialog.open) {
                this.on = false;
                dialog.show();
            }
        };
        dialog.addEventListener("close", onClose);
        return () => {
            dialog.removeEventListener("close", onClose);
            this.#dialog = undefined;
        };
    }

    toggle(): void {
        if (this.on) {
            this.exit();
        } else {
            this.enter();
        }
    }

    enter(): void {
        const dialog = this.#dialog;
        if (dialog === undefined || this.on) return;
        dialog.close();
        dialog.showModal();
        this.on = true;
    }

    exit(): void {
        const dialog = this.#dialog;
        if (dialog === undefined || !this.on) return;
        dialog.close();
        dialog.show();
        this.on = false;
    }
}
