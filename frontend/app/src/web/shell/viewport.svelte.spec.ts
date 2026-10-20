import { flushSync } from "svelte";
import { currentShellLayout, setShellWidth } from "./viewport.svelte";

describe("the current shell layout", () => {
    let cleanup = () => {};
    afterEach(() => cleanup());

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
});
