import type { MiniAppGame, MiniAppGameListener, MiniAppLiveCard, ReadonlyMap } from "@shared";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { miniAppGameKey } from "./miniApp";
import { MiniAppService, type MiniAppSocket } from "./miniAppService";
import { writable, type Writable } from "./stores";

const HOUR_MS = 60 * 60 * 1000;

const GAME: MiniAppGame = {
    chatId: { kind: "group_chat", groupId: "group" },
    threadRootMessageIndex: undefined,
    messageId: 18446744073709551615n,
};
const WIRE_GAME = { chat: { Group: "group" }, thread: null, message_id: "18446744073709551615" };

const OTHER_GAME: MiniAppGame = {
    chatId: { kind: "channel", communityId: "community", channelId: 7 },
    threadRootMessageIndex: 3,
    messageId: 12n,
};
const OTHER_WIRE_GAME = { chat: { Channel: ["community", 7] }, thread: 3, message_id: "12" };

class FakeSocket implements MiniAppSocket {
    onopen: (() => void) | null = null;
    onmessage: ((ev: MessageEvent) => void) | null = null;
    onclose: (() => void) | null = null;
    sent: Record<string, unknown>[] = [];

    constructor(readonly url: string) {}

    send(data: string): void {
        this.sent.push(JSON.parse(data));
    }

    receive(message: object): void {
        this.onmessage?.(new MessageEvent("message", { data: JSON.stringify(message) }));
    }

    // The service's side of connecting: the socket opens, and the service takes `connect`
    accept(): void {
        this.onopen?.();
        this.receive({ type: "connected", user_id: "me" });
    }

    drop(): void {
        this.onclose?.();
    }

    lastRequest(): Record<string, unknown> {
        return this.sent[this.sent.length - 1];
    }
}

// A chat token as the LocalUserIndex signs it, lasting an hour, which the service only reads
function chatToken(member: boolean, n: number): string {
    const claims = {
        exp: Math.floor((Date.now() + HOUR_MS) / 1000),
        claim_type: "MiniAppChat",
        member,
    };
    return `header.${btoa(JSON.stringify(claims))}.signature${n}`;
}

