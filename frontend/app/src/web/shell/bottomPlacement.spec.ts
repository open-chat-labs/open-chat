import {
    ACHIEVEMENT_HEIGHT,
    achievementSpot,
    BOTTOM_GAP,
    toastSpot,
    WINDOW_INSET,
    type Box,
} from "./bottomPlacement";

const window = { width: 1400, height: 900, safeBottom: 0 };
// the middle panel beside a 350px list: 456px to 1388px across, 12px to 888px down
const middle: Box = { left: 456, top: 12, width: 932, height: 876 };
// a composer 70px tall at the middle's bottom
const composer: Box = { left: 456, top: 818, width: 932, height: 70 };
// nothing showing (display: none)
const hidden: Box = { left: 0, top: 0, width: 0, height: 0 };
// the emoji picker open over the composer, 400px tall, 8px above it
const picker: Box = { left: 472, top: 410, width: 360, height: 400 };

describe("where the app's toasts play", () => {
    test("just above the composer, across the middle panel", () => {
        expect(toastSpot(window, middle, composer)).toEqual({
            left: 456,
            width: 932,
            y: 818 - BOTTOM_GAP,
        });
    });

    test("just above the middle panel's bottom where there's no composer", () => {
        expect(toastSpot(window, middle, undefined)).toEqual({
            left: 456,
            width: 932,
            y: 888 - BOTTOM_GAP,
        });
    });

    test("a composer that isn't showing is no composer", () => {
        expect(toastSpot(window, middle, hidden).y).toBe(888 - BOTTOM_GAP);
    });

    test("higher as the composer grows", () => {
        const taller: Box = { ...composer, top: 700, height: 188 };
        expect(toastSpot(window, middle, taller).y).toBe(700 - BOTTOM_GAP);
    });

    test("above a popup the composer has open (an emoji picker, a mention list, the + menu)", () => {
        expect(toastSpot(window, middle, composer, [picker]).y).toBe(410 - BOTTOM_GAP);
        // one closing (gone from the page) is none
        expect(toastSpot(window, middle, composer, [hidden]).y).toBe(818 - BOTTOM_GAP);
    });

    test("follows the middle panel as it narrows (a right column docking)", () => {
        const narrower: Box = { ...middle, width: 532 };
        expect(toastSpot(window, narrower, composer)).toEqual({
            left: 456,
            width: 532,
            y: 818 - BOTTOM_GAP,
        });
    });

    test("centred at the window's bottom, over its safe area, when the middle panel is hidden", () => {
        const atWindow = { left: 0, width: 1400, y: 900 - WINDOW_INSET };
        expect(toastSpot(window, hidden, undefined)).toEqual(atWindow);
        expect(toastSpot(window, undefined, undefined)).toEqual(atWindow);
        expect(toastSpot({ ...window, safeBottom: 34 }, undefined, undefined).y).toBe(
            900 - 34 - WINDOW_INSET,
        );
    });

    describe("on a window smaller than the shell (its frame scrolls)", () => {
        // 1366 x 600: the shell at its 720px minimum, scrolled to the top
        const short = { width: 1366, height: 600, safeBottom: 0 };
        const tall: Box = { left: 456, top: 12, width: 898, height: 696 };
        const below: Box = { left: 456, top: 640, width: 898, height: 68 };

        test("on screen, over the window's bottom, when the composer is below it", () => {
            expect(toastSpot(short, tall, below).y).toBe(600 - BOTTOM_GAP);
        });

        test("over the window's safe area too", () => {
            expect(toastSpot({ ...short, safeBottom: 20 }, tall, below).y).toBe(580 - BOTTOM_GAP);
        });

        test("scrolled to the bottom, above the composer again", () => {
            const scrolled = { top: tall.top - 120, composerTop: below.top - 120 };
            expect(
                toastSpot(
                    short,
                    { ...tall, top: scrolled.top },
                    { ...below, top: scrolled.composerTop },
                ).y,
            ).toBe(520 - BOTTOM_GAP);
        });

        test("across the part of the panel on screen when it runs off the window's side", () => {
            // 900px wide: the panel runs from 456 to 1354, off the window at 900
            expect(toastSpot({ ...short, width: 900 }, tall, below)).toMatchObject({
                left: 456,
                width: 444,
            });
            // scrolled across: it starts off the window's left
            expect(toastSpot(short, { ...tall, left: -100 }, below)).toMatchObject({
                left: 0,
                width: 798,
            });
        });

        test("at the window's bottom when the panel's scrolled out of view", () => {
            expect(toastSpot({ ...short, width: 400 }, tall, below)).toEqual({
                left: 0,
                width: 400,
                y: 600 - WINDOW_INSET,
            });
        });
    });
});

