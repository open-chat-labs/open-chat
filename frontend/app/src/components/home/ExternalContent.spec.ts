import { flushSync, mount, unmount } from "svelte";
import { readable } from "svelte/store";
import { afterEach, describe, expect, test, vi } from "vitest";

vi.mock("@client", () => ({
    currentUserStore: readable({ username: "alice" }),
    mobileWidth: readable(false),
}));
vi.mock("../../theme/themes", () => ({
    currentTheme: readable({ name: "test" }),
}));
vi.mock("../Translatable.svelte", async () => ({
    default: (await import("./ExternalContent.spec.stub.svelte")).default,
}));

import ExternalContent from "./ExternalContent.svelte";

function render(externalUrl: string) {
    const target = document.createElement("div");
    document.body.appendChild(target);
    const app = mount(ExternalContent, {
        target,
        props: { externalUrl, frozen: false, privateChatPreview: false },
    });
    flushSync();
    return {
        iframe: () => target.querySelector("iframe"),
        text: () => target.textContent ?? "",
        destroy: () => {
            unmount(app);
            target.remove();
        },
    };
}

describe("ExternalContent", () => {
    let destroy: (() => void) | undefined;
    afterEach(() => destroy?.());

    // Invariant: the external iframe is sandboxed with no top-navigation flag and sends no
    // referrer.
    test("renders a sandboxed https frame", () => {
        const r = render("https://dapp.example.com/app");
        destroy = r.destroy;
        const iframe = r.iframe();
        expect(iframe).not.toBeNull();
        const sandbox = iframe!.getAttribute("sandbox") ?? "";
        expect(sandbox).not.toBe("");
        expect(sandbox).not.toMatch(/allow-top-navigation/);
        expect(iframe!.getAttribute("referrerpolicy")).toBe("no-referrer");
        expect(r.text()).toContain("dapp.example.com");
    });

    // Invariant: the website only frames https external URLs.
    test.each(["javascript:alert(1)", "http://dapp.example.com", "not a url"])(
        "renders no frame for %s",
        (url) => {
            const r = render(url);
            destroy = r.destroy;
            expect(r.iframe()).toBeNull();
        },
    );

    // Invariant: the host posts to the frame only after the ready message from the framed
    // origin, and never in response to another origin.
    test("initialises only on the ready message from the framed origin", () => {
        const r = render("https://dapp.example.com/app");
        destroy = r.destroy;
        const frame = r.iframe()!;
        const post = vi.spyOn(frame.contentWindow!, "postMessage");

        const ready = { kind: "external_content_ready" };
        window.dispatchEvent(
            new MessageEvent("message", { origin: "https://evil.example.com", data: ready }),
        );
        window.dispatchEvent(new MessageEvent("message", { origin: "null", data: null }));
        expect(post).not.toHaveBeenCalled();

        window.dispatchEvent(
            new MessageEvent("message", { origin: "https://dapp.example.com", data: ready }),
        );
        expect(post).toHaveBeenCalledTimes(1);
        expect(post.mock.calls[0][1]).toBe("https://dapp.example.com");
        const msg = post.mock.calls[0][0] as { kind: string; username: string };
        expect(msg.kind).toBe("initialise_external_content");
        expect(Object.keys(msg).sort()).toEqual(["kind", "theme", "username"]);
    });
});
