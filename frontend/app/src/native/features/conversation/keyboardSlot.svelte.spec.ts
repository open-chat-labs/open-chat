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

describe("the keyboard slot's one retry", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    // the emoji panel's keyboard glyph: the panel goes, the text box is focused for the keyboard
    function keyboardGlyph(slot: KeyboardSlot) {
        slot.toggle("emoji");
        expect(slot.toggle("emoji")).toBe("focus");
        slot.inputFocused();
    }

    test("a menu's refocus that brought no keyboard doesn't use up a later focus's retry", () => {
        const { slot, retries } = heldForMenu(true);
        slot.keyboardReported(0);
        slot.menuClosed("conversation");
        vi.advanceTimersByTime(2000);
        expect(retries()).toBe(0);
        expect(slot.height).toBe(0);

        keyboardGlyph(slot);
        vi.advanceTimersByTime(2000);
        expect(retries()).toBe(1);
    });

    test("each focus asks again once, not on every wait its retry starts", () => {
        const slot = new KeyboardSlot(true, true);
        let retries = 0;
        slot.onMissed = () => {
            retries++;
            // focusing the field afresh fires its focus event
            slot.inputFocused();
            return true;
        };
        keyboardGlyph(slot);
        vi.advanceTimersByTime(2000);
        expect(retries).toBe(1);
        expect(slot.height).toBe(320);
        vi.advanceTimersByTime(2000);
        expect(retries).toBe(1);
        expect(slot.height).toBe(0);

        // the next focus has its own
        keyboardGlyph(slot);
        vi.advanceTimersByTime(2000);
        expect(retries).toBe(2);
    });
});
