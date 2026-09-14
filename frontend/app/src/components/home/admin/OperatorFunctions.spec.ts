import { flushSync, mount, unmount } from "svelte";
import { afterEach, describe, expect, test, vi } from "vitest";

// A store the client package builds at import time reads the screen width through matchMedia,
// which jsdom does not provide; stub it before the component (and so the client) is imported
vi.hoisted(() => {
    window.matchMedia = ((query: string) =>
        ({
            matches: false,
            media: query,
            addEventListener: () => {},
            removeEventListener: () => {},
            addListener: () => {},
            removeListener: () => {},
            onchange: null,
            dispatchEvent: () => false,
        }) as unknown as MediaQueryList) as typeof window.matchMedia;
});

import type { OpenChat } from "@client";
import OperatorFunctions from "./OperatorFunctions.svelte";

// Every client method the page calls on mount answers with something harmless; the daily
// puzzle section gets a real config so it renders its controls
function fakeClient(): OpenChat {
    const known: Record<string, unknown> = {
        moderationConfig: vi.fn(async () => undefined),
        diamondMembershipFees: vi.fn(async () => []),
        toRecord: () => ({}),
        // the fees form indexes these by token, so both rows have to exist
        toRecord2: () => ({
            ICP: { token: "ICP", oneMonth: "", threeMonths: "", oneYear: "", lifetime: "" },
            CHAT: { token: "CHAT", oneMonth: "", threeMonths: "", oneYear: "", lifetime: "" },
        }),
        dailyPuzzleConfig: vi.fn(async () => ({
            enabled: true,
            entryFee: 100,
            firstPlayFree: true,
            rewardByStreak: [250],
            hintPenalty: 50,
            minCardedSolveMs: 10_000n,
            maxSubmits: 20,
            maxFreeChecks: 20,
        })),
    };
    return new Proxy(known, {
        get: (target, prop) =>
            typeof prop === "symbol"
                ? undefined
                : prop in target
                  ? target[prop]
                  : () => Promise.resolve(undefined),
    }) as unknown as OpenChat;
}

describe("operator functions (#9368)", () => {
    let app: ReturnType<typeof mount> | undefined;
    afterEach(() => {
        if (app !== undefined) unmount(app);
        document.body.innerHTML = "";
    });

    // invariant 2
    test("renders the daily puzzle enabled toggle and the regenerate control", async () => {
        const target = document.createElement("div");
        document.body.appendChild(target);
        app = mount(OperatorFunctions, {
            target,
            context: new Map<string, unknown>([["client", fakeClient()]]),
        });
        flushSync();
        // the section fills in once the config call resolves
        await new Promise((r) => setTimeout(r, 0));
        flushSync();

        const headings = [...target.querySelectorAll("h3")].map((h) => h.textContent?.trim());
        expect(headings).toContain("Daily puzzle");
        expect(target.querySelector("#daily-puzzle-enabled")).not.toBeNull();
        const buttons = [...target.querySelectorAll("button")].map((b) => b.textContent?.trim());
        expect(buttons).toContain("Regenerate");
    });
});
