import { beforeAll, describe, expect, test, vi } from "vitest";

describe("profile-link", () => {
    beforeAll(async () => {
        const template = document.createElement("template");
        template.id = "profile-link-template";
        template.setAttribute("style", "cursor: pointer; font-weight: 700");
        document.head.appendChild(template);
        await import("./profileLink");
    });

    function connect(html: string): HTMLElement {
        const host = document.createElement("div");
        host.innerHTML = html;
        document.body.appendChild(host);
        return host.firstElementChild as HTMLElement;
    }

    test("renders @name with the template's inline style", () => {
        const el = connect(`<profile-link text="alice" user-id="u-1"></profile-link>`);
        expect(el.textContent).toBe("@alice");
        expect(el.childNodes.length).toBe(1);
        expect(el.getAttribute("style")).toBe("cursor: pointer; font-weight: 700;");
    });

    test("clicking raises profile-clicked unless suppressed", () => {
        const el = connect(`<profile-link text="a" user-id="u-1" suppress-links="false"></profile-link>`);
        const handler = vi.fn();
        el.addEventListener("profile-clicked", handler);
        el.click();
        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler.mock.calls[0][0].detail).toEqual({
            userId: "u-1",
            chatButton: true,
            inGlobalContext: false,
        });

        const suppressed = connect(
            `<profile-link text="a" user-id="u-1" suppress-links="true"></profile-link>`,
        );
        const handler2 = vi.fn();
        suppressed.addEventListener("profile-clicked", handler2);
        suppressed.click();
        expect(handler2).not.toHaveBeenCalled();
    });
});
