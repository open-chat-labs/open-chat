import { keyboard } from "@stores/keyboard.svelte";
import { softKeyboard } from "./aboveKeyboard.svelte";
import { keyboardOverlap, scrollToShow, takesTyping } from "./keyboard";

describe("the keyboard over a scroller", () => {
    // an 800px window; the scroller ends 80px above its bottom (a pinned Save under it)
    test("covers the scroller from the keyboard's top to the scroller's bottom", () => {
        expect(keyboardOverlap(720, 800, 300, false)).toBe(220);
    });

    test("covers none of it while it's down, or below the scroller", () => {
        expect(keyboardOverlap(720, 800, 0, false)).toBe(0);
        expect(keyboardOverlap(720, 800, 60, false)).toBe(0);
    });

    test("covers none of it while the viewport resizes: the page has shrunk above it", () => {
        expect(keyboardOverlap(720, 800, 300, true)).toBe(0);
    });
});

describe("scrolling a field above the keyboard", () => {
    const visible = { top: 60, bottom: 500 };

    test("leaves a field that shows alone", () => {
        expect(scrollToShow({ top: 200, bottom: 252 }, visible, 16)).toBe(0);
    });

    test("scrolls a field under the keyboard up, clear of it", () => {
        expect(scrollToShow({ top: 520, bottom: 572 }, visible, 16)).toBe(88);
        // partly covered
        expect(scrollToShow({ top: 470, bottom: 522 }, visible, 16)).toBe(38);
    });

    test("scrolls a field above the scroller's top back down", () => {
        expect(scrollToShow({ top: 20, bottom: 72 }, visible, 16)).toBe(-56);
    });

    test("shows a field taller than the space from its top", () => {
        expect(scrollToShow({ top: 300, bottom: 900 }, visible, 16)).toBe(224);
    });
});

describe("what takes typing", () => {
    test("text fields, text areas and editable content", () => {
        const text = document.createElement("input");
        const email = Object.assign(document.createElement("input"), { type: "email" });
        const area = document.createElement("textarea");
        expect(takesTyping(text)).toBe(true);
        expect(takesTyping(email)).toBe(true);
        expect(takesTyping(area)).toBe(true);
    });

    test("not buttons, switches or file pickers", () => {
        for (const type of ["checkbox", "radio", "file", "button", "range"]) {
            expect(takesTyping(Object.assign(document.createElement("input"), { type }))).toBe(
                false,
            );
        }
        expect(takesTyping(document.createElement("button"))).toBe(false);
        expect(takesTyping(null)).toBe(false);
    });
});

describe("the soft keyboard's height", () => {
    test("expects none until the app reports the keyboard (iOS, mobile web)", () => {
        expect(softKeyboard.height).toBe(0);
        expect(softKeyboard.expected).toBe(0);
    });

    test("follows the window insets, and expects the last height once it's down again", () => {
        softKeyboard.follow(true, 312);
        expect(softKeyboard.height).toBe(312);
        softKeyboard.follow(false, 0);
        expect(softKeyboard.height).toBe(0);
        expect(softKeyboard.expected).toBe(312);
        expect(keyboard.height).toBe(312);
    });
});
