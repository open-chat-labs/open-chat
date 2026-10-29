import type {
    MiniAppGameListener,
    MiniAppOpenOutcome,
    MiniAppStartOutcome,
    OpenChat,
    ResourceKey,
} from "@client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { MiniAppHost } from "./miniAppHost.svelte";
import type { OpenMiniApp } from "./openMiniApp.svelte";

const APP: OpenMiniApp = {
    url: new URL("https://uno.example.com/app"),
    botName: "Uno",
    game: {
        chatId: { kind: "group_chat", groupId: "group" },
        threadRootMessageIndex: undefined,
        messageId: 7n,
    },
    content: { kind: "mini_app_content", text: "Uno", spectators: true, status: { kind: "open" } },
};
const ORIGIN = "https://uno.example.com";

function key(key: string): ResourceKey {
    return { kind: "resource_key", key, lowercase: false };
}

// The service's side, which the test answers
class FakeGames implements Pick<
    OpenChat,
    "openMiniApp" | "closeMiniApp" | "miniAppPlayerToken" | "startMiniApp"
> {
    listener: MiniAppGameListener | undefined;
    opened: (outcome: MiniAppOpenOutcome) => void = () => undefined;
    closed = 0;
    playerToken: string | undefined = "fresh";
    started: MiniAppStartOutcome = { kind: "started" };

    openMiniApp(_: unknown, listener: MiniAppGameListener): Promise<MiniAppOpenOutcome> {
        this.listener = listener;
        return new Promise((resolve) => (this.opened = resolve));
    }

    closeMiniApp(): void {
        this.closed++;
    }

    async miniAppPlayerToken(): Promise<string | undefined> {
        return this.playerToken;
    }

    async startMiniApp(): Promise<MiniAppStartOutcome> {
        return this.started;
    }
}

