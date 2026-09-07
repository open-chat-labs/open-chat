import type { Component, Snippet } from "svelte";
import { flushSync, tick } from "svelte";
import { createClassComponent } from "svelte/legacy";
import type { Writable } from "svelte/store";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { IdentityState, RouteParams } from "@client";
import { chatsInitialisedStore, identityStateStore, routeStore } from "@client";
import HomeRouteV1 from "../components/home/HomeRoute.svelte";
import HomeRouteV2 from "../components_mobile/home/HomeRoute.svelte";

vi.mock("@client", async () => {
    const { writable } = await import("svelte/store");
    return {
        anonUserStore: writable(true),
        chatsInitialisedStore: writable(false),
        identityStateStore: writable({ kind: "anon" }),
        querystringStore: writable(new URLSearchParams()),
        routeStore: writable({ kind: "home_route", scope: { kind: "none" } }),
    };
});

// Mount the actual compiled HomeRoute entries. Only their child surfaces are
// recording fixtures: do not initialize the real client, authenticate, query a
// registry, or render cards in these UI-readiness contract tests.
async function surface(label: string) {
    const { default: Fixture } = await import("./fixtures/HomeStartupFixture.svelte");
    return {
        default: ((anchor, props) => Fixture(anchor, { ...props, label })) as Component<{
            children?: Snippet;
            onClose?: () => void;
        }>,
    };
}
vi.mock("../components/home/Home.svelte", () => surface("home"));
vi.mock("../components_mobile/home/Home.svelte", () => surface("home"));
vi.mock("../components/landingpages/LandingPage.svelte", () => surface("landing"));
vi.mock("@shared_components/Loading.svelte", () => surface("loading"));
// Keep the pre-fix canvas loaders isolated too, so readiness regressions fail
// on the mounted route contract, not on browser animation APIs in jsdom.
vi.mock("../components/icons/FancyLoader.svelte", () => surface("loading"));
vi.mock("../components_mobile/icons/FancyLoader.svelte", () => surface("loading"));
vi.mock("../components/onboard/OnboardModal.svelte", () => surface("onboarding"));
vi.mock("../components_mobile/onboard/OnboardModal.svelte", () => surface("onboarding"));

const cleanup: (() => void)[] = [];
// Production exposes a derived readable; only this isolated mock is writable.
const { anonUserStore: anonymous, querystringStore: querystring } = await vi.importMock<{
    anonUserStore: Writable<boolean>;
    querystringStore: Writable<URLSearchParams>;
}>("@client");
async function settle() {
    await tick();
    await tick();
    flushSync();
}
function identity(kind: IdentityState["kind"], registering = false) {
    identityStateStore.set({ kind, registering } as IdentityState);
}
function route(kind: RouteParams["kind"]) {
    routeStore.set({ kind, scope: { kind: "none" } } as RouteParams);
}
function mountEntry(component: typeof HomeRouteV1 | typeof HomeRouteV2, showLandingPage = false) {
    const target = document.createElement("div");
    document.body.append(target);
    const mounted =
        component === HomeRouteV1
            ? createClassComponent({ component: HomeRouteV1, target, props: { showLandingPage } })
            : createClassComponent({ component: HomeRouteV2, target });
    cleanup.push(() => {
        mounted.$destroy();
        target.remove();
    });
    return {
        // V1 uses its real Overlay portal into body, not a mocked teardown.
        target: document.body,
        has(label: string) {
            return document.body.querySelector(`[data-startup-fixture="${label}"]`) !== null;
        },
    };
}

beforeEach(() => {
    anonymous.set(true);
    chatsInitialisedStore.set(false);
    identity("anon");
    route("home_route");
    querystring.set(new URLSearchParams());
});
afterEach(() => cleanup.splice(0).forEach((dispose) => dispose()));

