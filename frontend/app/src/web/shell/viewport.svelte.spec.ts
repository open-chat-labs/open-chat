import { flushSync } from "svelte";
import { clearShellWidth, currentShellLayout, setShellWidth } from "./viewport.svelte";

describe("the current shell layout", () => {
    let cleanup = () => {};
    afterEach(() => {
        cleanup();
        clearShellWidth();
    });

    // How many times a reader of the layout ran, and what it last saw
    function watch() {
        const seen = { runs: 0, rail: "" };
        cleanup = $effect.root(() => {
            $effect(() => {
                seen.rail = currentShellLayout().rail;
                seen.runs++;
            });
        });
        flushSync();
        return seen;
    }

    const resize = (width: number) => {
        setShellWidth(width);
        flushSync();
    };

    test("follows the shell's width across a breakpoint", () => {
        resize(1800);
        const seen = watch();
        expect(seen.rail).toBe("float");
        resize(1900);
        expect(seen.rail).toBe("push");
    });

    test("doesn't re-run its readers on resizes between breakpoints", () => {
        resize(1300);
        const seen = watch();
        for (const width of [1310, 1350, 1400, 1450, 1475]) resize(width);
        expect(seen.runs).toBe(1);
        resize(1476);
        expect(seen.runs).toBe(2);
    });

    test("before the shell reports a width, takes the page's, at least the shell's minimum", () => {
        const width = vi.spyOn(document.documentElement, "clientWidth", "get");
        width.mockReturnValue(1500);
        expect(currentShellLayout().right).toBe("dock");
        // a scrollbar narrows the page, and the shell, below the docking width
        width.mockReturnValue(1490);
        expect(currentShellLayout().right).toBe("modal");
        // the shell is never narrower than its minimum, so never one column
        width.mockReturnValue(600);
        expect(currentShellLayout().narrow).toBe(false);
        width.mockRestore();
    });

    test("starts from the page's width again once the shell has gone", () => {
        resize(1900);
        clearShellWidth();
        const width = vi.spyOn(document.documentElement, "clientWidth", "get");
        width.mockReturnValue(1300);
        expect(currentShellLayout().rail).toBe("float");
        width.mockRestore();
    });
});
