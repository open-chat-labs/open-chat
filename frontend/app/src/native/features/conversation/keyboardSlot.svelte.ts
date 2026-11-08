import { keyboard } from "@stores/keyboard.svelte";
import { softKeyboard } from "../../aboveKeyboard.svelte";
import {
    CLOSED,
    inputFocused,
    keyboardMoved,
    slotHeight,
    togglePanel,
    type InputMove,
    type Panel,
    type Slot,
} from "./keyboardSlot";

// How long the slot holds the keyboard's height for a keyboard that doesn't come (a hardware
// keyboard, a focus the platform shows none for).
const EXPECT_FOR_MS = 1000;

/**
 * The slot under a conversation's composer (keyboardSlot.ts): the keyboard, or a panel in its place.
 *
 * Where the keyboard's height is reported (the Android app), the WebView's viewport resize is off
 * while the conversation shows, as components_mobile's composer has it: the keyboard comes up over
 * the window, and the slot takes its height, so the composer sits right on it, and a panel takes
 * the same height when it goes down. Elsewhere (the iOS app, whose WebView shrinks above the
 * keyboard, and phones' browsers, which bring the field into view themselves) the platform places
 * the composer above the keyboard, and a panel takes the keyboard's last height (or a guess).
 */
export class KeyboardSlot {
    #slot = $state<Slot>(CLOSED);
    #expectTimer: ReturnType<typeof setTimeout> | undefined;
    readonly #reported: boolean;

    constructor(reported: boolean) {
        this.#reported = reported;
    }

    /** The panel showing in the keyboard's place. */
    get panel(): Panel | undefined {
        return this.#slot.panel;
    }

    /** The emoji panel's search has the keyboard. */
    get searching(): boolean {
        return this.#slot.searching;
    }

    /** How tall the slot is, in CSS pixels. */
    get height(): number {
        return slotHeight(this.#slot, {
            up: this.#reported ? softKeyboard.height : 0,
            expected: this.#reported ? softKeyboard.expected : 0,
            panel: keyboard.height,
        });
    }

    /** How much of the slot the keyboard covers (a panel searching shows above it). */
    get covered(): number {
        if (!this.#slot.searching) return 0;
        return this.#reported && softKeyboard.height > 0 ? softKeyboard.height : keyboard.height;
    }

    /**
     * While the conversation shows: the viewport resize off where the slot follows the keyboard,
     * back on when it goes. Returns the teardown.
     */
    hold(): () => void {
        if (!this.#reported) return () => {};
        keyboard.disableViewportResize();
        return () => {
            clearTimeout(this.#expectTimer);
            keyboard.enableViewportResize();
        };
    }

    /** The keyboard's height changed (reported): up, or down. */
    keyboardMoved(up: boolean): void {
        const next = keyboardMoved(this.#slot, up);
        if (next !== this.#slot) this.#slot = next;
        if (!this.#slot.expecting) clearTimeout(this.#expectTimer);
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
        this.#set(inputFocused(this.#reported, softKeyboard.height > 0));
    }

    /** The emoji panel's search field took focus, or lost it. */
    search(searching: boolean): void {
        if (this.#slot.panel !== "emoji" || this.#slot.searching === searching) return;
        this.#slot = { ...this.#slot, searching };
    }

    /** Closes the panel (Android's back, a tap on the messages, the search opening). */
    close(): void {
        if (this.#slot.panel !== undefined) this.#set(CLOSED);
    }

    #set(slot: Slot) {
        this.#slot = slot;
        clearTimeout(this.#expectTimer);
        if (slot.expecting) {
            this.#expectTimer = setTimeout(() => this.keyboardMoved(false), EXPECT_FOR_MS);
        }
    }
}
