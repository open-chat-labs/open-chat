import { createRawSnippet, flushSync, mount, unmount } from "svelte";
import { installMatchMedia, setViewportWidth } from "../testing/viewport";
import Shell from "./Shell.svelte";

const region = (name: string) =>
    createRawSnippet(() => ({ render: () => `<div data-region="${name}">${name}</div>` }));

installMatchMedia();

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
        setViewportWidth(width);
        app = mount(Shell, {
            target,
            props: {
                rail: region("rail"),
                left: region("left"),
                middle: region("middle"),
                right: region("right"),
                rightOpen: false,
                onCloseRight: () => {},
                rightLabel: "Details",
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
        setViewportWidth(1100);
        expect([shell().dataset.rail, shell().dataset.list]).toEqual(["float", "fixed"]);
        expect(shell().style.getPropertyValue("--shell-right-width")).toBe("375px");
    });

    test("docks the right column from 1476px, and opens it as a modal below", () => {
        show(1476, { rightOpen: true });
        expect(target.querySelector(".right")).not.toBeNull();
        expect(target.querySelector("[role=dialog]")).toBeNull();
        setViewportWidth(1475);
        expect(target.querySelector(".right")).toBeNull();
        expect(target.querySelector("[role=dialog] [data-region=right]")).not.toBeNull();
    });

    test("the modal has an accessible name", () => {
        show(1200, { rightOpen: true, rightLabel: "Group details" });
        expect(target.querySelector("[role=dialog]")!.getAttribute("aria-label")).toBe(
            "Group details",
        );
    });

    test("leaves the right column out when the screen has none", () => {
        show(1200, { right: undefined, rightOpen: true });
        expect(target.querySelector("[role=dialog]")).toBeNull();
    });

    test("the rail starts collapsed again when it switches between pushing and floating", () => {
        let mounts = 0;
        const rail = createRawSnippet(() => ({
            render: () => `<div data-region="rail">rail</div>`,
            setup: () => {
                mounts++;
            },
        }));
        show(1900, { rail });
        expect(mounts).toBe(1);
        setViewportWidth(1500);
        expect(mounts).toBe(2);
        // crossings that leave the rail pushing or floating keep it as it is
        setViewportWidth(1300);
        setViewportWidth(1000);
        expect(mounts).toBe(2);
        setViewportWidth(1876);
        expect(mounts).toBe(3);
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
        setViewportWidth(768);
        expect(shell().dataset.narrow).toBeUndefined();
    });

    test("a narrow screen without a left column shows the middle", () => {
        show(767, { left: undefined });
        expect(shell().dataset.narrow).toBe("middle");
    });
});
