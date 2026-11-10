import type { MessageMenuAction } from "@client";
import { messageSwipeAction, nativeMessageSwipes, webMessageSwipeLeft } from "./messageSwipe";

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

describe("webMessageSwipeLeft", () => {
    const offers = (...actions: MessageMenuAction[]) => new Set<MessageMenuAction>(actions);

    // web/05: the group's own mapping, where a left swipe the host acts on only ever forwards
    // (your own text's left swipe replies, through the group's onReply)
    test("forwards a message whose menu offers a forward, mine or not", () => {
        expect(webMessageSwipeLeft(offers("forward", "reply"))).toBe("forward");
        expect(webMessageSwipeLeft(offers("forward", "edit", "reply"))).toBe("forward");
    });

    test("isn't taken where the message can't be forwarded, even if it can be edited", () => {
        expect(webMessageSwipeLeft(offers("reply"))).toBeUndefined();
        expect(webMessageSwipeLeft(offers("edit", "reply"))).toBeUndefined();
        expect(webMessageSwipeLeft(offers())).toBeUndefined();
    });
});
