import { customEmojis } from "@client";
import { beforeAll, describe, expect, test } from "vitest";

describe("custom-emoji", () => {
    beforeAll(async () => {
        customEmojis.set("abc", { code: "abc", url: "https://x/abc.png" } as never);
        await import("./customEmoji");
    });

    function connect(html: string): { host: HTMLElement; el: HTMLElement } {
        const host = document.createElement("div");
        host.innerHTML = html;
        document.body.appendChild(host);
        return { host, el: host.firstElementChild as HTMLElement };
    }

    test("renders the emoji image in a shadow root", () => {
        const { el } = connect(`<custom-emoji data-id="abc">junk</custom-emoji>`);
        const img = el.shadowRoot!.querySelector("img")!;
        expect(img.getAttribute("src")).toBe("https://x/abc.png");
        expect(img.alt).toBe("abc");
        expect(el.innerHTML).toBe("");
        expect(el.contentEditable).toBe("false");
    });

    test("unknown emoji removes itself", () => {
        const { host } = connect(`<custom-emoji data-id="nope"></custom-emoji>`);
        expect(host.childElementCount).toBe(0);
    });

    test("re-connecting keeps a single img", () => {
        const { host, el } = connect(`<custom-emoji data-id="abc"></custom-emoji>`);
        host.removeChild(el);
        host.appendChild(el);
        expect(el.shadowRoot!.querySelectorAll("img").length).toBe(1);
    });
});
