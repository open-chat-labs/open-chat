import type {
    MiniAppContent,
    MiniAppGameListener,
    MiniAppOpenOutcome,
    MiniAppStartOutcome,
    OpenChat,
    ResourceKey,
} from "@client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { MiniAppHost, type HostedMiniApp } from "./miniAppHost.svelte";

const APP: HostedMiniApp = {
    url: new URL("https://uno.example.com/app"),
    botName: "Uno",
    game: {
        chatId: { kind: "group_chat", groupId: "group" },
        threadRootMessageIndex: undefined,
        messageId: 7n,
    },
    content: {
        kind: "mini_app_content",
        text: "Uno",
        app: "uno",
        spectators: true,
        appSize: { width: 440, height: 740 },
        status: { kind: "open" },
    },
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
    opens = 0;
    closed = 0;
    playerToken: string | undefined = "fresh";
    started: MiniAppStartOutcome = { kind: "started" };

    openMiniApp(_: unknown, listener: MiniAppGameListener): Promise<MiniAppOpenOutcome> {
        this.opens++;
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

    function initialise(role: "player" | "spectator", token?: string, finished = false) {
        return {
            kind: "initialise_mini_app",
            role,
            user_id: "me",
            token,
            dark_mode: true,
            locale: "fr",
            finished,
        };
    }

    // The card once its game's over, with how it ended if the bot said
    function finished(players: string[], endState: string | undefined): MiniAppContent {
        return {
            ...APP.content,
            status: { kind: "finished", players, result: "Someone won", endState },
        };
    }

    const END_STATE = '{"board":"rnbqkbnr","moves":["e4"]}';
    const endState = { kind: "mini_app_end_state", state: { board: "rnbqkbnr", moves: ["e4"] } };

    // A host for a card that's already finished when its frame's shown
    function openFinished(players: string[], endState: string | undefined) {
        close();
        games = new FakeGames();
        host = new MiniAppHost(
            games,
            { ...APP, content: finished(players, endState) },
            {
                userId: "me",
                darkMode: true,
                locale: () => "fr",
                translate: (key) => `translated ${key.key}`,
            },
        );
        close = host.open(frame);
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

    // The service forgets a game once its card records the end, so its app can't be opened, which
    // isn't an error
    test("says a finished game has finished if the service doesn't know it", async () => {
        close();
        const finished: HostedMiniApp = {
            ...APP,
            content: {
                ...APP.content,
                status: { kind: "finished", players: [], result: undefined, endState: undefined },
            },
        };
        games = new FakeGames();
        host = new MiniAppHost(games, finished, {
            userId: "me",
            darkMode: true,
            locale: () => "fr",
            translate: (key) => `translated ${key.key}`,
        });
        close = host.open(frame);
        games.opened({ kind: "failed", message: key("bots.miniApp.refusals.unknownGame") });
        await settle();

        expect(host.status).toEqual({
            kind: "closed",
            message: key("bots.miniApp.refusals.finished"),
        });
    });

    describe("a finished game, shown from how it ended", () => {
        test("opens without the service, as a player if the user was one, and the app's told once it's ready", async () => {
            openFinished(["me", "bob"], END_STATE);
            expect(games.opens).toBe(0);
            expect(host.status).toEqual({ kind: "open", role: "player" });
            expect(sent).toEqual([]);

            await fromApp({ kind: "mini_app_ready" });
            expect(sent).toEqual([initialise("player", undefined, true), endState]);
            expect(origins).toEqual(new Set([ORIGIN]));

            // nothing to close with the service when the frame goes
            close();
            expect(games.closed).toBe(0);
        });

        test("as a spectator if the user wasn't playing", async () => {
            openFinished(["alice", "bob"], END_STATE);
            await fromApp({ kind: "mini_app_ready" });
            expect(host.status).toEqual({ kind: "open", role: "spectator" });
            expect(sent).toEqual([initialise("spectator", undefined, true), endState]);
        });

        test("goes through the service if the card doesn't say how it ended, or says it unreadably", async () => {
            openFinished(["me"], undefined);
            expect(games.opens).toBe(1);
            expect(host.status).toEqual({ kind: "opening" });

            openFinished(["me"], "{not json");
            expect(games.opens).toBe(1);
            expect(host.status).toEqual({ kind: "opening" });
        });

        test("doesn't ask the service for a token, or to start, once the game's over", async () => {
            openFinished(["me"], END_STATE);
            await fromApp({ kind: "mini_app_ready" });
            sent = [];

            await fromApp({ kind: "mini_app_token_request" });
            await fromApp({ kind: "mini_app_start" });
            expect(sent).toEqual([]);
        });
    });

    describe("when the card records the end of a game that's open", () => {
        test("the app's told how it ended, and the service is done with", async () => {
            await opened("player", "player");
            await fromApp({ kind: "mini_app_ready" });
            games.listener!.onState(state(9));
            sent = [];

            host.setContent(finished(["me"], END_STATE));
            expect(sent).toEqual([endState]);
            expect(games.closed).toBe(1);
            expect(host.status).toEqual({ kind: "open", role: "player" });

            // the app's initialised from the end if it reloads itself
            sent = [];
            await fromApp({ kind: "mini_app_ready" });
            expect(sent).toEqual([initialise("player", undefined, true), endState]);

            // and the frame closing has nothing more to close
            close();
            expect(games.closed).toBe(1);
        });

        test("the app hears the end once it's ready, if it wasn't yet", async () => {
            await opened("spectator");
            games.listener!.onState(state(9));
            host.setContent(finished(["alice"], END_STATE));
            expect(sent).toEqual([]);

            await fromApp({ kind: "mini_app_ready" });
            expect(sent).toEqual([initialise("spectator", undefined, true), endState]);
        });

        test("nothing changes for the app if the card doesn't say how it ended", async () => {
            await opened("player", "player");
            await fromApp({ kind: "mini_app_ready" });
            sent = [];

            host.setContent(finished(["me"], undefined));
            expect(sent).toEqual([]);
            expect(games.closed).toBe(0);
            expect(host.status).toEqual({ kind: "open", role: "player" });
        });

        test("an opening still with the service is given up, and the end shown instead", async () => {
            const first = games.opened;
            host.setContent(finished(["alice"], END_STATE));
            expect(games.closed).toBe(1);
            expect(host.status).toEqual({ kind: "open", role: "spectator" });

            // the service's answer comes too late to matter
            first({ kind: "opened", role: "player", playerToken: "late" });
            await settle();
            expect(host.status).toEqual({ kind: "open", role: "spectator" });

            await fromApp({ kind: "mini_app_ready" });
            expect(sent).toEqual([initialise("spectator", undefined, true), endState]);
        });

        test("a game the service had closed is shown from its end", async () => {
            await opened("player", "player");
            games.listener!.onClosed(key("bots.miniApp.closed"));
            expect(host.status.kind).toBe("closed");

            host.setContent(finished(["me"], END_STATE));
            expect(host.status).toEqual({ kind: "open", role: "player" });
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

    test("opens the game afresh with a new frame, which hears nothing until its own app's ready", async () => {
        await fromApp({ kind: "mini_app_ready" });
        await opened("player", "first");
        games.listener!.onState(state(3));
        close();

        const second = document.createElement("iframe");
        document.body.appendChild(second);
        const sentToSecond: unknown[] = [];
        vi.spyOn(second.contentWindow!, "postMessage").mockImplementation((message: unknown) => {
            sentToSecond.push(message);
        });
        const sentToFirst = sent.length;
        close = host.open(second);
        expect(host.status).toEqual({ kind: "opening" });

        // the service answers the new opening, but the new app isn't ready
        games.opened({ kind: "opened", role: "player", playerToken: "second" });
        await settle();
        expect(sentToSecond).toEqual([]);

        // then it gets its role, and the state the host held meanwhile, which the service's next
        // state replaces or follows
        await fromApp({ kind: "mini_app_ready" }, ORIGIN, second.contentWindow);
        expect(sentToSecond).toEqual([
            initialise("player", "second"),
            { kind: "mini_app_state", seq: 3, shared: { seq: 3 }, private: undefined },
        ]);
        expect(sent.length).toBe(sentToFirst);
        second.remove();
    });

    test("forgets a failed opening when it's reset, so a new frame tries again", async () => {
        games.opened({ kind: "failed", message: key("bots.miniApp.refusals.unreachable") });
        await settle();
        expect(host.status.kind).toBe("closed");

        host.reset();
        expect(host.status).toEqual({ kind: "opening" });
    });

    test("ignores how an opening went once another frame has been given", async () => {
        const first = games.opened;
        close();
        const second = document.createElement("iframe");
        document.body.appendChild(second);
        close = host.open(second);

        // the first frame's opening comes back late, and failed
        first({ kind: "failed", message: key("bots.miniApp.refusals.unreachable") });
        await settle();
        expect(host.status).toEqual({ kind: "opening" });

        games.opened({ kind: "opened", role: "spectator", playerToken: undefined });
        await settle();
        expect(host.status).toEqual({ kind: "open", role: "spectator" });
        second.remove();
    });
});
