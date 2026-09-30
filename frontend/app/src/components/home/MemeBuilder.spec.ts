import { flushSync, mount, tick, unmount } from "svelte";
import { readable } from "svelte/store";
import { afterEach, describe, expect, test, vi } from "vitest";

// component-lib (pulled in by the mobile tree) reads window.matchMedia at import time; jsdom
// has none. Hoisted so it runs before the imports below.
vi.hoisted(() => {
    window.matchMedia = ((query: string) =>
        ({
            matches: false,
            media: query,
            addEventListener() {},
            removeEventListener() {},
            addListener() {},
            removeListener() {},
        }) as unknown as MediaQueryList) as typeof window.matchMedia;
});

vi.mock("@client", () => ({
    iconSize: readable("1em"),
    mobileWidth: readable(false),
}));
vi.mock("../../theme/themes", () => ({
    currentTheme: readable({
        name: "test",
        txt: "#fff",
        button: { bg: "#000" },
        toast: { failure: { bg: "#f00" } },
    }),
}));

const stopMaker = vi.fn();
const startMemeMaker = vi.fn((..._: unknown[]) => stopMaker);
vi.mock("@src/utils/memeFighter", () => ({
    startMemeMaker: (...args: unknown[]) => startMemeMaker(...args),
}));

import DesktopMemeBuilder from "./MemeBuilder.svelte";
import MobileMemeBuilder from "../../components_mobile/home/MemeBuilder.svelte";

type Component = typeof DesktopMemeBuilder;

// Desktop and mobile carry their own copy of the component, so its use of the maker is pinned on
// both. The maker client itself is covered by utils/memeFighter.spec.ts.
describe.each<[string, Component]>([
    ["desktop", DesktopMemeBuilder],
    ["mobile", MobileMemeBuilder],
])("MemeBuilder (%s)", (_, MemeBuilder) => {
    let destroy: (() => void) | undefined;

    function open() {
        const target = document.createElement("div");
        document.body.appendChild(target);
        const app = mount(MemeBuilder, { target, props: { open: true, onSend: () => {} } });
        flushSync();
        destroy = () => {
            unmount(app);
            target.remove();
            destroy = undefined;
        };
        return app;
    }

    afterEach(() => {
        destroy?.();
        vi.clearAllMocks();
    });

    test("starts the maker in its frame when reset", async () => {
        const app = open();
        expect(startMemeMaker).not.toHaveBeenCalled();

        app.reset();
        await tick();

        expect(startMemeMaker).toHaveBeenCalledTimes(1);
        const [iframe, style] = startMemeMaker.mock.calls[0];
        expect(iframe).toBe(document.querySelector("iframe"));
        expect(style).toMatchObject({ "--foreground-color": "#fff", "--button-color": "#000" });
    });

    // Invariant: at most one maker is being listened to per builder.
    test("stops the maker it had started before starting another", async () => {
        const app = open();
        app.reset();
        await tick();
        expect(stopMaker).not.toHaveBeenCalled();

        app.reset();
        await tick();

        expect(stopMaker).toHaveBeenCalledTimes(1);
        expect(startMemeMaker).toHaveBeenCalledTimes(2);
    });

    test("stops the maker on unmount", async () => {
        const app = open();
        app.reset();
        await tick();

        destroy!();

        expect(stopMaker).toHaveBeenCalledTimes(1);
    });
});
