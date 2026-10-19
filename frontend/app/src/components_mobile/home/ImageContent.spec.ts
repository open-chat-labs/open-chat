import type { ImageContent as ImageContentType } from "@client";
import { flushSync, mount, unmount } from "svelte";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// utils/devices.ts queries matchMedia when imported, and the component-lib
// Container observes its size; jsdom has neither.
vi.hoisted(() => {
    window.matchMedia = (query: string) =>
        ({
            matches: false,
            media: query,
            addEventListener() {},
            removeEventListener() {},
        }) as never;
    window.ResizeObserver = class {
        observe() {}
        unobserve() {}
        disconnect() {}
    } as never;
});

import { lowBandwidth } from "../../stores/settings";
import ImageContent from "./ImageContent.svelte";

const thumbnail = "data:image/gif;base64,R0lGODlhAQABAAAAACw=";
const fullSize = "https://example.com/full-size.png";

const content: ImageContentType = {
    kind: "image_content",
    width: 1600,
    height: 140,
    mimeType: "image/png",
    thumbnailData: thumbnail,
    blobUrl: fullSize,
};

// Svelte writes a dynamic `src` with setAttribute, so wrapping it records every
// url the <img> is ever given, including ones a later write replaces.
function recordSrcWrites(): string[] {
    const writes: string[] = [];
    const original = Element.prototype.setAttribute;
    Element.prototype.setAttribute = function (name: string, value: string) {
        if (name === "src") writes.push(value);
        return original.call(this, name, value);
    };
    return writes;
}

describe("ImageContent.svelte (mobile) in low bandwidth mode", () => {
    const setAttribute = Element.prototype.setAttribute;
    let target: HTMLElement;
    let app: object | undefined;

    beforeEach(() => {
        lowBandwidth.set(true);
        target = document.createElement("div");
        document.body.appendChild(target);
    });

    afterEach(() => {
        if (app !== undefined) unmount(app);
        target.remove();
        Element.prototype.setAttribute = setAttribute;
        lowBandwidth.set(false);
    });

    // WebKit starts fetching an <img> as soon as its src is set, so the full-size
    // url must never reach the element until the user reveals the image, not even
    // for a render that a later one replaces.
    test("never gives the img the full-size url before the image is revealed", () => {
        const writes = recordSrcWrites();
        app = mount(ImageContent, {
            target,
            props: { content, me: false, fill: false, edited: false },
        });
        flushSync();

        const img = target.querySelector("img")!;
        expect(img.getAttribute("src")).toBe(thumbnail);
        expect(writes).not.toContain(fullSize);
    });

    test("shows the full-size image once revealed", () => {
        app = mount(ImageContent, {
            target,
            props: { content, me: false, fill: false, edited: false },
        });
        flushSync();

        target.querySelector("button")!.click();
        flushSync();

        expect(target.querySelector("img")!.getAttribute("src")).toBe(fullSize);
        expect(target.querySelector("button")).toBeNull();
    });
});
