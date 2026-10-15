import { flushSync, mount, unmount } from "svelte";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import LinkPreview from "./LinkPreview.svelte";

describe("LinkPreview", () => {
    let target: HTMLElement;
    let app: object;
    beforeEach(() => {
        target = document.body.appendChild(document.createElement("div"));
    });
    afterEach(() => {
        unmount(app);
        target.remove();
    });

    function show(props: Record<string, unknown>) {
        app = mount(LinkPreview, {
            target,
            props: {
                text: "",
                url: "https://a.com",
                domain: "a.com",
                title: "A",
                time: "10:00",
                ...props,
            },
        });
        flushSync();
    }
    const inline = () =>
        [...target.querySelectorAll<HTMLAnchorElement>(".text a")].map((a) => [
            a.textContent,
            a.getAttribute("href"),
        ]);

    test.each([
        "javascript:alert(1)",
        "JavaScript:alert(1)",
        "data:text/html,<script>alert(1)</script>",
        " javascript:alert(1)",
    ])("the card does not link to %s", (url) => {
        for (const size of ["large", "compact"]) {
            show({ url, size });
            expect(target.querySelector(".card")!.hasAttribute("href")).toBe(false);
            unmount(app);
        }
        show({ url });
    });

    test("the card links to an http(s) URL", () => {
        show({ url: "https://github.com/open-chat-labs" });
        expect(target.querySelector(".card")!.getAttribute("href")).toBe(
            "https://github.com/open-chat-labs",
        );
    });

    test("only the URLs in the text are links, also when the text starts with one", () => {
        show({ text: "a.com b.com" });
        expect(inline()).toEqual([
            ["a.com", "https://a.com"],
            ["b.com", "https://b.com"],
        ]);
        expect(target.querySelector(".text")!.textContent).toBe("a.com b.com");
    });

    test("text around a URL stays text", () => {
        show({ text: "see http://x.org/p now" });
        expect(inline()).toEqual([["http://x.org/p", "http://x.org/p"]]);
        expect(target.querySelector(".text")!.textContent).toBe("see http://x.org/p now");
    });
});
