import { KeyboardSlot } from "./keyboardSlot.svelte";

vi.mock("@stores/keyboard.svelte", () => ({
    keyboard: {
        seen: true,
        height: 320,
        viewportResizeEnabled: false,
        disableViewportResize: () => {},
        enableViewportResize: () => {},
    },
}));

// the Android app's slot, its keyboard up at 320px for the composer, a message's menu opened over
// it; `focusEvent`: focusing the text box fires its focus event (it didn't have the focus)
function heldForMenu(focusEvent: boolean): { slot: KeyboardSlot; retries: () => number } {
    const slot = new KeyboardSlot(true, true);
    slot.keyboardReported(320);
    slot.holdForMenu(true);
    let retries = 0;
    slot.onRefocus = () => {
        if (focusEvent) slot.inputFocused();
        return true;
    };
    slot.onMissed = () => {
        retries++;
        return true;
    };
    return { slot, retries: () => retries };
}

describe("the keyboard slot, as a message's menu closes", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    test("closed at once, the keyboard's late down doesn't move the composer", () => {
        const { slot } = heldForMenu(true);
        slot.menuClosed("conversation");
        expect(slot.held).toBe(true);
        slot.keyboardReported(0);
        expect(slot.height).toBe(320);
        slot.keyboardReported(320);
        expect(slot.held).toBe(false);
        expect(slot.height).toBe(320);
    });

    test("with the text box focused already (no focus event), the space is still let go", () => {
        const { slot } = heldForMenu(false);
        slot.keyboardReported(0);
        expect(slot.height).toBe(320);
        slot.menuClosed("conversation");
        expect(slot.held).toBe(true);
        // no keyboard for the focus: let go once the wait runs out
        vi.advanceTimersByTime(2000);
        expect(slot.held).toBe(false);
        expect(slot.height).toBe(0);
    });

    test("no keyboard for the focus: let go after the one wait, without asking again", () => {
        const { slot, retries } = heldForMenu(true);
        slot.keyboardReported(0);
        slot.menuClosed("conversation");
        vi.advanceTimersByTime(1999);
        expect(slot.height).toBe(320);
        vi.advanceTimersByTime(1);
        expect(retries()).toBe(0);
        expect(slot.height).toBe(0);
    });

    test("gone to another screen, the space is let go at once", () => {
        const { slot } = heldForMenu(true);
        slot.keyboardReported(0);
        slot.menuClosed("away");
        expect(slot.held).toBe(false);
        expect(slot.height).toBe(0);
    });
});