describe("MiniAppService", () => {
    let sockets: FakeSocket[];
    let cards: Writable<ReadonlyMap<string, MiniAppLiveCard>>;
    // the chat tokens got, in order
    let tokens: string[];
    let member: boolean;
    let service: MiniAppService;

    beforeEach(() => {
        vi.useFakeTimers();
        sockets = [];
        cards = writable(new Map());
        tokens = [];
        member = true;
        service = new MiniAppService({
            url: "https://minigames.example.com",
            chatToken: async () => {
                tokens.push(chatToken(member, tokens.length + 1));
                return tokens[tokens.length - 1];
            },
            cards,
            createSocket: (url) => {
                const socket = new FakeSocket(url);
                sockets.push(socket);
                return socket;
            },
        });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    // Lets the service's promises settle
    const settle = () => vi.advanceTimersByTimeAsync(0);

    function socket(): FakeSocket {
        return sockets[sockets.length - 1];
    }

    function listener(): MiniAppGameListener & { calls: unknown[][] } {
        const calls: unknown[][] = [];
        return {
            calls,
            onState: (state) => calls.push(["state", state]),
            onRole: (role, token) => calls.push(["role", role, token]),
            onClosed: (message) => calls.push(["closed", message.key]),
        };
    }

    async function connected(): Promise<FakeSocket> {
        await settle();
        socket().accept();
        await settle();
        return socket();
    }

    test("connects only once a card comes into view, with a chat token first", async () => {
        await settle();
        expect(sockets).toEqual([]);

        service.follow(GAME);
        await settle();
        expect(socket().url).toBe("wss://minigames.example.com/ws");

        socket().onopen?.();
        expect(socket().sent).toEqual([{ type: "connect", chat_token: tokens[0] }]);
    });

    test("follows the cards in view together, and shows each card the service pushes", async () => {
        service.follow(GAME);
        service.follow(GAME);
        service.follow({ ...GAME, messageId: 5n });
        const ws = await connected();

        expect(ws.lastRequest()).toEqual({
            type: "follow",
            id: 1,
            chat_token: tokens[0],
            games: [WIRE_GAME, { ...WIRE_GAME, message_id: "5" }],
        });

        ws.receive({ type: "ok", id: 1 });
        ws.receive({
            type: "card",
            game: WIRE_GAME,
            status: "Active",
            players: ["alice", "bob"],
            waiting_for: ["bob"],
            watching: 3,
            result: null,
        });

        expect(cards.value.get(miniAppGameKey(GAME))).toEqual({
            status: "active",
            players: ["alice", "bob"],
            waitingFor: ["bob"],
            watching: 3,
            result: undefined,
            member: true,
        });
    });

    test("a card says whether the user may join, as their chat token does", async () => {
        member = false;
        service.follow(GAME);
        const ws = await connected();
        ws.receive({
            type: "card",
            game: WIRE_GAME,
            status: "Finished",
            players: ["alice"],
            waiting_for: [],
            watching: 0,
            result: "Alice won",
        });

        expect(cards.value.get(miniAppGameKey(GAME))).toMatchObject({
            status: "finished",
            result: "Alice won",
            member: false,
        });
    });

    test("a user who joins the chat gets a fresh token, which lets them join its games", async () => {
        member = false;
        service.follow(GAME);
        const ws = await connected();
        ws.receive({ type: "ok", id: 1 });
        const card = {
            type: "card",
            game: WIRE_GAME,
            status: "Open",
            players: [],
            waiting_for: [],
            watching: 0,
            result: null,
        };
        ws.receive(card);
        expect(cards.value.get(miniAppGameKey(GAME))?.member).toBe(false);

        member = true;
        service.joinedChat(GAME.chatId);
        await settle();
        expect(ws.lastRequest()).toEqual({
            type: "follow",
            id: 2,
            chat_token: tokens[1],
            games: [WIRE_GAME],
        });
        ws.receive({ type: "ok", id: 2 });
        ws.receive(card);
        expect(cards.value.get(miniAppGameKey(GAME))?.member).toBe(true);
    });

    test("unfollows the cards of a chat the user leaves", async () => {
        service.follow(GAME);
        const ws = await connected();
        ws.receive({ type: "ok", id: 1 });
        ws.receive({
            type: "card",
            game: WIRE_GAME,
            status: "Open",
            players: [],
            waiting_for: [],
            watching: 0,
            result: null,
        });

        service.viewChat(GAME.chatId);
        expect(ws.sent.map((m) => m.type)).toEqual(["connect", "follow"]);

        service.viewChat(OTHER_GAME.chatId);
        expect(ws.lastRequest()).toEqual({ type: "unfollow", games: [WIRE_GAME] });
        expect(cards.value.size).toBe(0);

        // a card pushed meanwhile isn't shown
        ws.receive({
            type: "card",
            game: WIRE_GAME,
            status: "Open",
            players: [],
            waiting_for: [],
            watching: 0,
            result: null,
        });
        expect(cards.value.size).toBe(0);
    });

    test("matches each reply to its request, whatever order they come in", async () => {
        service.follow(GAME);
        const ws = await connected();
        ws.receive({ type: "ok", id: 1 });

        const join = service.join(GAME);
        await settle();
        const joinRequest = ws.lastRequest();
        const start = service.start(GAME);
        await settle();
        const startRequest = ws.lastRequest();
        const token = service.playerToken(GAME);
        await settle();
        const tokenRequest = ws.lastRequest();

        expect(joinRequest).toEqual({
            type: "join",
            id: 2,
            chat_token: tokens[0],
            game: WIRE_GAME,
        });
        expect(startRequest).toEqual({ type: "start", id: 3, game: WIRE_GAME });
        expect(tokenRequest).toEqual({ type: "player_token", id: 4, game: WIRE_GAME });

        ws.receive({ type: "player_token", id: 4, token: "fresh" });
        ws.receive({
            type: "refused",
            id: 3,
            reason: "refused_by_bot",
            message: "Needs 2 players",
        });
        ws.receive({ type: "joined", id: 2, player_token: "player" });

        expect(await join).toEqual({ kind: "success" });
        expect(await start).toEqual({ kind: "refused_by_bot", message: "Needs 2 players" });
        expect(await token).toBe("fresh");
    });

    test("says why a request was refused", async () => {
        service.follow(GAME);
        const ws = await connected();

        const join = service.join(GAME);
        await settle();
        ws.receive({ type: "refused", id: 2, reason: "full" });
        expect(await join).toEqual({
            kind: "failed",
            message: expect.objectContaining({ key: "bots.miniApp.refusals.full" }),
        });

        const leave = service.leave(GAME);
        await settle();
        ws.receive({ type: "ok", id: 3 });
        expect(await leave).toEqual({ kind: "success" });

        const start = service.start(GAME);
        await settle();
        ws.receive({ type: "ok", id: 4 });
        expect(await start).toEqual({ kind: "started" });
    });

    test("asks again with a fresh chat token if one's refused", async () => {
        service.follow(GAME);
        const ws = await connected();
        expect(tokens.length).toBe(1);

        const join = service.join(GAME);
        await settle();
        ws.receive({ type: "refused", id: 2, reason: "invalid_token" });
        await settle();

        expect(tokens.length).toBe(2);
        expect(ws.lastRequest()).toEqual({
            type: "join",
            id: 3,
            chat_token: tokens[1],
            game: WIRE_GAME,
        });
        ws.receive({ type: "joined", id: 3, player_token: "player" });
        expect(await join).toEqual({ kind: "success" });
    });

    test("opens a game, and passes its pushes to the frame showing it until it's closed", async () => {
        const frame = listener();
        const open = service.open(GAME, frame);
        const ws = await connected();

        expect(ws.lastRequest()).toEqual({
            type: "open",
            id: 1,
            chat_token: tokens[0],
            game: WIRE_GAME,
        });
        ws.receive({ type: "opened", id: 1, role: "spectator" });
        expect(await open).toEqual({ kind: "opened", role: "spectator", playerToken: undefined });

        ws.receive({ type: "state", game: WIRE_GAME, seq: 4, shared: { board: 1 } });
        ws.receive({ type: "role", game: WIRE_GAME, role: "player", player_token: "player" });
        ws.receive({
            type: "state",
            game: WIRE_GAME,
            seq: 4,
            shared: { board: 1 },
            private: { hand: [2] },
        });
        // another game's
        ws.receive({ type: "state", game: OTHER_WIRE_GAME, seq: 9, shared: {} });

        expect(frame.calls).toEqual([
            ["state", { seq: 4, shared: { board: 1 }, private: undefined }],
            ["role", "player", "player"],
            ["state", { seq: 4, shared: { board: 1 }, private: { hand: [2] } }],
        ]);

        service.close(GAME);
        expect(ws.lastRequest()).toEqual({ type: "close", game: WIRE_GAME });
        ws.receive({ type: "state", game: WIRE_GAME, seq: 5, shared: {} });
        expect(frame.calls.length).toBe(3);
    });

    test("tells the frame when the service closes its game", async () => {
        const frame = listener();
        const open = service.open(GAME, frame);
        const ws = await connected();
        ws.receive({ type: "opened", id: 1, role: "player", player_token: "player" });
        expect(await open).toEqual({ kind: "opened", role: "player", playerToken: "player" });

        ws.receive({ type: "closed", game: WIRE_GAME });
        expect(frame.calls).toEqual([["closed", "bots.miniApp.closed"]]);

        // so it isn't sent `close`
        service.close(GAME);
        expect(ws.lastRequest().type).toBe("open");
    });

    test("a game which can't be opened isn't kept open", async () => {
        const open = service.open(GAME, listener());
        const ws = await connected();
        ws.receive({ type: "refused", id: 1, reason: "no_spectators" });

        expect(await open).toEqual({
            kind: "failed",
            message: expect.objectContaining({ key: "bots.miniApp.refusals.noSpectators" }),
        });
        service.close(GAME);
        expect(ws.lastRequest().type).toBe("open");
    });

    test("reconnects, backing off, then follows and opens again what it had", async () => {
        service.follow(GAME);
        const first = await connected();
        first.receive({ type: "ok", id: 1 });
        const frame = listener();
        const open = service.open(OTHER_GAME, frame);
        await settle();
        first.receive({ type: "opened", id: 2, role: "spectator" });
        await open;

        // a request in flight when the socket drops fails
        const join = service.join(GAME);
        await settle();
        first.drop();
        expect(await join).toEqual({
            kind: "failed",
            message: expect.objectContaining({ key: "bots.miniApp.refusals.unreachable" }),
        });

        await vi.advanceTimersByTimeAsync(999);
        expect(sockets.length).toBe(1);
        await vi.advanceTimersByTimeAsync(1);
        expect(sockets.length).toBe(2);

        // the service is still down, so it waits twice as long
        socket().drop();
        await vi.advanceTimersByTimeAsync(1999);
        expect(sockets.length).toBe(2);
        await vi.advanceTimersByTimeAsync(1);
        expect(sockets.length).toBe(3);

        const second = await connected();
        // the chat tokens it already had
        expect(tokens.length).toBe(2);
        expect(second.sent).toEqual([
            { type: "connect", chat_token: tokens[0] },
            { type: "follow", id: 4, chat_token: tokens[0], games: [WIRE_GAME] },
            {
                type: "open",
                id: 5,
                chat_token: tokens[1],
                game: OTHER_WIRE_GAME,
            },
        ]);

        // the user joined meanwhile
        second.receive({ type: "opened", id: 5, role: "player", player_token: "player" });
        await settle();
        expect(frame.calls).toEqual([["role", "player", "player"]]);

        // and once it's connected again, it backs off from the start
        second.drop();
        await vi.advanceTimersByTimeAsync(1000);
        expect(sockets.length).toBe(4);
    });

    test("closes a frame whose game can't be opened again after reconnecting", async () => {
        const frame = listener();
        const open = service.open(GAME, frame);
        const first = await connected();
        first.receive({ type: "opened", id: 1, role: "spectator" });
        await open;

        first.drop();
        await vi.advanceTimersByTimeAsync(1000);
        const second = await connected();
        second.receive({ type: "refused", id: 2, reason: "unknown_game" });
        await settle();

        expect(frame.calls).toEqual([["closed", "bots.miniApp.refusals.unknownGame"]]);
    });

    test("doesn't reconnect once there's nothing to follow or open", async () => {
        service.follow(GAME);
        const ws = await connected();
        service.viewChat(undefined);
        ws.drop();

        await vi.advanceTimersByTimeAsync(60_000);
        expect(sockets.length).toBe(1);
    });

    test("keeps a chat token until shortly before it expires", async () => {
        service.follow(GAME);
        const ws = await connected();
        expect(tokens.length).toBe(1);

        await vi.advanceTimersByTimeAsync(50 * 60 * 1000);
        void service.join(GAME);
        await settle();
        expect(tokens.length).toBe(1);

        await vi.advanceTimersByTimeAsync(6 * 60 * 1000);
        void service.join(GAME);
        await settle();
        expect(tokens.length).toBe(2);
        expect(ws.lastRequest()).toMatchObject({
            type: "join",
            chat_token: tokens[1],
        });
    });

    test("connects again with a fresh token if the service won't take the one it had", async () => {
        service.follow(GAME);
        await settle();
        socket().onopen?.();
        socket().receive({ type: "error", code: "invalid_token" });
        socket().drop();

        await vi.advanceTimersByTimeAsync(1000);
        socket().onopen?.();
        expect(tokens.length).toBe(2);
        expect(socket().sent).toEqual([{ type: "connect", chat_token: tokens[1] }]);
    });
});
