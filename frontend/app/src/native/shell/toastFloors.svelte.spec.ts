import { ToastFloors } from "./toastFloors.svelte";

describe("where toasts sit over a screen", () => {
    test("is the floor the screen set, until it takes it back", () => {
        const floors = new ToastFloors();
        const conversation = floors.for("chat:a");
        expect(floors.of("chat:a")).toBeUndefined();
        conversation(120);
        expect(floors.of("chat:a")).toBe(120);
        conversation(400);
        expect(floors.of("chat:a")).toBe(400);
        conversation(undefined);
        expect(floors.of("chat:a")).toBeUndefined();
    });

    test("is each screen's own: one under the top doesn't move the top's", () => {
        const floors = new ToastFloors();
        floors.for("chat:a")(120);
        floors.for("chat:b")(300);
        expect(floors.of("chat:b")).toBe(300);
        expect(floors.of("chat:a")).toBe(120);
        expect(floors.of(undefined)).toBeUndefined();
    });

    test("isn't taken back by a screen going for another at the same key", () => {
        const floors = new ToastFloors();
        const going = floors.for("chat:a");
        const coming = floors.for("chat:a");
        going(120);
        coming(200);
        going(undefined);
        expect(floors.of("chat:a")).toBe(200);
    });
});
