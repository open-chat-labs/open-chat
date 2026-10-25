import { beforeAll, describe, expect, test, vi } from "vitest";

describe("cash-tag", () => {
    beforeAll(async () => {
        await import("./cashTag");
    });

    function connect(html: string): HTMLElement {
        const host = document.createElement("div");
        host.innerHTML = html;
        document.body.appendChild(host);
        return host.firstElementChild as HTMLElement;
    }

    test("keeps the symbol as its text, and the price out of it", () => {
        const el = connect(
            `<cash-tag data-ledger="l-1" data-price="$0.0281" suppress-links="false">$CHAT</cash-tag>`,
        );
        expect(el.textContent).toBe("$CHAT");
        const css = [...document.head.querySelectorAll("style")].map((s) => s.textContent).join("");
        expect(css).toContain(`cash-tag[data-price]::after`);
    });

    test("clicking or pressing Enter raises cashtag-clicked unless suppressed", () => {
        const el = connect(`<cash-tag data-ledger="l-1" suppress-links="false">$CHAT</cash-tag>`);
        const handler = vi.fn();
        el.addEventListener("cashtag-clicked", handler);
        el.click();
        el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
        expect(handler).toHaveBeenCalledTimes(2);
        expect(handler.mock.calls[0][0].detail).toEqual({ ledger: "l-1" });
        expect(el.getAttribute("role")).toBe("button");

        const suppressed = connect(
            `<cash-tag data-ledger="l-1" suppress-links="true">$CHAT</cash-tag>`,
        );
        const handler2 = vi.fn();
        suppressed.addEventListener("cashtag-clicked", handler2);
        suppressed.click();
        expect(handler2).not.toHaveBeenCalled();
        expect(suppressed.hasAttribute("role")).toBe(false);
    });

    test("the event bubbles to the page", () => {
        const el = connect(`<cash-tag data-ledger="l-2" suppress-links="false">$ICP</cash-tag>`);
        const handler = vi.fn();
        document.body.addEventListener("cashtag-clicked", handler);
        el.click();
        document.body.removeEventListener("cashtag-clicked", handler);
        expect(handler.mock.calls[0][0].detail).toEqual({ ledger: "l-2" });
    });
});
