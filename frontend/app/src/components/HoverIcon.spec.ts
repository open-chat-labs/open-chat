import { mount, unmount } from "svelte";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import Harness from "./HoverIcon.spec.harness.svelte";

describe("HoverIcon", () => {
    let log: string[];
    let app: ReturnType<typeof mount>;
    const onDocumentKeydown = (e: KeyboardEvent) => log.push(`document ${e.key}`);

    // Mounted on the body, as the app is, so that events are delegated the same way
    beforeEach(() => {
        log = [];
        document.addEventListener("keydown", onDocumentKeydown);
        app = mount(Harness, { target: document.body, props: { log } });
    });
    afterEach(() => {
        unmount(app);
        document.removeEventListener("keydown", onDocumentKeydown);
        document.body.innerHTML = "";
    });

    const icons = () => Array.from(document.querySelectorAll<HTMLElement>(".wrapper"));

    function press(el: Element, key: string, repeat = false): boolean {
        const e = new KeyboardEvent("keydown", { key, repeat, bubbles: true, cancelable: true });
        el.dispatchEvent(e);
        return e.defaultPrevented;
    }

    it("clicks for Enter, reaching a wrapper which handles the click, and the key goes no further", () => {
        expect(press(icons()[0], "Enter")).toBe(true);
        expect(log).toEqual(["wrapper"]);
    });

    it("calls onclick for Space without scrolling", () => {
        expect(press(icons()[1], " ")).toBe(true);
        expect(log).toEqual(["icon"]);
    });

    it("clicks only once while a key is held", () => {
        expect(press(icons()[1], " ", true)).toBe(true);
        expect(log).toEqual([]);
    });

    it("ignores clicks and keys while disabled", () => {
        icons()[2].click();
        expect(press(icons()[2], "Enter")).toBe(true);
        expect(log).toEqual([]);
    });

    it("leaves other keys, and keys aimed at its children, alone", () => {
        expect(press(icons()[1], "a")).toBe(false);
        expect(press(document.querySelector(".child")!, "Enter")).toBe(false);
        expect(log).not.toContain("icon");
        expect(log).not.toContain("wrapper");
        expect(log).toEqual(expect.arrayContaining(["window a", "document a", "window Enter"]));
    });
});