for (const [label, component] of [
    ["v1", HomeRouteV1],
    ["v2", HomeRouteV2],
] as const) {
    describe(`${label} home startup readiness`, () => {
        it.each(
            label === "v1"
                ? ["diamond", "faq", "wallet", "hof", "everyone", "usergroup"]
                : ["faq", "hof"],
        )(
            "preserves the original Home-owned %s query action and retains Home after it consumes the query",
            async (action) => {
                querystring.set(new URLSearchParams([[action, "test-value"]]));
                const view = mountEntry(component);
                await settle();
                expect(view.has("loading")).toBe(true);
                expect(view.has("onboarding")).toBe(false);
                expect(view.has("home")).toBe(false);
                chatsInitialisedStore.set(true);
                await settle();
                const home = view.target.querySelector('[data-startup-fixture="home"]');
                expect(home).not.toBeNull();
                // Home owns the navigation/modal effect and then removes the
                // query. Keep that exact mounted instance and its modal state.
                querystring.set(new URLSearchParams());
                await settle();
                expect(view.target.querySelector('[data-startup-fixture="home"]')).toBe(home);
                expect(view.has("onboarding")).toBe(false);
                route("communities_route");
                await settle();
                chatsInitialisedStore.set(false);
                route("home_route");
                await settle();
                expect(view.has("onboarding")).toBe(true);
            },
        );

        it("preserves future or unknown Home query actions without a duplicated supported-key list", async () => {
            querystring.set(new URLSearchParams("future_entry_action=test"));
            const view = mountEntry(component);
            await settle();
            expect(view.has("loading")).toBe(true);
            expect(view.has("onboarding")).toBe(false);
            expect(view.has("home")).toBe(false);
            chatsInitialisedStore.set(true);
            await settle();
            expect(view.has("home")).toBe(true);
        });

        it("shows anonymous-home auth choices while discovery remains unsettled, without mounting the chat tree", async () => {
            const view = mountEntry(component);
            await settle();
            expect(view.has("onboarding")).toBe(true);
            expect(view.target.querySelectorAll("button").length).toBeGreaterThanOrEqual(2);
            expect(view.has("home")).toBe(false);
            expect(view.has("loading")).toBe(false);
            // No fabricated registry/chat completion or identity change.
            let initialized: boolean | undefined;
            const unsub = chatsInitialisedStore.subscribe((value) => (initialized = value));
            unsub();
            expect(initialized).toBe(false);
        });

        it("preserves the same in-progress form through login start, cancellation and late registry completion", async () => {
            const view = mountEntry(component);
            await settle();
            const input = view.target.querySelector<HTMLInputElement>("input");
            expect(input).not.toBeNull();
            input!.value = "123456";
            input!.dispatchEvent(new Event("input", { bubbles: true }));
            identity("logging_in");
            await settle();
            chatsInitialisedStore.set(true);
            await settle();
            identity("anon");
            await settle();
            expect(view.target.querySelector("input")).toBe(input);
            expect(input!.value).toBe("123456");
            expect(view.has("home")).toBe(false);
        });

        it.each(["communities_route", "global_chat_selected_route", "welcome_route"] as const)(
            "keeps the existing data-readiness gate for anonymous %s",
            async (kind) => {
                route(kind);
                const view = mountEntry(component);
                await settle();
                expect(view.has("onboarding")).toBe(false);
                expect(view.has("loading")).toBe(true);
                chatsInitialisedStore.set(true);
                await settle();
                expect(view.has("home")).toBe(true);
                expect(view.has("onboarding")).toBe(false);
            },
        );

        it("does not display an anonymous form before identity restoration or while loading a registered account", async () => {
            identity("loading_user");
            const view = mountEntry(component);
            await settle();
            expect(view.has("loading")).toBe(true);
            expect(view.has("onboarding")).toBe(false);
            chatsInitialisedStore.set(true);
            await settle();
            expect(view.has("loading")).toBe(true);
            identity("logged_in");
            anonymous.set(false);
            await settle();
            expect(view.has("home")).toBe(true);
            expect(view.has("onboarding")).toBe(false);
        });

        it("keeps registered-account chat readiness and rejects inconsistent stale anonymous identity", async () => {
            identity("logged_in");
            anonymous.set(false);
            const view = mountEntry(component);
            await settle();
            expect(view.has("loading")).toBe(true);
            identity("anon");
            await settle();
            expect(view.has("loading")).toBe(true);
            expect(view.has("onboarding")).toBe(false);
        });

        it.each(["registering", "loading_user"] as const)(
            "preserves the existing registration exception for %s",
            async (kind) => {
                identity(kind, true);
                const view = mountEntry(component);
                await settle();
                expect(view.has("home")).toBe(true);
                expect(view.has("onboarding")).toBe(false);
            },
        );

        it("returns to the unchanged readiness gate when leaving anonymous home", async () => {
            const view = mountEntry(component);
            await settle();
            expect(view.has("onboarding")).toBe(true);
            route("communities_route");
            await settle();
            expect(view.has("onboarding")).toBe(false);
            expect(view.has("home")).toBe(false);
            expect(view.has("loading")).toBe(true);
            route("home_route");
            await settle();
            expect(view.has("onboarding")).toBe(true);
        });
    });
}

