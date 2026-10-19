import { inEditor, withoutQueryStringParams, withQueryStringFlag } from "./urls";

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

describe("a link in an editor", () => {
    // a link inside elements carrying these contenteditable values, outermost first (null: none)
    function link(...editable: (string | null)[]): HTMLAnchorElement {
        let parent: HTMLElement = document.createElement("div");
        for (const value of editable) {
            const el = document.createElement("div");
            if (value !== null) el.setAttribute("contenteditable", value);
            parent.appendChild(el);
            parent = el;
        }
        return parent.appendChild(document.createElement("a"));
    }

    test("is one inside an editing host, at any depth", () => {
        expect(inEditor(link(""))).toBe(true);
        expect(inEditor(link("TRUE", null))).toBe(true);
        expect(inEditor(link("plaintext-only"))).toBe(true);
    });

    test('is one in a contenteditable="false" island inside an editor (a mention chip)', () => {
        expect(inEditor(link("true", "false"))).toBe(true);
    });

    test('isn\'t one under contenteditable="false", "inherit" or an invalid value outside any editor', () => {
        expect(inEditor(link("false"))).toBe(false);
        expect(inEditor(link("false", "inherit"))).toBe(false);
        expect(inEditor(link("bogus"))).toBe(false);
        expect(inEditor(link(null))).toBe(false);
    });
});
