import { miniAppCardView, type MiniAppContent } from "@client";
import { flushSync, mount, unmount } from "svelte";
import { afterEach, describe, expect, onTestFinished, test, vi } from "vitest";

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
import { i18nKey } from "../../i18n/i18n";
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

// jsdom has no modal dialogs, so a frame can't go full screen. These only open and close it, as
// jsdom draws nothing, so there's no top layer to put it in.
function stubDialogs(): void {
    const proto = HTMLDialogElement.prototype;
    function show(this: HTMLDialogElement) {
        this.open = true;
    }
    Object.assign(proto, {
        show,
        showModal: show,
        close(this: HTMLDialogElement) {
            this.open = false;
        },
    });
    onTestFinished(() => {
        for (const name of ["show", "showModal", "close"]) Reflect.deleteProperty(proto, name);
    });
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

    test("keeps the artwork over the app, drawn unseen, until the app says it has drawn", () => {
        const props = $state({
            app: hosted(),
            actions: new MiniAppActions(client as never, GAME),
            fullScreen: new MiniAppFullScreen(),
            active: true,
            view: miniAppCardView(CONTENT, undefined, "me"),
            imageUrl: "https://uno.example.com/art.png",
        });
        target = document.body.appendChild(document.createElement("div"));
        app = mount(Frame, { target, props, context: new Map([["client", client]]) });
        flushSync();
        const frame = () => target!.querySelector("iframe")!;
        const artwork = () => target!.querySelector(".cover img");
        const drawn = () => {
            window.dispatchEvent(
                new MessageEvent("message", {
                    data: { kind: "mini_app_drawn" },
                    origin: "https://uno.example.com",
                    source: frame().contentWindow,
                }),
            );
            flushSync();
        };
        expect(artwork()).not.toBeNull();
        expect(frame().classList).toContain("unrevealed");

        drawn();
        expect(artwork()).toBeNull();
        expect(frame().classList).not.toContain("unrevealed");

        // Off screen and back, the app's in a new frame, which is unseen until it has drawn again
        props.active = false;
        flushSync();
        props.active = true;
        flushSync();
        expect(artwork()).not.toBeNull();
        expect(frame().classList).toContain("unrevealed");
        drawn();
        expect(artwork()).toBeNull();
    });

    test("puts focus in the app going full screen and back, so the game's keys don't press buttons", async () => {
        stubDialogs();
        const props = {
            app: hosted(),
            actions: new MiniAppActions(client as never, GAME),
            fullScreen: new MiniAppFullScreen(),
            active: true,
            view: miniAppCardView(CONTENT, undefined, "me"),
            imageUrl: undefined,
        };
        target = document.body.appendChild(document.createElement("div"));
        app = mount(Frame, { target, props, context: new Map([["client", client]]) });
        flushSync();
        const frame = target.querySelector("iframe")!;

        const corner = target.querySelector<HTMLButtonElement>(".corner")!;
        corner.focus();
        corner.click();
        flushSync();
        expect(props.fullScreen.on).toBe(true);
        await vi.waitFor(() => expect(document.activeElement).toBe(frame));

        const exit = target.querySelector<HTMLElement>(".exit button, .exit [role='button']")!;
        exit.focus();
        exit.click();
        flushSync();
        expect(props.fullScreen.on).toBe(false);
        await vi.waitFor(() => expect(document.activeElement).toBe(frame));
    });

    test("without an app, puts focus on the exit button, and on the corner button once back", async () => {
        stubDialogs();
        // the game can't be opened, so the frame says so in place of the app
        const failing = {
            ...client,
            openMiniApp: async () => ({
                kind: "failed",
                message: i18nKey("bots.miniApp.finished"),
            }),
        };
        const props = {
            app: hosted(),
            actions: new MiniAppActions(failing as never, GAME),
            fullScreen: new MiniAppFullScreen(),
            active: true,
            view: miniAppCardView(CONTENT, undefined, "me"),
            imageUrl: undefined,
        };
        target = document.body.appendChild(document.createElement("div"));
        app = mount(Frame, { target, props, context: new Map([["client", failing]]) });
        flushSync();
        await vi.waitFor(() => expect(target!.querySelector("iframe")).toBeNull());

        target.querySelector<HTMLButtonElement>(".corner")!.click();
        flushSync();
        const exit = target.querySelector<HTMLElement>(".exit button, .exit [role='button']")!;
        await vi.waitFor(() => expect(document.activeElement).toBe(exit));

        exit.click();
        flushSync();
        await vi.waitFor(() =>
            expect(document.activeElement).toBe(target!.querySelector(".corner")),
        );
    });
});