describe("where the achievement toast plays", () => {
    test("just above the composer, centred in the middle panel", () => {
        expect(achievementSpot(window, middle, composer, [], undefined)).toEqual({
            x: 922,
            y: 818 - BOTTOM_GAP,
        });
    });

    test("just above the middle panel's bottom where there's no composer", () => {
        expect(achievementSpot(window, middle, undefined, [], undefined)).toEqual({
            x: 922,
            y: 888 - BOTTOM_GAP,
        });
    });

    test("above a popup the composer has open", () => {
        expect(achievementSpot(window, middle, composer, [picker], undefined).y).toBe(
            410 - BOTTOM_GAP,
        );
    });

    test("above a toast showing, on its centre line, with the gap between", () => {
        const toast = toastSpot(window, middle, composer);
        const achievement = achievementSpot(window, middle, composer, [], 56);
        expect(achievement).toEqual({ x: 922, y: 818 - BOTTOM_GAP - 56 - BOTTOM_GAP });
        expect(achievement.x).toBe(toast.left + toast.width / 2);
        // the toast's top, less the gap
        expect(achievement.y).toBe(toast.y - 56 - BOTTOM_GAP);
    });

    test("above the toast where there's no composer", () => {
        expect(achievementSpot(window, middle, undefined, [], 56).y).toBe(
            888 - BOTTOM_GAP - 56 - BOTTOM_GAP,
        );
    });

    test("above two toasts, one above the other", () => {
        expect(achievementSpot(window, middle, composer, [], 120).y).toBe(
            818 - BOTTOM_GAP - 120 - BOTTOM_GAP,
        );
    });

    test("a toast layer with nothing in it is no toast", () => {
        expect(achievementSpot(window, middle, composer, [], 0).y).toBe(818 - BOTTOM_GAP);
    });

    test("back down to the composer once the toast has gone", () => {
        expect(achievementSpot(window, middle, composer, [], 120).y).toBeLessThan(
            achievementSpot(window, middle, composer, [], undefined).y,
        );
    });

    test("follows the middle panel as it narrows (a right column docking)", () => {
        const narrower: Box = { ...middle, width: 532 };
        expect(achievementSpot(window, narrower, composer, [], undefined).x).toBe(456 + 266);
    });

    test("on screen on a window smaller than the shell", () => {
        const short = { width: 900, height: 600, safeBottom: 0 };
        const tall: Box = { left: 456, top: 12, width: 898, height: 696 };
        expect(achievementSpot(short, tall, undefined, [], undefined)).toEqual({
            x: 456 + 222,
            y: 600 - BOTTOM_GAP,
        });
    });

    test("centred at the window's bottom, above any toast, when the middle panel is hidden", () => {
        expect(achievementSpot(window, hidden, undefined, [], undefined)).toEqual({
            x: 700,
            y: 900 - WINDOW_INSET,
        });
        expect(achievementSpot(window, undefined, undefined, [], 56).y).toBe(
            900 - WINDOW_INSET - 56 - BOTTOM_GAP,
        );
        expect(
            achievementSpot({ ...window, safeBottom: 34 }, undefined, undefined, [], undefined).y,
        ).toBe(900 - 34 - WINDOW_INSET);
    });
});

describe("in a short window with a tall popup open", () => {
    // a 600px window: the composer at 530, the emoji picker's top at 130 above it
    const short = { width: 1400, height: 600, safeBottom: 0 };
    const shortMiddle: Box = { left: 456, top: 12, width: 932, height: 576 };
    const shortComposer: Box = { left: 456, top: 530, width: 932, height: 58 };
    const tallPicker: Box = { left: 472, top: 130, width: 360, height: 392 };

    test("the achievement stays whole below the window's top, over the toast if it must", () => {
        // above a 56px toast it would end at 130 - 12 - 56 - 12 = 50, its 64px card cut off
        const spot = achievementSpot(short, shortMiddle, shortComposer, [tallPicker], 56);
        expect(spot.y).toBe(ACHIEVEMENT_HEIGHT + BOTTOM_GAP);
    });

    test("the toasts stay whole below the window's top", () => {
        const higher: Box = { ...tallPicker, top: 40 };
        expect(toastSpot(short, shortMiddle, shortComposer, [higher], 56).y).toBe(56 + BOTTOM_GAP);
        // with room, the height changes nothing
        expect(toastSpot(short, shortMiddle, shortComposer, [tallPicker], 56).y).toBe(
            130 - BOTTOM_GAP,
        );
    });
});
