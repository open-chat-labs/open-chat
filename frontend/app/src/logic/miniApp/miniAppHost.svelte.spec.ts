import type { OpenChat } from "@client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { MiniAppHost } from "./miniAppHost.svelte";
import type { OpenMiniApp } from "./openMiniApp.svelte";

const APP: OpenMiniApp = {
    url: new URL("https://uno.example.com/app"),
    botName: "Uno",
    chatId: { kind: "group_chat", groupId: "group" },
    threadRootMessageIndex: undefined,
    messageId: 7n,
    botId: "bot",
};

describe("MiniAppHost", () => {
    let frame: HTMLIFrameElement;
    let sent: [unknown, string][];
    let stop: () => void;

    beforeEach(() => {
        frame = document.createElement("iframe");
        document.body.appendChild(frame);
        sent = [];
        vi.spyOn(frame.contentWindow!, "postMessage").mockImplementation(
            (message: unknown, targetOrigin?: unknown) => {
                sent.push([message, targetOrigin as string]);
            },
        );
    });

    afterEach(() => {
        stop?.();
        frame.remove();
    });

    function host(token: string | undefined): MiniAppHost {
        const tokens: Pick<OpenChat, "miniAppToken"> = { miniAppToken: async () => token };
        const host = new MiniAppHost(tokens, APP);
        stop = host.attach(frame, true, () => "fr");
        return host;
    }

    async function fromApp(data: unknown, origin = APP.url.origin, source = frame.contentWindow) {
        window.dispatchEvent(new MessageEvent("message", { data, origin, source }));
        // the token is fetched asynchronously
        await new Promise((resolve) => setTimeout(resolve, 0));
    }

    test("sends the token only to the app's own origin, once it's ready", async () => {
        const app = host("token");
        await fromApp({ kind: "mini_app_ready" });

        expect(sent).toEqual([
            [
                { kind: "initialise_mini_app", token: "token", dark_mode: true, locale: "fr" },
                "https://uno.example.com",
            ],
        ]);
        expect(app.status).toBe("connected");
    });

    test("ignores messages from anywhere but the app's frame and origin", async () => {
        const app = host("token");
        await fromApp({ kind: "mini_app_ready" }, "https://evil.example.com");
        await fromApp({ kind: "mini_app_ready" }, APP.url.origin, window);

        expect(sent).toEqual([]);
        expect(app.status).toBe("connecting");
    });

    test("fails, sending nothing, if there's no token when the app opens", async () => {
        const app = host(undefined);
        await fromApp({ kind: "mini_app_ready" });

        expect(sent).toEqual([]);
        expect(app.status).toBe("failed");
    });

    test("answers a request for a fresh token, but not without one", async () => {
        host("fresh");
        await fromApp({ kind: "mini_app_token_request" });
        expect(sent).toEqual([[{ kind: "mini_app_token", token: "fresh" }, APP.url.origin]]);

        stop();
        sent = [];
        host(undefined);
        await fromApp({ kind: "mini_app_token_request" });
        expect(sent).toEqual([]);
    });

    test("tells the app the theme changed only once it's connected", async () => {
        const app = host("token");
        app.setDarkMode(false);
        expect(sent).toEqual([]);

        await fromApp({ kind: "mini_app_ready" });
        sent = [];
        app.setDarkMode(true);
        expect(sent).toEqual([[{ kind: "set_dark_mode", dark_mode: true }, APP.url.origin]]);
    });
});
