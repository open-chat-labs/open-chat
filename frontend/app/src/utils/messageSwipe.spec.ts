import type { MessageMenuAction } from "@client";
import { messageSwipeAction, messageSwipeLeft, nativeMessageSwipes } from "./messageSwipe";

describe("nativeMessageSwipes", () => {
    const offers = (...actions: MessageMenuAction[]) => new Set<MessageMenuAction>(actions);

    test("right replies to any message that offers a reply; left edits only your own", () => {
        expect(nativeMessageSwipes(false, offers("reply", "forward"))).toEqual({
            right: "reply",
            left: undefined,
        });
        expect(nativeMessageSwipes(true, offers("reply", "edit"))).toEqual({
            right: "reply",
            left: "edit",
        });
    });

    test("neither is taken where the message doesn't offer it", () => {
        expect(nativeMessageSwipes(true, offers())).toEqual({ right: undefined, left: undefined });
        expect(nativeMessageSwipes(false, offers("edit"))).toEqual({
            right: undefined,
            left: undefined,
        });
    });
});

describe("messageSwipeAction", () => {
    // Invariant: one swipe triggers exactly one of edit or reply. Swiping your own editable
    // message left used to start an edit and then set a reply as well.
    test("swiping your own editable message left edits it and does not reply", () => {
        expect(messageSwipeAction("left", true, true)).toBe("edit");
    });

    test("swiping your own message left replies when it can't be edited", () => {
        expect(messageSwipeAction("left", true, false)).toBe("reply");
    });

    test("swiping someone else's message left forwards it", () => {
        expect(messageSwipeAction("left", false, false)).toBe("forward");
    });

    test("swiping any message right replies", () => {
        expect(messageSwipeAction("right", true, true)).toBe("reply");
        expect(messageSwipeAction("right", false, false)).toBe("reply");
    });
});

describe("messageSwipeLeft", () => {
    const offers = (...actions: MessageMenuAction[]) => new Set<MessageMenuAction>(actions);

    // invariant 3 (#10117)
    test("swiping your own editable message edits it and never also sets a reply; swiping another person's message forwards it if forwardable", () => {
        expect(messageSwipeLeft(true, offers("edit", "reply"))).toBe("edit");
        expect(messageSwipeLeft(false, offers("forward", "reply"))).toBe("forward");
        expect(messageSwipeLeft(false, offers("reply"))).toBeUndefined();
    });

    test("isn't taken where the message doesn't offer what it would do", () => {
        expect(messageSwipeLeft(true, offers("reply"))).toBe("reply");
        expect(messageSwipeLeft(true, offers())).toBeUndefined();
    });
});
