import { identityStateStore, pathContextStore, type OpenChat, type RouteParams } from "@client";
import { navigate } from "@src/utils/navigation";
import { flushSync, mount, tick, unmount } from "svelte";
import { pageSignIns } from "../auth/authDialog.svelte";
import MarketingScreen from "./MarketingScreen.svelte";

vi.mock("@src/utils/navigation", () => ({ navigate: vi.fn() }));

// the theme stores read media queries as they're imported, and jsdom has no matchMedia
vi.hoisted(() => {
    window.matchMedia = ((media: string) =>
        Object.assign(new EventTarget(), { matches: false, media })) as typeof window.matchMedia;
});

const route = (kind: string, more: object = {}) =>
    ({ kind, scope: { kind: "none" }, ...more }) as RouteParams;

describe("the marketing pages", () => {
    let target: HTMLElement;
    let app: object | undefined;
    const client = {
        handleMagicLink: vi.fn(async () => ({ kind: "success" })),
        getReferringUser: vi.fn(async () => undefined),
        gaTrack: vi.fn(),
        signInWithWebAuthn: vi.fn(),
    };

    beforeEach(() => {
        // jsdom has no 2D canvas; Landing's hero backdrop then doesn't draw
        vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
        window.scrollTo = vi.fn();
        target = document.body.appendChild(document.createElement("div"));
    });
    afterEach(() => {
        if (app) unmount(app);
        app = undefined;
        target.remove();
        vi.restoreAllMocks();
        vi.mocked(navigate).mockReset();
        identityStateStore.set({ kind: "anon" });
        pathContextStore.set(undefined);
        history.replaceState(null, "", "/");
    });

    function show(r: RouteParams, url = "/") {
        history.replaceState(null, "", url);
        pathContextStore.set({ querystring: url.split("?")[1] ?? "" } as PageJS.Context);
        app = mount(MarketingScreen, {
            target,
            props: { route: r },
            context: new Map([["client", client as unknown as OpenChat]]),
        });
        flushSync();
    }
    const q = (sel: string) => document.querySelector<HTMLElement>(sel);

    test("Landing on /home, Learn on its sub-pages' paths, a placeholder for the rest", () => {
        show(route("home_landing_route"));
        expect(q("[data-oc-page=landing]")).not.toBeNull();
        unmount(app!);

        show(route("blog_route", { slug: "chit" }));
        expect(q(".tab[aria-current=page]")?.textContent).toBe("Blog");
        unmount(app!);

        show(route("terms_route"));
        expect(target.textContent).toContain("terms_route");
    });

    test("Learn's own links go through the router, on the same paths", () => {
        show(route("roadmap_route"));
        const faq = [...document.querySelectorAll<HTMLElement>(".tab")].find(
            (t) => t.textContent === "FAQs",
        )!;
        expect(faq.getAttribute("href")).toBe("/faq");
        faq.click();
        expect(navigate).toHaveBeenCalledWith("/faq");
    });

    test("signed in, the pages open the app instead of offering sign-in", () => {
        identityStateStore.set({ kind: "logged_in" });
        show(route("home_landing_route"));
        expect(q(".sign-in")).toBeNull();
        q("a.create")!.click();
        expect(navigate).toHaveBeenCalledWith("/");
    });

    test("an email link's page asks for the code, sends it with the link, and enters", async () => {
        show(route("home_landing_route"), "/home?auth&m=ab&s1=cd&s2=ef");
        await tick();
        // the link's query leaves the URL at once
        expect(navigate).toHaveBeenCalledWith("/home", "auto");
        expect(q("#oc-auth-title")?.textContent).toBe("Sign in with an email link");
        const input = q(".code-input") as HTMLInputElement;
        input.value = "123";
        input.dispatchEvent(new Event("input", { bubbles: true }));
        await vi.waitFor(() =>
            expect(client.handleMagicLink).toHaveBeenCalledWith("?auth&m=ab&s1=cd&s2=ef&c=123"),
        );
        await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith("/"));
        flushSync();
        expect(q("#oc-auth-title")).toBeNull();
    });

    test("a sign-in in Landing's own dialog counts as going on until it settles", async () => {
        let finish!: () => void;
        client.signInWithWebAuthn.mockReturnValueOnce(
            new Promise<void>((resolve) => (finish = resolve)),
        );
        show(route("home_route"));
        q("header .sign-in")!.click();
        flushSync();
        q("[role=dialog] button.passkey")!.click();
        await tick();
        expect(pageSignIns.pending).toBe(1);
        // the passkey is declined: the identity is still anonymous, so it fails
        finish();
        await vi.waitFor(() => expect(pageSignIns.pending).toBe(0));
    });

    test("?auth on its own (narrowing the sign-in options) isn't a link's page", async () => {
        show(route("home_landing_route"), "/home?auth=II");
        await tick();
        expect(navigate).not.toHaveBeenCalled();
        expect(q("#oc-auth-title")).toBeNull();
    });
});
