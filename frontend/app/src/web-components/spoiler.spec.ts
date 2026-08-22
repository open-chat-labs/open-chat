import { beforeAll, describe, expect, test, vi } from "vitest";

describe("spoiler-span", () => {
    beforeAll(async () => {
        await import("./spoiler");
    });

    function connect(html: string): { host: HTMLElement; el: HTMLElement } {
        const host = document.createElement("div");
        host.innerHTML = html;
        document.body.appendChild(host);
        return { host, el: host.firstElementChild as HTMLElement };
    }

    function content(el: HTMLElement): HTMLElement {
        return el.shadowRoot!.querySelector(".spoiler-content") as HTMLElement;
    }

    test("copies its light DOM into a blurred shadow wrapper", () => {
        const { el } = connect(`<spoiler-span>se<b>cr</b>et</spoiler-span>`);
        expect(content(el).innerHTML).toBe("se<b>cr</b>et");
        expect(content(el).classList.contains("revealed")).toBe(false);
        expect(el.shadowRoot!.querySelectorAll(".spoiler-content").length).toBe(1);
    });

    test("click reveals once and dispatches spoiler-revealed", () => {
        const { el } = connect(`<spoiler-span>x</spoiler-span>`);
        const handler = vi.fn();
        el.addEventListener("spoiler-revealed", handler);
        content(el).click();
        content(el).click();
        expect(content(el).classList.contains("revealed")).toBe(true);
        expect((el as unknown as { revealed: boolean }).revealed).toBe(true);
        expect(handler).toHaveBeenCalledTimes(1);
    });

    test("re-connecting (virtual list recycling) does not duplicate content or lose state", () => {
        const { host, el } = connect(`<spoiler-span>x</spoiler-span>`);
        content(el).click();
        host.removeChild(el);
        host.appendChild(el);
        expect(el.shadowRoot!.querySelectorAll(".spoiler-content").length).toBe(1);
        expect(content(el).classList.contains("revealed")).toBe(true);
        const handler = vi.fn();
        el.addEventListener("spoiler-revealed", handler);
        content(el).click();
        expect(handler).not.toHaveBeenCalled();
    });
});
