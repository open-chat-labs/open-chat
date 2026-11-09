import type { OpenChat } from "@client";
import { toastStore } from "../stores/toast";
import {
    copyPageUrl,
    copySectionUrl,
    inEditor,
    removeQueryStringParamInPlace,
    sectionUrl,
    setQueryStringParamInPlace,
    withoutQueryStringParams,
    withQueryStringFlag,
    withQueryStringParam,
} from "./urls";

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

    test("set a param, keeping the others", () => {
        history.replaceState(null, "", "/terms?ref=abc&section=2");
        expect(withQueryStringParam("section", "10")).toBe("/terms?ref=abc&section=10");
        history.replaceState(null, "", "/guidelines");
        expect(withQueryStringParam("section", "3")).toBe("/guidelines?section=3");
    });

    test("set a param in place: no new entry, and the router's path follows", () => {
        // page.js's state, with an app key (utils/history) on it
        history.replaceState(
            { path: "/terms?ref=abc&section=3", action: "sliding_modal" },
            "",
            "/terms?ref=abc&section=3",
        );
        const entries = history.length;
        setQueryStringParamInPlace("section", "10");
        expect(window.location.pathname + window.location.search).toBe("/terms?ref=abc&section=10");
        // Back / Forward to the entry shows its `path` (page.js), so it's the rewritten URL now
        expect(history.state).toEqual({
            path: "/terms?ref=abc&section=10",
            action: "sliding_modal",
        });
        expect(history.length).toBe(entries);
    });

    test("a state without the router's path is left as it is", () => {
        history.replaceState(null, "", "/terms");
        setQueryStringParamInPlace("section", "2");
        expect(history.state).toBeNull();
        history.replaceState({ key: 1 }, "", "/terms");
        setQueryStringParamInPlace("section", "3");
        expect(history.state).toEqual({ key: 1 });
        expect(window.location.search).toBe("?section=3");
    });

    test("remove a param in place, keeping the others, and the router's path follows", () => {
        history.replaceState(
            { path: "/architecture?ref=a&section=x" },
            "",
            "/architecture?ref=a&section=x",
        );
        const entries = history.length;
        removeQueryStringParamInPlace("section");
        expect(window.location.pathname + window.location.search).toBe("/architecture?ref=a");
        expect(history.state).toEqual({ path: "/architecture?ref=a" });
        removeQueryStringParamInPlace("ref");
        expect(window.location.pathname + window.location.search).toBe("/architecture");
        expect(history.state).toEqual({ path: "/architecture" });
        expect(history.length).toBe(entries);
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

/** Invariant: a copied page link is one others can follow (the site's own origin, not the native
 * app's), and a failure says which link it couldn't copy. */
describe("copying the page's link", () => {
    const native = { canonicalOrigin: () => "https://oc.app" } as unknown as OpenChat;
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        history.replaceState(null, "", "/");
    });

    test("copies the page on the site's origin, and says so", async () => {
        history.replaceState(null, "", "/group/abc?open=true#x");
        const writeText = vi.fn(async () => {});
        vi.stubGlobal("navigator", { clipboard: { writeText } });
        const ok = vi.spyOn(toastStore, "showSuccessToast").mockImplementation(() => {});
        await copyPageUrl(native);
        expect(writeText).toHaveBeenCalledWith("https://oc.app/group/abc?open=true#x");
        expect(ok).toHaveBeenCalledOnce();
    });

    test("with no clipboard, says which link it couldn't copy", async () => {
        history.replaceState(null, "", "/chats");
        vi.stubGlobal("navigator", {});
        const failed = vi.spyOn(toastStore, "showFailureToast").mockImplementation(() => {});
        await copyPageUrl(native);
        expect(failed).toHaveBeenCalledWith(
            expect.objectContaining({ params: { url: "https://oc.app/chats" } }),
        );
    });

    test("a section's link uses the site's origin, not the page's, and only its ?section=", async () => {
        history.replaceState(null, "", "/terms?section=2&other=1#x");
        const writeText = vi.fn(async () => {});
        vi.stubGlobal("navigator", { clipboard: { writeText } });
        const ok = vi.spyOn(toastStore, "showSuccessToast").mockImplementation(() => {});
        await copySectionUrl(native, "/terms", "10");
        expect(writeText).toHaveBeenCalledWith("https://oc.app/terms?section=10");
        // the doc's own path, wherever it's shown (the terms at sign-up, on /home)
        history.replaceState(null, "", "/home?section=1");
        await copySectionUrl(native, "/terms", "3");
        expect(writeText).toHaveBeenLastCalledWith("https://oc.app/terms?section=3");
        expect(ok).toHaveBeenCalledTimes(2);
        expect(sectionUrl("/guidelines", "3", "https://oc.app")).toBe(
            "https://oc.app/guidelines?section=3",
        );
    });
});
