import { ACHIEVEMENT_GAP, achievementSpot, type Box } from "./achievementPlacement";

const window = { width: 1400, height: 900 };
// the middle panel beside a 350px list: 456px to 1388px across, 12px to 888px down
const middle: Box = { left: 456, top: 12, width: 932, height: 876 };
// a composer 70px tall at the middle's bottom
const composer: Box = { left: 456, top: 818, width: 932, height: 70 };
// a toast, centred on the window, 24px over its bottom
const toast: Box = { left: 0, top: 820, width: 1400, height: 56 };
// two toasts, one above the other
const twoToasts: Box = { left: 0, top: 756, width: 1400, height: 120 };

describe("where the achievement toast plays", () => {
    test("just above the composer, centred in the middle panel", () => {
        expect(achievementSpot(window, middle, composer, undefined)).toEqual({
            x: 922,
            y: 818 - ACHIEVEMENT_GAP,
        });
    });

    test("just above the middle panel's bottom where there's no composer", () => {
        expect(achievementSpot(window, middle, undefined, undefined)).toEqual({
            x: 922,
            y: 888 - ACHIEVEMENT_GAP,
        });
    });

    test("a composer that isn't showing (no box) is no composer", () => {
        const hidden: Box = { left: 0, top: 0, width: 0, height: 0 };
        expect(achievementSpot(window, middle, hidden, undefined).y).toBe(888 - ACHIEVEMENT_GAP);
    });

    test("above a toast showing, whose top is above the composer's", () => {
        const higher: Box = { ...toast, top: 800 };
        expect(achievementSpot(window, middle, composer, higher)).toEqual({
            x: 922,
            y: 800 - ACHIEVEMENT_GAP,
        });
    });

    test("above the composer where a toast's top is below the composer's", () => {
        expect(achievementSpot(window, middle, composer, toast).y).toBe(818 - ACHIEVEMENT_GAP);
    });

    test("above the toast where there's no composer", () => {
        expect(achievementSpot(window, middle, undefined, toast).y).toBe(820 - ACHIEVEMENT_GAP);
    });

    test("above the highest of two toasts", () => {
        expect(achievementSpot(window, middle, composer, twoToasts).y).toBe(756 - ACHIEVEMENT_GAP);
    });

    test("back down to the composer once the toast has gone", () => {
        expect(achievementSpot(window, middle, composer, twoToasts).y).toBeLessThan(
            achievementSpot(window, middle, composer, undefined).y,
        );
    });

    test("follows the middle panel as it narrows (a right column docking)", () => {
        const narrower: Box = { ...middle, width: 532 };
        expect(achievementSpot(window, narrower, composer, undefined).x).toBe(456 + 266);
    });

    test("centred at the window's bottom when the middle panel is hidden (narrow, on the list)", () => {
        const hidden: Box = { left: 0, top: 0, width: 0, height: 0 };
        expect(achievementSpot(window, hidden, undefined, undefined)).toEqual({
            x: 700,
            y: 900 - ACHIEVEMENT_GAP,
        });
        expect(achievementSpot(window, undefined, undefined, toast).y).toBe(820 - ACHIEVEMENT_GAP);
    });
});
