import { messageSwipeAction } from "./messageSwipe";

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
