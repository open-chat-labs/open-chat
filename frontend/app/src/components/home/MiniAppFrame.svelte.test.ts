import { miniAppCardView, type MiniAppContent } from "@client";
import { flushSync, mount, unmount } from "svelte";
import { afterEach, describe, expect, test, vi } from "vitest";

// utils/devices.ts and the theme query matchMedia when imported, and jsdom has none
vi.hoisted(() => {
    window.matchMedia = (query: string) =>
        ({
            matches: false,
            media: query,
            addEventListener() {},
            removeEventListener() {},
        }) as never;
});

import { MiniAppActions } from "@src/logic/miniApp/miniAppActions.svelte";
import { MiniAppFullScreen } from "@src/logic/miniApp/miniAppFrame.svelte";
import type { HostedMiniApp } from "@src/logic/miniApp/miniAppHost.svelte";
import MobileMiniAppFrame from "../../components_mobile/home/MiniAppFrame.svelte";
import { themeType } from "../../theme/themes";
import MiniAppFrame from "./MiniAppFrame.svelte";

const GAME = {
    chatId: { kind: "group_chat" as const, groupId: "group" },
    threadRootMessageIndex: undefined,
    messageId: 7n,
};
const CONTENT: MiniAppContent = {
    kind: "mini_app_content",
    text: "Uno",
    app: "uno",
    spectators: true,
    appSize: { width: 440, height: 740 },
    status: { kind: "open" },
};

// The bot as the card has it, which is made afresh, with a new URL, each time the bots are refreshed
function hosted(endpoint = "https://uno.example.com"): HostedMiniApp {
    return { url: new URL(`${endpoint}/app`), botName: "Uno", game: GAME, content: CONTENT };
}

// The service, which never answers: the app's never initialised
const client = {
    openMiniApp: () => new Promise(() => undefined),
    closeMiniApp: () => undefined,
    joinMiniApp: async () => undefined,
    leaveMiniApp: async () => undefined,
};

// Svelte writes a dynamic `src` with setAttribute, so wrapping it records each time the frame's sent
// somewhere, even to where it is
function recordSrcWrites(): string[] {
    const writes: string[] = [];
    const original = Element.prototype.setAttribute;
    vi.spyOn(Element.prototype, "setAttribute").mockImplementation(function (
        this: Element,
        name: string,
        value: string,
    ) {
        if (name === "src" && this instanceof HTMLIFrameElement) writes.push(value);
        return original.call(this, name, value);
    });
    return writes;
}

describe.each([
    ["desktop", MiniAppFrame],
    ["mobile", MobileMiniAppFrame],
])("the %s MiniAppFrame", (_, Frame) => {
    let app: object | undefined;
    let target: HTMLElement | undefined;

    afterEach(() => {
        if (app !== undefined) unmount(app);
        target?.remove();
        vi.restoreAllMocks();
        themeType.set("system");
    });

    test("frames the app in the user's theme, and leaves it there as the theme and bots change", () => {
        themeType.set("dark");
        const props = $state({
            app: hosted(),
            actions: new MiniAppActions(client as never, GAME),
            fullScreen: new MiniAppFullScreen(),
            active: true,
            view: miniAppCardView(CONTENT, undefined, "me"),
            imageUrl: undefined,
        });
        target = document.body.appendChild(document.createElement("div"));
        app = mount(Frame, { target, props, context: new Map([["client", client]]) });
        flushSync();
        const frame = () => target!.querySelector("iframe")!;
        expect(frame().getAttribute("src")).toBe("https://uno.example.com/app#oc_theme=dark");

        // A change of theme goes to the app as a message, and the bots' refresh changes nothing, so
        // the frame isn't sent anywhere, even to its own URL in the new theme
        const writes = recordSrcWrites();
        themeType.set("light");
        flushSync();
        props.app = hosted();
        flushSync();
        expect(writes).toEqual([]);
        expect(frame().getAttribute("src")).toBe("https://uno.example.com/app#oc_theme=dark");

        // A new endpoint is a new app, in the theme as it now is
        props.app = hosted("https://dos.example.com");
        flushSync();
        expect(writes).toEqual(["https://dos.example.com/app#oc_theme=light"]);
    });
});