describe("MiniAppHost", () => {
    let frame: HTMLIFrameElement;
    let sent: unknown[];
    let origins: Set<string>;
    let games: FakeGames;
    let host: MiniAppHost;
    let close: () => void;

    beforeEach(() => {
        frame = document.createElement("iframe");
        document.body.appendChild(frame);
        sent = [];
        origins = new Set();
        vi.spyOn(frame.contentWindow!, "postMessage").mockImplementation(
            (message: unknown, targetOrigin?: unknown) => {
                sent.push(message);
                origins.add(targetOrigin as string);
            },
        );
        games = new FakeGames();
        host = new MiniAppHost(games, APP, {
            userId: "me",
            darkMode: true,
            locale: () => "fr",
            translate: (key) => `translated ${key.key}`,
        });
        close = host.open(frame);
    });

    afterEach(() => {
        close();
        frame.remove();
    });

    // Lets the host's promises settle
    const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

    async function fromApp(data: unknown, origin = ORIGIN, source = frame.contentWindow) {
        window.dispatchEvent(new MessageEvent("message", { data, origin, source }));
        await settle();
    }

    async function opened(role: "player" | "spectator", playerToken?: string) {
        games.opened({ kind: "opened", role, playerToken });
        await settle();
    }

    function initialise(role: "player" | "spectator", token?: string) {
        return {
            kind: "initialise_mini_app",
            role,
            user_id: "me",
            token,
            dark_mode: true,
            locale: "fr",
        };
    }

    function state(seq: number, shared: unknown = { seq }, priv?: unknown) {
        return { seq, shared, private: priv };
    }

    test("initialises the app once it's ready and the game's open, then sends the state it held", async () => {
        games.listener!.onState(state(3));
        await fromApp({ kind: "mini_app_ready" });
        expect(sent).toEqual([]);

        await opened("player", "player");
        expect(sent).toEqual([
            initialise("player", "player"),
            { kind: "mini_app_state", seq: 3, shared: { seq: 3 }, private: undefined },
        ]);
        expect(origins).toEqual(new Set([ORIGIN]));
        expect(host.status).toEqual({ kind: "open", role: "player" });
    });

    test("holds only the latest state until the app's ready, dropping older ones", async () => {
        await opened("spectator");
        games.listener!.onState(state(5));
        games.listener!.onState(state(4));
        games.listener!.onState(state(6));
        games.listener!.onState(state(6, { again: true }));
        games.listener!.onState(state(2));
        expect(sent).toEqual([]);

        await fromApp({ kind: "mini_app_ready" });
        expect(sent).toEqual([
            initialise("spectator"),
            { kind: "mini_app_state", seq: 6, shared: { again: true }, private: undefined },
        ]);
    });

    test("passes each state on once the app's initialised, but not one older than the last", async () => {
        await opened("spectator");
        await fromApp({ kind: "mini_app_ready" });
        sent = [];

        games.listener!.onState(state(1));
        games.listener!.onState(state(3));
        games.listener!.onState(state(2));
        games.listener!.onState(state(3, { again: true }));

        expect(sent.map((m) => (m as { shared: unknown }).shared)).toEqual([
            { seq: 1 },
            { seq: 3 },
            { again: true },
        ]);
    });

    test("initialises the app again when the user's role changes, before the state that follows", async () => {
        await opened("spectator");
        await fromApp({ kind: "mini_app_ready" });
        games.listener!.onState(state(8));
        sent = [];

        // the user joined from the card
        games.listener!.onRole("player", "player");
        games.listener!.onState(state(8, { seq: 8 }, { hand: [1] }));

        expect(sent).toEqual([
            initialise("player", "player"),
            { kind: "mini_app_state", seq: 8, shared: { seq: 8 }, private: { hand: [1] } },
        ]);

        // and left again
        sent = [];
        games.listener!.onRole("spectator", undefined);
        expect(sent).toEqual([initialise("spectator")]);

        // a reconnect which finds the role unchanged only refreshes the token
        sent = [];
        games.listener!.onRole("spectator", undefined);
        expect(sent).toEqual([]);
    });

    test("initialises the app again if it reloads itself", async () => {
        await opened("player", "player");
        await fromApp({ kind: "mini_app_ready" });
        games.listener!.onState(state(2));
        sent = [];

        await fromApp({ kind: "mini_app_ready" });
        expect(sent).toEqual([
            initialise("player", "player"),
            { kind: "mini_app_state", seq: 2, shared: { seq: 2 }, private: undefined },
        ]);
    });

    test("ignores messages from anywhere but the app's frame and origin", async () => {
        await opened("player", "player");
        await fromApp({ kind: "mini_app_ready" }, "https://evil.example.com");
        await fromApp({ kind: "mini_app_ready" }, ORIGIN, window);

        expect(sent).toEqual([]);
    });

    test("gets a player a fresh token when the app asks", async () => {
        await opened("player", "player");
        await fromApp({ kind: "mini_app_ready" });
        sent = [];

        await fromApp({ kind: "mini_app_token_request" });
        expect(sent).toEqual([{ kind: "mini_app_token", token: "fresh" }]);

        // and the app's initialised with it if it reloads
        sent = [];
        await fromApp({ kind: "mini_app_ready" });
        expect(sent).toEqual([initialise("player", "fresh")]);
    });

    test("doesn't answer a request for a token from a spectator, or when there's none", async () => {
        await opened("spectator");
        await fromApp({ kind: "mini_app_ready" });
        sent = [];
        await fromApp({ kind: "mini_app_token_request" });

        games.listener!.onRole("player", "player");
        games.playerToken = undefined;
        sent = [];
        await fromApp({ kind: "mini_app_token_request" });

        expect(sent).toEqual([]);
    });

    test("asks the service to start the game, and tells the app whether it did", async () => {
        await opened("player", "player");
        await fromApp({ kind: "mini_app_ready" });
        sent = [];

        await fromApp({ kind: "mini_app_start" });
        games.started = { kind: "refused_by_bot", message: "Needs 2 players" };
        await fromApp({ kind: "mini_app_start" });
        games.started = { kind: "failed", message: key("bots.miniApp.refusals.notOpen") };
        await fromApp({ kind: "mini_app_start" });

        expect(sent).toEqual([
            { kind: "mini_app_start_result", accepted: true, message: undefined },
            { kind: "mini_app_start_result", accepted: false, message: "Needs 2 players" },
            {
                kind: "mini_app_start_result",
                accepted: false,
                message: "translated bots.miniApp.refusals.notOpen",
            },
        ]);
    });

    test("closes with the service's reason if the game can't be opened", async () => {
        games.opened({ kind: "failed", message: key("bots.miniApp.refusals.noSpectators") });
        await settle();

        expect(host.status).toEqual({
            kind: "closed",
            message: key("bots.miniApp.refusals.noSpectators"),
        });
    });

    test("closes when the service closes the game", async () => {
        await opened("player", "player");
        games.listener!.onClosed(key("bots.miniApp.closed"));

        expect(host.status).toEqual({ kind: "closed", message: key("bots.miniApp.closed") });
    });

    test("tells the app the theme changed only once it's initialised", async () => {
        host.setDarkMode(false);
        expect(sent).toEqual([]);

        await opened("spectator");
        await fromApp({ kind: "mini_app_ready" });
        expect(sent).toEqual([{ ...initialise("spectator"), dark_mode: false }]);

        sent = [];
        host.setDarkMode(true);
        expect(sent).toEqual([{ kind: "set_dark_mode", dark_mode: true }]);
    });

    test("closes the game when the frame closes, and stops listening to the app", async () => {
        await opened("player", "player");
        close();
        expect(games.closed).toBe(1);

        await fromApp({ kind: "mini_app_ready" });
        expect(sent).toEqual([]);
    });
});
