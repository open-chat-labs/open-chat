import { RightColumnState } from "./rightColumn.svelte";

describe("the right column's open state", () => {
    afterEach(() => {
        localStorage.clear();
        vi.restoreAllMocks();
    });

    test("docked, it starts open", () => {
        expect(new RightColumnState().isOpen("dock")).toBe(true);
    });

    test("docked, closing it is remembered for the next visit", () => {
        new RightColumnState().setOpen("dock", false);
        expect(new RightColumnState().isOpen("dock")).toBe(false);
        new RightColumnState().toggle("dock");
        expect(new RightColumnState().isOpen("dock")).toBe(true);
    });

    test("as a modal, it starts closed and isn't remembered", () => {
        const state = new RightColumnState();
        expect(state.isOpen("modal")).toBe(false);
        state.toggle("modal");
        expect(state.isOpen("modal")).toBe(true);
        expect(new RightColumnState().isOpen("modal")).toBe(false);
    });

    test("opening the modal leaves the docked preference alone", () => {
        const state = new RightColumnState();
        state.setOpen("dock", false);
        state.setOpen("modal", true);
        expect(state.isOpen("dock")).toBe(false);
    });

    test("works without localStorage", () => {
        vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
            throw new Error("denied");
        });
        vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
            throw new Error("denied");
        });
        const state = new RightColumnState();
        expect(state.isOpen("dock")).toBe(true);
        state.setOpen("dock", false);
        expect(state.isOpen("dock")).toBe(false);
    });
});