it("v1 preserves the existing landing-page priority", async () => {
    const view = mountEntry(HomeRouteV1, true);
    await settle();
    expect(view.has("landing")).toBe(true);
    expect(view.has("onboarding")).toBe(false);
});

it("v1 untouched welcome yields to the existing anonymous-scope redirect when discovery is ready", async () => {
    const view = mountEntry(HomeRouteV1);
    await settle();
    expect(view.has("onboarding")).toBe(true);
    chatsInitialisedStore.set(true);
    await settle();
    expect(view.has("home")).toBe(true);
    expect(view.has("onboarding")).toBe(false);
});

it.each([
    "click",
    "stopped-click",
    "keyboard",
    "stopped-keyboard",
    "input",
    "stopped-input",
    "login-state",
] as const)(
    "v1 retains the same portal form after %s activity when discovery completes",
    async (activity) => {
        const view = mountEntry(HomeRouteV1);
        await settle();
        const form = view.target.querySelector('[data-startup-fixture="onboarding"]');
        expect(form).not.toBeNull();
        const input = form!.querySelector("input")!;
        // Production StandardButton and SignalsButton stop click propagation.
        // Auth interaction must still be observed before that child handler.
        if (activity.startsWith("stopped-")) {
            const event = activity.slice("stopped-".length);
            const target = event === "click" ? form!.querySelector("button")! : input;
            target.addEventListener(event === "keyboard" ? "keydown" : event, (e) =>
                e.stopPropagation(),
            );
        }
        if (activity === "click" || activity === "stopped-click")
            form!.querySelector("button")!.click();
        else if (activity === "keyboard" || activity === "stopped-keyboard")
            input.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
        else if (activity === "input" || activity === "stopped-input")
            input.dispatchEvent(new Event("input", { bubbles: true }));
        else identity("logging_in");
        await settle();
        chatsInitialisedStore.set(true);
        await settle();
        expect(view.target.querySelector('[data-startup-fixture="onboarding"]')).toBe(form);
        expect(view.has("home")).toBe(false);
    },
);

it("v1 landing-page transitions do not let overlay teardown dismiss the next welcome", async () => {
    const target = document.createElement("div");
    document.body.append(target);
    const mounted = createClassComponent({
        component: HomeRouteV1,
        target,
        props: { showLandingPage: false },
    });
    cleanup.push(() => {
        mounted.$destroy();
        target.remove();
    });
    await settle();
    expect(document.body.querySelector('[data-startup-fixture="onboarding"]')).not.toBeNull();
    mounted.$set({ showLandingPage: true });
    await settle();
    expect(document.body.querySelector('[data-startup-fixture="landing"]')).not.toBeNull();
    expect(document.body.querySelector('[data-startup-fixture="onboarding"]')).toBeNull();
    mounted.$set({ showLandingPage: false });
    await settle();
    expect(document.body.querySelector('[data-startup-fixture="onboarding"]')).not.toBeNull();
});

it("v1 welcome dismissal does not fabricate readiness and resets after leaving home", async () => {
    const view = mountEntry(HomeRouteV1);
    await settle();
    const close = [...view.target.querySelectorAll("button")].find(
        (button) => button.textContent === "Close welcome",
    );
    expect(close).toBeDefined();
    close!.click();
    await settle();
    expect(view.has("onboarding")).toBe(false);
    expect(view.has("loading")).toBe(true);
    route("communities_route");
    await settle();
    route("home_route");
    await settle();
    expect(view.has("onboarding")).toBe(true);
});
