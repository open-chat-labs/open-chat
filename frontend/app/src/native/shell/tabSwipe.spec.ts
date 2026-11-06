import {
    AXIS_LOCK,
    EDGE_GUARD,
    RUBBER_BAND,
    startsSwipe,
    swipeAxis,
    swipeOffset,
    swipeRelease,
    swipeStep,
    tabSlide,
} from "./tabSwipe";

const WIDTH = 400;
// five tabs: Chats, Communities, Wallet, Activity, You
const COUNT = 5;

describe("starting a swipe between tabs", () => {
    test("leaves drags from the window's sides to the system", () => {
        expect(startsSwipe(EDGE_GUARD - 1, WIDTH)).toBe(false);
        expect(startsSwipe(WIDTH - EDGE_GUARD + 1, WIDTH)).toBe(false);
        expect(startsSwipe(200, WIDTH)).toBe(true);
    });

    test("waits a few px, then lets a mostly vertical drag scroll", () => {
        expect(swipeAxis(4, 3)).toBe("undecided");
        expect(swipeAxis(AXIS_LOCK, 2)).toBe("sideways");
        expect(swipeAxis(-12, 4)).toBe("sideways");
        expect(swipeAxis(6, 12)).toBe("vertical");
        expect(swipeAxis(8, 8)).toBe("vertical");
    });
});

describe("a swipe between tabs", () => {
    test("goes to the next tab dragging towards the start, mirrored in RTL", () => {
        expect(swipeStep(-50, false)).toBe(1);
        expect(swipeStep(50, false)).toBe(-1);
        expect(swipeStep(50, true)).toBe(1);
        expect(swipeStep(-50, true)).toBe(-1);
        expect(swipeStep(0, false)).toBe(0);
    });

    test("follows the finger towards a tab", () => {
        expect(swipeOffset(-120, 0, COUNT, false)).toBe(-120);
        expect(swipeOffset(120, 2, COUNT, false)).toBe(120);
    });

    test("rubber-bands past the first or last tab", () => {
        expect(swipeOffset(80, 0, COUNT, false)).toBe(20);
        expect(swipeOffset(-80, 4, COUNT, false)).toBe(-20);
        expect(swipeOffset(1000, 0, COUNT, false)).toBe(RUBBER_BAND);
        // in RTL a drag left goes to the tab before, which the first doesn't have
        expect(swipeOffset(-80, 0, COUNT, true)).toBe(-20);
        expect(swipeOffset(80, 0, COUNT, true)).toBe(80);
    });

    test("switches past 30% of the width", () => {
        expect(swipeRelease(-121, WIDTH, 0, 0, COUNT, false)).toBe(1);
        expect(swipeRelease(121, WIDTH, 0, 2, COUNT, false)).toBe(1);
        expect(swipeRelease(121, WIDTH, 0, 2, COUNT, true)).toBe(3);
    });

    test("springs back short of it", () => {
        expect(swipeRelease(-100, WIDTH, 0, 0, COUNT, false)).toBeUndefined();
        expect(swipeRelease(0, WIDTH, 0, 0, COUNT, false)).toBeUndefined();
    });

    test("switches on a flick the way it was dragged, not against it or on a tap's jitter", () => {
        expect(swipeRelease(-40, WIDTH, -0.6, 0, COUNT, false)).toBe(1);
        expect(swipeRelease(-40, WIDTH, 0.6, 0, COUNT, false)).toBeUndefined();
        expect(swipeRelease(-40, WIDTH, -0.3, 0, COUNT, false)).toBeUndefined();
        expect(swipeRelease(-10, WIDTH, -2, 0, COUNT, false)).toBeUndefined();
    });

    test("never goes past the first or last tab", () => {
        expect(swipeRelease(300, WIDTH, 1, 0, COUNT, false)).toBeUndefined();
        expect(swipeRelease(-300, WIDTH, -1, 4, COUNT, false)).toBeUndefined();
        // a build without the wallet has four
        expect(swipeRelease(-300, WIDTH, 0, 3, 4, false)).toBeUndefined();
    });
});

describe("a tab switch's motion", () => {
    test("moves only the two screens: the new one in from the end going forward", () => {
        expect(tabSlide(0, 2, false)).toEqual({ incomingFrom: 1, outgoingTo: -1 });
        expect(tabSlide(4, 1, false)).toEqual({ incomingFrom: -1, outgoingTo: 1 });
    });

    test("is mirrored in RTL", () => {
        expect(tabSlide(0, 2, true)).toEqual({ incomingFrom: -1, outgoingTo: 1 });
        expect(tabSlide(4, 1, true)).toEqual({ incomingFrom: 1, outgoingTo: -1 });
    });
});
