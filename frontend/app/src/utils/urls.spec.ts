import type { OpenChat } from "@client";
import { handleLinkClick, isEditable, withoutQueryStringParams, withQueryStringFlag } from "./urls";

describe("query string helpers", () => {
    afterEach(() => history.replaceState(null, "", "/"));

    test("add a valueless param, keeping the others", () => {
        history.replaceState(null, "", "/chats?keep=1");
        expect(withQueryStringFlag("profile")).toBe("/chats?keep=1&profile");
        history.replaceState(null, "", "/chats");
        expect(withQueryStringFlag("profile")).toBe("/chats?profile");
    });

    test("don't add a param twice", () => {
        history.replaceState(null, "", "/chats?profile");
        expect(withQueryStringFlag("profile")).toBe("/chats?profile");
    });

    test("drop several params at once", () => {
        history.replaceState(null, "", "/chats?everyone&usergroup=3&keep=1");
        expect(withoutQueryStringParams(["everyone", "usergroup"])).toBe("/chats?keep=1");
        expect(withoutQueryStringParams(["everyone", "usergroup", "keep"])).toBe("/chats");
    });
});

describe("editable content", () => {
    const link = (html: string) => {
        const host = document.createElement("div");
        host.innerHTML = html;
        return host.querySelector("a")!;
    };

    test("is a link inside an editor", () => {
        expect(isEditable(link('<div contenteditable><a href="/x">x</a></div>'))).toBe(true);
        expect(
            isEditable(link('<div contenteditable="true"><p><a href="/x">x</a></p></div>')),
        ).toBe(true);
        expect(
            isEditable(link('<div contenteditable="plaintext-only"><a href="/x">x</a></div>')),
        ).toBe(true);
    });

    test('isn\'t one under contenteditable="false", even inside an editor, or outside any', () => {
        expect(isEditable(link('<div contenteditable="false"><a href="/x">x</a></div>'))).toBe(
            false,
        );
        expect(
            isEditable(
                link(
                    '<div contenteditable><span contenteditable="false"><a href="/x">x</a></span></div>',
                ),
            ),
        ).toBe(false);
        expect(isEditable(link('<p><a href="/x">x</a></p>'))).toBe(false);
    });
});

describe("a click on an internal link", () => {
    const client = { isNativeApp: () => false } as unknown as OpenChat;

    // the handler's outcome for a click on the link in `html`: routed in the app, held, or left alone
    function click(html: string): "routed" | "held" | "left" {
        const host = document.body.appendChild(document.createElement("div"));
        host.innerHTML = html;
        const onInternal = vi.fn();
        const e = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
        host.addEventListener("click", handleLinkClick(client, onInternal));
        host.querySelector("a")!.dispatchEvent(e);
        host.remove();
        return onInternal.mock.calls.length ? "routed" : e.defaultPrevented ? "held" : "left";
    }

    test('is held in an editor, and routed under contenteditable="false"', () => {
        expect(click('<div contenteditable><a href="/roadmap">x</a></div>')).toBe("held");
        expect(click('<div contenteditable="false"><a href="/roadmap">x</a></div>')).toBe("routed");
        expect(click('<p><a href="/roadmap">x</a></p>')).toBe("routed");
    });
});
