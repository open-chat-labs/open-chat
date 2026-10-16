import { crossedAt, shellLayout as layoutFor } from "./layout";

const shellLayout = (width: number) => layoutFor(crossedAt(width));

describe("the shell's breakpoints", () => {
    test("one column below 768px", () => {
        expect(shellLayout(767).narrow).toBe(true);
        expect(shellLayout(768).narrow).toBe(false);
    });

    test("the chat list is fluid from 1200px", () => {
        expect(shellLayout(1199).list).toBe("fixed");
        expect(shellLayout(1200).list).toBe("fluid");
    });

    test("the right column docks from 1476px and is a modal below", () => {
        expect(shellLayout(1475).right).toBe("modal");
        expect(shellLayout(1476).right).toBe("dock");
    });

    test("the nav rail pushes the layout from 1876px and floats below", () => {
        expect(shellLayout(1875).rail).toBe("float");
        expect(shellLayout(1876).rail).toBe("push");
    });

    test("the docked right column grows 375 → 425 → 500px", () => {
        expect(shellLayout(1476).rightWidth).toBe(375);
        expect(shellLayout(1875).rightWidth).toBe(375);
        expect(shellLayout(1876).rightWidth).toBe(425);
        expect(shellLayout(2499).rightWidth).toBe(425);
        expect(shellLayout(2500).rightWidth).toBe(500);
    });

    test("the modal right column is 375px wide", () => {
        expect(shellLayout(1000).rightWidth).toBe(375);
    });
});
