import { describe, expect, test, vi } from "vitest";
import { ADMIN_SECTIONS } from "./adminSections";
import { ConsoleLoads, loadsAfter, loadsOnOpen, type ConsoleLoad } from "./consoleLoads";

function loads() {
    const calls: ConsoleLoad[] = [];
    const resolvers: (() => void)[] = [];
    const loader = (what: ConsoleLoad) => () => {
        calls.push(what);
        return new Promise<void>((resolve) => resolvers.push(resolve));
    };
    const console = new ConsoleLoads({
        proposals: loader("proposals"),
        reports: loader("reports"),
        operatorConfig: loader("operatorConfig"),
    });
    return { console, calls, settle: () => resolvers.splice(0).forEach((r) => r()) };
}

describe("what a section reads as it opens", () => {
    test("Pending proposals reads the proposals, as the old tab did on mounting", () => {
        expect(loadsOnOpen("proposals")).toEqual(["proposals"]);
    });

    test("Authority reports reads the register", () => {
        expect(loadsOnOpen("reports")).toEqual(["reports"]);
    });

    test("every operator functions section reads the settings it shows", () => {
        for (const id of ["infrastructure", "money", "moderation", "integrations"] as const) {
            expect(loadsOnOpen(id)).toEqual(["operatorConfig"]);
        }
    });

    test("the Danger zone reads the settings and the proposals for its banner", () => {
        expect(loadsOnOpen("danger")).toEqual(["operatorConfig", "proposals"]);
    });

    test("the sections that read their own as they mount need nothing more", () => {
        for (const id of ["puzzle", "translations", "vault"] as const) {
            expect(loadsOnOpen(id)).toEqual([]);
        }
    });

    test("every section has an answer", () => {
        for (const s of ADMIN_SECTIONS) expect(Array.isArray(loadsOnOpen(s.id))).toBe(true);
    });
});

describe("what an outcome reads again", () => {
    test("a proposal reads the pending proposals again", () => {
        expect(loadsAfter("proposed")).toEqual(["proposals"]);
    });

    test("anything else reads nothing", () => {
        expect(loadsAfter("success")).toEqual([]);
        expect(loadsAfter("failed")).toEqual([]);
        expect(loadsAfter(undefined)).toEqual([]);
    });
});

describe("ConsoleLoads", () => {
    test("opening a section runs its reads", async () => {
        const { console, calls, settle } = loads();
        const opened = console.sectionOpened("danger");
        expect(calls).toEqual(["operatorConfig", "proposals"]);
        settle();
        await opened;
    });

    test("opening it again reads again", async () => {
        const { console, calls, settle } = loads();
        const first = console.sectionOpened("money");
        settle();
        await first;
        const second = console.sectionOpened("money");
        settle();
        await second;
        expect(calls).toEqual(["operatorConfig", "operatorConfig"]);
    });

    test("a read already under way is shared, not run twice", async () => {
        const { console, calls, settle } = loads();
        const panel = console.load("proposals");
        const section = console.sectionOpened("proposals");
        expect(calls).toEqual(["proposals"]);
        settle();
        await Promise.all([panel, section]);
    });

    test("a proposal that went through reads the proposals again", async () => {
        const { console, calls, settle } = loads();
        const after = console.outcomeRecorded("proposed");
        expect(calls).toEqual(["proposals"]);
        settle();
        await after;
        await console.outcomeRecorded("success");
        expect(calls).toEqual(["proposals"]);
    });

    test("a loader that isn't async still runs", async () => {
        const run = vi.fn();
        const console = new ConsoleLoads({
            proposals: async () => undefined,
            reports: async () => undefined,
            operatorConfig: run,
        });
        await console.sectionOpened("integrations");
        await console.sectionOpened("integrations");
        expect(run).toHaveBeenCalledTimes(2);
    });
});
