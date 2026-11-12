import { keyboard } from "@stores/keyboard.svelte";
import {
    afterMenu,
    CLOSED,
    holdForMenu,
    inputFocused,
    keyboardIsUp,
    keyboardMissed,
    keyboardMoved,
    keyboardReport,
    released,
    reportToReplay,
    restingHeight,
    SEARCH_STRIP,
    searchChanged,
    SETTLE_MS,
    slotHeight,
    togglePanel,
    type InputMove,
    type MenuExit,
    type Panel,
    type Search,
    type Slot,
} from "./keyboardSlot";

// How long the slot holds the keyboard's height for a keyboard that doesn't come (a hardware
// keyboard, a focus the platform shows none for).
const EXPECT_FOR_MS = 2000;

/**
 * The slot under a conversation's composer (keyboardSlot.ts): the keyboard, or a panel in its place.
 *
 * Where the keyboard's height is reported (the Android app), the WebView's viewport resize is off
 * while the conversation shows, as components_mobile's composer has it: the keyboard comes up over
 * the window, and the slot takes its height, so the composer sits right on it, and a panel takes
 * the same height when it goes down. The heights reported are taken once they've settled, and a
 * "down" from the keyboard's last move while it's coming again is ignored (`keyboardReport`), so
 * switching quickly between a panel and the keyboard doesn't move the composer; the last report is
 * taken once the keyboard's no longer expected (`reportToReplay`). Elsewhere (the iOS
 * app, whose WebView shrinks above the keyboard, and phones' browsers, which bring the field into
 * view themselves) the platform places the composer above the keyboard, and a panel takes the
 * keyboard's last height where it's been seen, else the design's (`restingHeight`).
 */
export class KeyboardSlot {
    #slot = $state<Slot>(CLOSED);
    // the keyboard's height as the slot takes it (settled), and what it holds while it comes
    #up = $state(0);
    #held = $state(0);
    // the height the keyboard last reported, taken or not (`reportToReplay`)
    #latest = 0;
    // the keyboard's last settled height where it's been seen (a panel rests at it), else undefined
    #last = $state<number | undefined>(keyboard.seen ? keyboard.height : undefined);
    #expectTimer: ReturnType<typeof setTimeout> | undefined;
    #settleTimer: ReturnType<typeof setTimeout> | undefined;
    readonly #reported: boolean;
    readonly #gallery: boolean;
    #safeBottom = $state(0);
    // where the keyboard isn't reported, how much of the window a phone browser's keyboard covers
    #viewportCovered = $state(0);

    /**
     * `reported`: the keyboard's height is reported (the Android app). `gallery`: the attach panel
     * has its gallery strip (the apps), so it rests at the emoji panel's height.
     */
    constructor(reported: boolean, gallery: boolean) {
        this.#reported = reported;
        this.#gallery = gallery;
    }

    /** The panel showing in the keyboard's place. */
    get panel(): Panel | undefined {
        return this.#slot.panel;
    }

    /** The emoji panel's search, and how it shows. */
    get search(): Search {
        return this.#slot.search;
    }

    /** The keyboard's space is kept for a message's menu (an empty surface shows in it). */
    get held(): boolean {
        return this.#slot.held;
    }

    /** How tall the open panel rests, in CSS pixels (0 with none open). */
    get resting(): number {
        const panel = this.#slot.panel;
        if (panel === undefined) return 0;
        return restingHeight({
            keyboard: this.#last,
            safeBottom: this.#safeBottom,
            gallery: this.#gallery,
        });
    }

