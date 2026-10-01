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
function fakeClient(overrides: Record<string, unknown> = {}): OpenChat {
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
        ...overrides,
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
        // and it shows what the canister holds, not the component's default
        const toggle = target.querySelector("#daily-puzzle-enabled") as HTMLInputElement | null;
        expect(toggle).not.toBeNull();
        expect(toggle!.checked).toBe(true);
        const buttons = [...target.querySelectorAll("button")].map((b) => b.textContent?.trim());
        expect(buttons).toContain("Regenerate");
    });
});

describe("user migrations", () => {
    let app: ReturnType<typeof mount> | undefined;
    afterEach(() => {
        if (app !== undefined) unmount(app);
        document.body.innerHTML = "";
    });

    function render(overrides: Record<string, unknown>): HTMLElement {
        const target = document.createElement("div");
        document.body.appendChild(target);
        app = mount(OperatorFunctions, {
            target,
            context: new Map<string, unknown>([["client", fakeClient(overrides)]]),
        });
        flushSync();
        return target;
    }

    function section(target: HTMLElement, title: string): HTMLElement {
        const found = [...target.querySelectorAll("section")].find(
            (s) => s.querySelector(".title")?.textContent?.trim() === title,
        );
        expect(found).toBeDefined();
        return found!;
    }

    function type(input: HTMLInputElement, value: string) {
        input.value = value;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        flushSync();
    }

    test("queues the longest offline users and the users named by id", async () => {
        const userIds = ["dfdal-2uaaa-aaaaa-qaama-cai", "ryjl3-tyaaa-aaaaa-aaaba-cai"];
        const migrateUsers = vi.fn(async () => ({ kind: "success", queued: [] }));
        const target = render({ migrateUsers });
        const migrate = section(target, "Migrate users to MultiUser canisters");
        const [count, ids] = [...migrate.querySelectorAll("input")];
        const [migrateCount, migrateIds] = [...migrate.querySelectorAll("button")];

        type(count, "50");
        migrateCount.click();
        // both buttons are disabled until the first call returns
        await new Promise((r) => setTimeout(r, 0));
        flushSync();
        type(ids, ` ${userIds[0]}, ${userIds[1]} `);
        migrateIds.click();

        expect(migrateUsers.mock.calls).toEqual([
            [{ kind: "longest_offline", count: 50 }],
            [{ kind: "specific", userIds }],
        ]);
    });

    test("offers to cancel a migration which has started but not been imported", async () => {
        const userId = "dfdal-2uaaa-aaaaa-qaama-cai";
        const multiUserCanisterId = "ryjl3-tyaaa-aaaaa-aaaba-cai";
        const cancelUserMigration = vi.fn(async () => ({ kind: "success" }));
        const target = render({
            userMigration: vi.fn(async () => ({
                kind: "started",
                multiUserCanisterId,
                timestamp: 0n,
                userBytes: 1000n,
                wasmVersion: "2.0.2077",
            })),
            cancelUserMigration,
        });
        const status = section(target, "User migration status");

        type(status.querySelector("input")!, userId);
        status.querySelector("button")!.click();
        await new Promise((r) => setTimeout(r, 0));
        flushSync();

        const cancel = [...status.querySelectorAll("button")].find(
            (b) => b.textContent?.trim() === "Cancel migration",
        );
        expect(cancel).toBeDefined();
        cancel!.click();
        expect(cancelUserMigration).toHaveBeenCalledWith(userId, multiUserCanisterId);
    });
});
