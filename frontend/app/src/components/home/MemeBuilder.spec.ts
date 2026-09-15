import { flushSync, mount, unmount } from "svelte";
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
    currentTheme: readable({ name: "test", txt: "#fff", button: { bg: "#000" } }),
}));

import DesktopMemeBuilder from "./MemeBuilder.svelte";
import MobileMemeBuilder from "../../components_mobile/home/MemeBuilder.svelte";

type Component = typeof DesktopMemeBuilder;

function post(init: MessageEventInit) {
    window.dispatchEvent(new MessageEvent("message", init));
}

// Desktop and mobile carry their own copy of the component, so the guard registration is pinned
// on both. The guard itself is covered by utils/memeFighter.spec.ts.
describe.each<[string, Component]>([
    ["desktop", DesktopMemeBuilder],
    ["mobile", MobileMemeBuilder],
])("MemeBuilder (%s)", (_, MemeBuilder) => {
    let destroy: (() => void) | undefined;
    afterEach(() => destroy?.());

    // Invariant: a mounted MemeBuilder registers the origin guard ahead of any later listener,
    // so a Meme Fighter protocol message from another origin never reaches maker-core.
    test("registers the Meme Fighter origin guard on mount", () => {
        const target = document.createElement("div");
        document.body.appendChild(target);
        const app = mount(MemeBuilder, { target, props: { open: false, onSend: () => {} } });
        flushSync();
        destroy = () => {
            unmount(app);
            target.remove();
        };

        // stands in for the listener maker-core adds when start() is called after mount
        const later = vi.fn();
        window.addEventListener("message", later);
        post({
            origin: "https://evil.example.com",
            data: { messageType: "MEME_CREATED", payload: "https://evil.example.com/x.png" },
        });
        expect(later).not.toHaveBeenCalled();
        post({ origin: "https://maker.memefighter.app", data: { messageType: "READY" } });
        expect(later).toHaveBeenCalledTimes(1);
        window.removeEventListener("message", later);
    });

    test("removes the guard on unmount", () => {
        const target = document.createElement("div");
        document.body.appendChild(target);
        const app = mount(MemeBuilder, { target, props: { open: false, onSend: () => {} } });
        flushSync();
        unmount(app);
        target.remove();

        const later = vi.fn();
        window.addEventListener("message", later);
        post({ origin: "https://evil.example.com", data: { messageType: "MEME_CREATED" } });
        expect(later).toHaveBeenCalledTimes(1);
        window.removeEventListener("message", later);
    });
});
