import { bottomAnchor, bottomAnchorFor } from "./bottomAnchors.svelte";

function attach(name: "middle" | "composer" | "toasts", el: HTMLElement): () => void {
    const detach = bottomAnchorFor(name)(el);
    return () => detach?.();
}

describe("the achievement toast's anchors", () => {
    test("an element is the anchor while it's there", () => {
        const composer = document.createElement("div");
        const detach = attach("composer", composer);
        expect(bottomAnchor("composer")).toBe(composer);
        expect(bottomAnchor("middle")).toBeUndefined();
        detach();
        expect(bottomAnchor("composer")).toBeUndefined();
    });

    test("one going doesn't take the place of the one that replaced it", () => {
        const leaving = document.createElement("div");
        const arriving = document.createElement("div");
        const detachLeaving = attach("composer", leaving);
        const detachArriving = attach("composer", arriving);
        detachLeaving();
        expect(bottomAnchor("composer")).toBe(arriving);
        detachArriving();
        expect(bottomAnchor("composer")).toBeUndefined();
    });

    test("each anchor is its own", () => {
        const middle = document.createElement("main");
        const toasts = document.createElement("div");
        const detachMiddle = attach("middle", middle);
        const detachToasts = attach("toasts", toasts);
        expect(bottomAnchor("middle")).toBe(middle);
        expect(bottomAnchor("toasts")).toBe(toasts);
        detachToasts();
        expect(bottomAnchor("middle")).toBe(middle);
        detachMiddle();
    });
});