    /** How tall the slot is, in CSS pixels. */
    get height(): number {
        return slotHeight(this.#slot, {
            up: this.#up,
            known: this.#reported ? (this.#slot.expecting ? this.#held : (this.#last ?? 0)) : 0,
            panel: this.resting,
        });
    }

    /** The panel's own resting height: searching emoji, the strip on top of the keyboard. */
    get panelRest(): number {
        if (this.#slot.search !== "strip") return this.resting;
        return (this.#reported ? this.height : this.#viewportCovered) + SEARCH_STRIP;
    }

    /** How much of the panel's bottom the keyboard covers (what it shows sits above it). */
    get covered(): number {
        switch (this.#slot.search) {
            case "strip":
                return this.#reported ? this.height : this.#viewportCovered;
            case "grown":
                return this.#reported ? this.#up : this.#viewportCovered;
            default:
                return 0;
        }
    }

    /** The safe area under the slot, in CSS pixels (measured by the host). */
    set safeBottom(px: number) {
        this.#safeBottom = px;
    }

    /**
     * While the conversation shows: the viewport resize off where the slot follows the keyboard,
     * back on when it goes. Returns the teardown.
     */
    hold(): () => void {
        if (!this.#reported) return this.#followViewport();
        keyboard.disableViewportResize();
        return () => {
            clearTimeout(this.#expectTimer);
            clearTimeout(this.#settleTimer);
            keyboard.enableViewportResize();
        };
    }

    /** The keyboard reported its height (0: down). */
    keyboardReported(height: number): void {
        if (!this.#reported) return;
        this.#latest = height;
        switch (keyboardReport(this.#slot, this.#up, height)) {
            case "ignore":
                // a stale "down", or the height it has: a settling one is off
                if (height === this.#up) clearTimeout(this.#settleTimer);
                return;
            case "apply":
                clearTimeout(this.#settleTimer);
                this.#take(height);
                return;
            case "settle":
                clearTimeout(this.#settleTimer);
                this.#settleTimer = setTimeout(() => this.#take(height), SETTLE_MS);
                return;
        }
    }

    /** The + or emoji button: what the composer's text box should do. */
    toggle(panel: Panel): InputMove {
        const { slot, input } = togglePanel(this.#slot, panel, this.#reported);
        this.#set(slot);
        return input;
    }

    /** The composer's text box took focus: the keyboard's coming. */
    inputFocused(): void {
        // a screen over this one may have put the viewport resize back on (aboveKeyboard's)
        if (this.#reported && keyboard.viewportResizeEnabled) keyboard.disableViewportResize();
        this.#set(inputFocused(this.#slot, this.#reported, keyboardIsUp(this.#up, this.#latest)));
    }

    /** The emoji panel's search field took the keyboard (as `search`), or gave it up ("none"). */
    searchChanged(search: Search): void {
        this.#set(
            searchChanged(this.#slot, search, this.#reported, keyboardIsUp(this.#up, this.#latest)),
        );
    }

    /**
     * A message's long-press menu is opening, `composer` if the composer shows: the keyboard's
     * space is kept while the keyboard is down for the menu (`holdForMenu`).
     */
    holdForMenu(composer: boolean): void {
        this.#slot = holdForMenu(
            this.#slot,
            this.#reported,
            keyboardIsUp(this.#up, this.#latest),
            composer,
        );
    }

    /**
     * A message's menu, and whatever it opened, has closed (`afterMenu`): the composer's text box
     * is focused again (`onRefocus`) for the keyboard to come back up into the space kept, which is
     * let go once it's up; or, gone to another screen (or the text box couldn't be focused), the
     * space is let go now.
     *
     * The focus is the slot's own move (`inputFocused`), not left to the text box's focus event,
     * which doesn't fire where it has the focus already. It isn't the reader's tap, so the platform
     * may show no keyboard for it (Android's WebView, after a sheet or an alert): the space is let
     * go once the keyboard's wait runs out, without asking again (`onMissed`), which wouldn't be a
     * tap either.
     */
    menuClosed(exit: MenuExit): void {
        const next = afterMenu(this.#slot, exit);
        if (next === "none") return;
        if (next === "refocus" && this.onRefocus?.() === true) {
            this.inputFocused();
            // after the focus, which starts the wait afresh (so its retry would be owed)
            this.#retried = true;
            return;
        }
        this.#slot = released(this.#slot);
        this.#retried = false;
    }

    /**
     * Focuses the composer's text box again after a message's menu; true if it has the focus (the
     * composer's, while it shows).
     */
    onRefocus: (() => boolean) | undefined;

    /** Closes the panel (Android's back, a builder's done). */
    close(): void {
        if (this.#slot.panel !== undefined) this.#set(CLOSED);
    }

    #take(height: number) {
        this.#up = height;
        if (height > 0) {
            this.#last = height;
            this.#retried = false;
        }
        const before = this.#slot;
        const next = keyboardMoved(before, height > 0);
        if (next !== before) this.#slot = next;
        if (!this.#slot.expecting) clearTimeout(this.#expectTimer);
        this.#replay(before);
    }

    // no longer expecting the keyboard: what it last reported, if the slot hasn't taken it
    #replay(before: Slot) {
        const latest = reportToReplay(before, this.#slot, this.#up, this.#latest);
        if (latest !== undefined) this.keyboardReported(latest);
    }

    // a phone's browser keeps the page's height as its keyboard comes up, shrinking only what's
    // seen of it: the part under the keyboard is what's covered
    #followViewport(): () => void {
        const viewport = window.visualViewport;
        if (viewport === null) return () => {};
        const follow = () => {
            const covered = window.innerHeight - viewport.height - viewport.offsetTop;
            this.#viewportCovered = Math.max(0, Math.round(covered));
        };
        viewport.addEventListener("resize", follow);
        return () => {
            clearTimeout(this.#expectTimer);
            viewport.removeEventListener("resize", follow);
        };
    }

    /**
     * Asks the keyboard to come again (the field focused afresh) when it hasn't: Android doesn't
     * always show one for a focus while the last is still going down. True if it asked.
     */
    onMissed: (() => boolean) | undefined;

    // asked for the keyboard again in this wait for it (or a menu's refocus, which isn't asked
    // again): each wait gets its one retry, so it's let go as the wait ends (the keyboard came,
    // it's missed, no longer expected) and as a new one starts
    #retried = false;

    // the keyboard hasn't come: asked again once (focusing the field holds the slot again), then
    // no longer held for
    #missed() {
        if (!this.#slot.expecting) return;
        if (!this.#retried && this.#up === 0) {
            this.#retried = true;
            if (this.onMissed?.() === true) return;
        }
        this.#retried = false;
        const before = this.#slot;
        const next = keyboardMissed(before);
        if (next !== before) this.#slot = next;
        this.#replay(before);
    }

    #set(slot: Slot) {
        const before = this.#slot;
        this.#slot = slot;
        clearTimeout(this.#expectTimer);
        // a wait for the keyboard ended, or a new one started (a retry's focus is the same wait)
        if (!slot.expecting || !before.expecting) this.#retried = false;
        if (slot.expecting) {
            // what to hold for the keyboard: its last height, fixed as it's asked for
            if (!before.expecting) this.#held = this.#last ?? keyboard.height;
            this.#expectTimer = setTimeout(() => this.#missed(), EXPECT_FOR_MS);
        }
        this.#replay(before);
    }
}
