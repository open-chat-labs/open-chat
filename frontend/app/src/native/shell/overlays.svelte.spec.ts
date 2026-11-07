import { flushSync } from "svelte";
import { Overlays, useOverlay } from "./overlays.svelte";

describe("what's open over the screens", () => {
    test("closes the one opened last first", () => {
        const overlays = new Overlays();
        const closed: string[] = [];
        overlays.add(() => closed.push("sheet"));
        overlays.add(() => closed.push("menu"));
        expect(overlays.any).toBe(true);
        expect(overlays.closeTop()).toBe(true);
        expect(closed).toEqual(["menu"]);
        expect(overlays.closeTop()).toBe(true);
        expect(closed).toEqual(["menu", "sheet"]);
        expect(overlays.any).toBe(false);
    });

    test("has nothing to close when nothing's open", () => {
        expect(new Overlays().closeTop()).toBe(false);
    });

    test("forgets one that closed by itself", () => {
        const overlays = new Overlays();
        const closed: string[] = [];
        overlays.add(() => closed.push("sheet"));
        const unregister = overlays.add(() => closed.push("menu"));
        unregister();
        overlays.closeTop();
        expect(closed).toEqual(["sheet"]);
    });

    test("leaves one open while it's busy, and back is used up", () => {
        const overlays = new Overlays();
        const closed: string[] = [];
        let busy = true;
        overlays.add(() => closed.push("screen's sheet"));
        overlays.add(
            () => closed.push("deleting"),
            () => busy,
        );
        expect(overlays.closeTop()).toBe(true);
        expect(closed).toEqual([]);
        expect(overlays.closeTop()).toBe(true);
        expect(closed).toEqual([]);
        busy = false;
        expect(overlays.closeTop()).toBe(true);
        expect(closed).toEqual(["deleting"]);
        expect(overlays.closeTop()).toBe(true);
        expect(closed).toEqual(["deleting", "screen's sheet"]);
    });

    test("keeps a component's overlay registered while it's open", () => {
        const overlays = new Overlays();
        const sheet = $state({ open: false });
        const cleanup = $effect.root(() => {
            useOverlay(
                overlays,
                () => sheet.open,
                () => (sheet.open = false),
            );
        });
        flushSync();
        expect(overlays.any).toBe(false);
        sheet.open = true;
        flushSync();
        expect(overlays.any).toBe(true);
        // system back closes it, through its own close
        overlays.closeTop();
        flushSync();
        expect(sheet.open).toBe(false);
        expect(overlays.any).toBe(false);
        // and it goes with the component
        sheet.open = true;
        flushSync();
        cleanup();
        expect(overlays.any).toBe(false);
    });
});
