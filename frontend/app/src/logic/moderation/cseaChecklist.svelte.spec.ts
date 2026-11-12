import {
    CseaChecklist,
    cseaStorageKey,
    ncaCallRequired,
    outsideNcaHours,
    showsCseaChecklist,
    ukHour,
    ukTime,
} from "./cseaChecklist.svelte";

function memoryStorage(): Pick<Storage, "getItem" | "setItem"> & { items: Map<string, string> } {
    const items = new Map<string, string>();
    return {
        items,
        getItem: (key) => items.get(key) ?? null,
        setItem: (key, value) => void items.set(key, value),
    };
}

describe("who sees the checklist", () => {
    test("the CSEA checklist content renders only for platform moderators or operators", () => {
        expect(showsCseaChecklist(true, false)).toBe(true);
        expect(showsCseaChecklist(false, true)).toBe(true);
        expect(showsCseaChecklist(true, true)).toBe(true);
        expect(showsCseaChecklist(false, false)).toBe(false);
    });
});

describe("the NCA call rule", () => {
    test("a call is required exactly for Priority 1 or 2 when the UK hour is before 07 or from 17", () => {
        for (let hour = 0; hour < 24; hour++) {
            const outside = hour < 7 || hour >= 17;
            expect(outsideNcaHours(hour)).toBe(outside);
            expect(ncaCallRequired(1, hour)).toBe(outside);
            expect(ncaCallRequired(2, hour)).toBe(outside);
            expect(ncaCallRequired(3, hour)).toBe(false);
            expect(ncaCallRequired(undefined, hour)).toBe(false);
        }
    });

    test("goes by the time in the UK, summer time included", () => {
        // 16:30 UTC in July is 17:30 in London (BST); in January it's 16:30 (GMT)
        expect(ukHour(new Date("2026-07-01T16:30:00Z"))).toBe(17);
        expect(ukTime(new Date("2026-07-01T16:30:00Z"))).toBe("17:30");
        expect(ukHour(new Date("2026-01-15T16:30:00Z"))).toBe(16);
        // midnight is hour 0, never 24
        expect(ukHour(new Date("2026-01-15T00:10:00Z"))).toBe(0);
        expect(ukTime(new Date("2026-01-15T00:10:00Z"))).toBe("00:10");
    });

    test("a checklist needs the call from its priority and the time it's asked at", () => {
        const checklist = new CseaChecklist(undefined, memoryStorage());
        const evening = new Date("2026-01-15T18:00:00Z");
        const day = new Date("2026-01-15T10:00:00Z");
        expect(checklist.callRequired(evening)).toBe(false);
        checklist.setPriority(2);
        expect(checklist.callRequired(evening)).toBe(true);
        expect(checklist.callRequired(day)).toBe(false);
        checklist.setPriority(3);
        expect(checklist.callRequired(evening)).toBe(false);
    });
});

describe("a report's checklist progress", () => {
    test("is kept per report, or as ad hoc without one", () => {
        expect(cseaStorageKey("42")).toBe("csea_checklist_42");
        expect(cseaStorageKey(undefined)).toBe("csea_checklist_adhoc");
    });

    test("checklist progress saved for one ?report= id is restored for that id and no other", () => {
        const storage = memoryStorage();
        const first = new CseaChecklist("1", storage);
        first.setOrigin("manual");
        first.setPriority(1);
        first.toggle("prep-reviewer");
        first.toggle("gen-prev");

        const again = new CseaChecklist("1", storage);
        expect(again.origin).toBe("manual");
        expect(again.priority).toBe(1);
        expect(again.isTicked("prep-reviewer")).toBe(true);
        expect(again.tickedCount).toBe(2);

        for (const other of [
            new CseaChecklist("2", storage),
            new CseaChecklist(undefined, storage),
        ]) {
            expect(other.origin).toBeUndefined();
            expect(other.priority).toBeUndefined();
            expect(other.tickedCount).toBe(0);
        }
    });

    test("untick and reset are kept too", () => {
        const storage = memoryStorage();
        const checklist = new CseaChecklist("7", storage);
        checklist.toggle("a");
        checklist.toggle("a");
        expect(new CseaChecklist("7", storage).isTicked("a")).toBe(false);

        checklist.setOrigin("hash");
        checklist.toggle("b");
        checklist.reset();
        const restored = new CseaChecklist("7", storage);
        expect(restored.origin).toBeUndefined();
        expect(restored.tickedCount).toBe(0);
    });

    test("starts afresh from corrupt or missing storage", () => {
        const storage = memoryStorage();
        storage.items.set(cseaStorageKey("9"), "{not json");
        expect(new CseaChecklist("9", storage).tickedCount).toBe(0);

        const none = new CseaChecklist("9", undefined);
        none.toggle("a");
        expect(none.isTicked("a")).toBe(true);
    });
});
