import { describe, expect, test } from "vitest";
import { guardsLeaving } from "./editorBack";

// Android's back over a settings editor and the screens pushed on it, as the shell runs it: an open
// overlay closes first (the newest), else the top screen pops (shell/back.ts). The editor's
// overlays are its guard (guardsLeaving) and, once that's asked, "Discard changes?".
function simulate(screens: string[], changed: boolean, presses: number): string[] {
    const stack = [...screens];
    let discarding = false;
    const log: string[] = [];
    for (let i = 0; i < presses && stack.length > 0; i++) {
        const onTop = stack[stack.length - 1] === "editor";
        if (discarding) {
            discarding = false;
            log.push("close discard");
        } else if (guardsLeaving({ onTop, changed, discarding, busy: false })) {
            discarding = true;
            log.push("ask discard");
        } else {
            log.push(`pop ${stack.pop()}`);
        }
    }
    return log;
}

describe("Android's back over a settings editor", () => {
    test("with changes: each gate entries screen pops, then the editor asks", () => {
        expect(simulate(["editor", "list", "pick", "value"], true, 6)).toEqual([
            "pop value",
            "pop pick",
            "pop list",
            "ask discard",
            "close discard",
            "ask discard",
        ]);
    });

    test("without changes: it pops all the way, the editor too", () => {
        expect(simulate(["editor", "list", "value"], false, 3)).toEqual([
            "pop value",
            "pop list",
            "pop editor",
        ]);
    });

    test("the guard only while the editor is on top, changed, not asking and not saving", () => {
        const base = { onTop: true, changed: true, discarding: false, busy: false };
        expect(guardsLeaving(base)).toBe(true);
        expect(guardsLeaving({ ...base, onTop: false })).toBe(false);
        expect(guardsLeaving({ ...base, changed: false })).toBe(false);
        expect(guardsLeaving({ ...base, discarding: true })).toBe(false);
        expect(guardsLeaving({ ...base, busy: true })).toBe(false);
    });
});
