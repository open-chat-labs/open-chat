import { createRawSnippet, flushSync, mount, unmount } from "svelte";
import Shell from "./Shell.svelte";

const region = (name: string) =>
    createRawSnippet(() => ({ render: () => `<div data-region="${name}">${name}</div>` }));

function setWidth(width: number) {
    Object.defineProperty(window, "innerWidth", { value: width, configurable: true });
    window.dispatchEvent(new Event("resize"));
    flushSync();
}

describe("the shell", () => {
    let target: HTMLElement;
    let app: object | undefined;

    beforeEach(() => {
        target = document.body.appendChild(document.createElement("div"));
    });

    afterEach(() => {
        if (app) unmount(app);
        app = undefined;
        target.remove();
    });

    function show(width: number, props: Record<string, unknown> = {}) {
        setWidth(width);
        app = mount(Shell, {
            target,
            props: {
                rail: region("rail"),
                left: region("left"),
                middle: region("middle"),
                right: region("right"),
                ...props,
            },
        });
        flushSync();
    }

    const shell = () => target.querySelector<HTMLElement>(".shell")!;
    const has = (name: string) => target.querySelector(`[data-region="${name}"]`) !== null;

    test("places the rail, left and middle columns, and the right one when open", () => {
        show(1600, { rightOpen: true });
        expect(["rail", "left", "middle", "right"].map(has)).toEqual([true, true, true, true]);
        expect(target.querySelector(".right")).not.toBeNull();
    });

    test("leaves the right column out when it's closed", () => {
        show(1600);
        expect(has("right")).toBe(false);
    });

    test("follows the breakpoints as the window resizes", () => {
        show(1900);
        expect([shell().dataset.rail, shell().dataset.list]).toEqual(["push", "fluid"]);
        setWidth(1100);
        expect([shell().dataset.rail, shell().dataset.list]).toEqual(["float", "fixed"]);
        expect(shell().style.getPropertyValue("--shell-right-width")).toBe("375px");
    });

    test("docks the right column from 1476px, and opens it as a modal below", () => {
        show(1476, { rightOpen: true });
        expect(target.querySelector(".right")).not.toBeNull();
        expect(target.querySelector("[role=dialog]")).toBeNull();
        setWidth(1475);
        expect(target.querySelector(".right")).toBeNull();
        expect(target.querySelector("[role=dialog] [data-region=right]")).not.toBeNull();
    });

    test("the modal closes from its backdrop and from Esc", () => {
        const onCloseRight = vi.fn();
        show(1200, { rightOpen: true, onCloseRight });
        target.querySelector<HTMLElement>(".scrim")!.click();
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
        expect(onCloseRight).toHaveBeenCalledTimes(2);
    });

    test("shows one column at a time below 768px", () => {
        show(767);
        expect(shell().dataset.narrow).toBe("left");
        unmount(app!);
        show(767, { narrowView: "middle" });
        expect(shell().dataset.narrow).toBe("middle");
        setWidth(768);
        expect(shell().dataset.narrow).toBeUndefined();
    });

    test("a narrow screen without a left column shows the middle", () => {
        show(767, { left: undefined });
        expect(shell().dataset.narrow).toBe("middle");
    });
});
