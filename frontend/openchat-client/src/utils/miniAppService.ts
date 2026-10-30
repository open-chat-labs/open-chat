import {
    chatIdentifierToString,
    i18nKey,
    type ChatIdentifier,
    type MiniAppGame,
    type MiniAppLiveCard,
    type MiniAppOpenOutcome,
    type MiniAppOutcome,
    type MiniAppRefusal,
    type MiniAppRole,
    type MiniAppStartOutcome,
    type MiniAppState,
    type MultiUserChatIdentifier,
    type ReadonlyMap,
    type ResourceKey,
} from "@shared";
import { jwtClaims, jwtExpiryMs } from "./jwt";
import { miniAppFailureMessage, miniAppGameKey } from "./miniApp";
import type { Writable } from "./stores";

// A chat token is used until this long before it expires, after which a fresh one is got
const CHAT_TOKEN_MARGIN_MS = 5 * 60 * 1000;
const RECONNECT_MIN_MS = 1000;
const RECONNECT_MAX_MS = 30_000;
// Longer than the 5 seconds the service gives a bot. A socket which takes longer to answer has
// probably stopped working without closing, as a phone's often does, so it's closed.
const REQUEST_TIMEOUT_MS = 15_000;
// How long a socket with nothing to follow or open is kept, in case the user's only switching chats
const IDLE_CLOSE_MS = 60_000;

// The WebSocket's messages, as backend/mini_app_service/src/protocol.rs reads and writes them
type WireChat = { Group: string } | { Channel: [string, number] };
type WireGame = { chat: WireChat; thread: number | null; message_id: string };

type ClientMessage =
    | { type: "connect"; chat_token: string }
    | { type: "follow"; id: number; chat_token: string; games: WireGame[] }
    | { type: "unfollow"; games: WireGame[] }
    | { type: "join"; id: number; chat_token: string; game: WireGame }
    | { type: "open"; id: number; chat_token: string; game: WireGame }
    | { type: "close"; game: WireGame }
    | { type: "player_token"; id: number; game: WireGame }
    | { type: "leave"; id: number; game: WireGame }
    | { type: "start"; id: number; game: WireGame };

type Reply =
    | { type: "ok"; id: number }
    | { type: "joined"; id: number; player_token: string }
    | { type: "opened"; id: number; role: MiniAppRole; player_token?: string }
    | { type: "player_token"; id: number; token: string }
    | { type: "refused"; id: number; reason: MiniAppRefusal; message?: string };

type Push =
    | { type: "connected"; user_id: string }
    | { type: "error"; code: "invalid_token" | "invalid_message" }
    | {
          type: "card";
          game: WireGame;
          status: "Open" | "Active" | "Finished";
          players: string[];
          waiting_for: string[];
          watching: number;
          result: string | null;
      }
    | { type: "state"; game: WireGame; seq: number; shared: unknown; private?: unknown }
    | { type: "role"; game: WireGame; role: MiniAppRole; player_token?: string }
    | { type: "closed"; game: WireGame };

// What the service tells a frame showing a game, once it's opened
export type MiniAppGameListener = {
    // the latest state, and each one after it
    onState: (state: MiniAppState) => void;
    // the user's role changed, as they joined, left or were removed, or did while the socket was down
    onRole: (role: MiniAppRole, playerToken: string | undefined) => void;
    // the game can't be shown any more, eg. the user stopped playing a game that can't be watched
    onClosed: (message: ResourceKey) => void;
};

// The parts of a WebSocket the service uses
export type MiniAppSocket = Pick<WebSocket, "send" | "close" | "onopen" | "onmessage" | "onclose">;

export type MiniAppServiceDeps = {
    // the service's URL, whose WebSocket is at /ws
    url: string;
    // a token which says the user can see the chat, and whether they're a member
    chatToken: (chatId: MultiUserChatIdentifier) => Promise<string | undefined>;
    // where the live cards go, keyed by `miniAppGameKey`
    cards: Writable<ReadonlyMap<string, MiniAppLiveCard>>;
    createSocket?: (url: string) => MiniAppSocket;
};

type ChatToken = { token: string; member: boolean };

type CachedChatToken = { token: Promise<ChatToken | undefined>; usableUntil: number };

type FollowedChat = {
    chatId: MultiUserChatIdentifier;
    // by `miniAppGameKey`
    games: Map<string, MiniAppGame>;
    // cards which came into view since the last `follow`, which go in the next
    unsent: MiniAppGame[];
    // from the chat token the games were followed with
    member: boolean;
};

type OpenGame = {
    game: MiniAppGame;
    // the frames showing it, eg. a card's in the chat and in a thread, each told what happens to it
    listeners: Set<MiniAppGameListener>;
    // whether the service has it open on the current socket
    opened: boolean;
    // whether the frame has had a state, which it keeps if the game ends while the socket's down
    hadState: boolean;
};

/**
 * The website's WebSocket to OpenChat's MiniApp service (backend/docs/mini_app_service_protocol.md),
 * through which users follow the live cards of games in messages, join and leave them, open them and
 * start them.
 *
 * It connects once a card comes into view. If the socket drops it reconnects, backing off, and follows
 * and opens again whatever it had. Chat tokens are kept, one per chat, until shortly before they
 * expire.
 */
export class MiniAppService {
    readonly #deps: MiniAppServiceDeps;
    readonly #createSocket: (url: string) => MiniAppSocket;
    // by chat
    #chatTokens = new Map<string, CachedChatToken>();
    // the socket, once the service has taken its `connect`
    #socket: MiniAppSocket | undefined;
    // resolves to the socket once it's connected, or undefined if it couldn't be
    #connecting: Promise<MiniAppSocket | undefined> | undefined;
    // closes the socket being connected or connected, at once, whether or not it answers
    #closeSocket: (() => void) | undefined;
    #idleTimer: ReturnType<typeof setTimeout> | undefined;
    #nextRequestId = 0;
    #pending = new Map<number, (reply: Reply | undefined) => void>();
    // by chat
    #followed = new Map<string, FollowedChat>();
    // by `miniAppGameKey`
    #open = new Map<string, OpenGame>();
    #reconnectAttempts = 0;
    #reconnectTimer: ReturnType<typeof setTimeout> | undefined;

    constructor(deps: MiniAppServiceDeps) {
        this.#deps = deps;
        this.#createSocket = deps.createSocket ?? ((url) => new WebSocket(url));
    }

    /** Follows a game's card, which has come into view. Cards in view together are followed together. */
    follow(game: MiniAppGame): void {
        const chatKey = chatIdentifierToString(game.chatId);
        let chat = this.#followed.get(chatKey);
        if (chat === undefined) {
            chat = { chatId: game.chatId, games: new Map(), unsent: [], member: false };
            this.#followed.set(chatKey, chat);
        }
        const key = miniAppGameKey(game);
        if (chat.games.has(key)) return;

        chat.games.set(key, game);
        chat.unsent.push(game);
        if (chat.unsent.length === 1) {
            const followed = chat;
            queueMicrotask(() => {
                const games = followed.unsent;
                followed.unsent = [];
                void this.#follow(followed, games);
            });
        }
    }

    /** Unfollows the cards of every chat but the one being viewed */
    viewChat(chatId: ChatIdentifier | undefined): void {
        const viewing = chatId === undefined ? undefined : chatIdentifierToString(chatId);
        const unfollowed: string[] = [];
        for (const [chatKey, chat] of this.#followed) {
            if (chatKey === viewing) continue;
            this.#followed.delete(chatKey);
            this.#send({ type: "unfollow", games: [...chat.games.values()].map(wireGame) });
            unfollowed.push(...chat.games.keys());
        }
        if (unfollowed.length > 0) {
            this.#deps.cards.update((cards) => {
                const updated = new Map(cards);
                unfollowed.forEach((key) => updated.delete(key));
                return updated;
            });
        }
        this.#closeIfIdle();
    }

    /** The app's back after being suspended, so the socket may have stopped working without closing */
    resume(): void {
        clearTimeout(this.#reconnectTimer);
        this.#reconnectTimer = undefined;
        this.#reconnectAttempts = 0;
        void this.#reconnect();
    }

    /**
     * The user joined a chat, so they may join its games now, as a fresh chat token says. Its cards are
     * followed again with it.
     */
    joinedChat(chatId: MultiUserChatIdentifier): void {
        this.#dropChatToken(chatId);
        const chat = this.#followed.get(chatIdentifierToString(chatId));
        if (chat !== undefined) {
            void this.#follow(chat, [...chat.games.values()]);
        }
    }

    async join(game: MiniAppGame): Promise<MiniAppOutcome> {
        const reply = await this.#requestWithChatToken(game.chatId, (id, chatToken) => ({
            type: "join",
            id,
            chat_token: chatToken.token,
            game: wireGame(game),
        }));
        return reply?.type === "joined" ? { kind: "success" } : failed(reply);
    }

    async leave(game: MiniAppGame): Promise<MiniAppOutcome> {
        const reply = await this.#request(game.chatId, (id) => ({
            type: "leave",
            id,
            game: wireGame(game),
        }));
        return reply?.type === "ok" ? { kind: "success" } : failed(reply);
    }

    /**
     * Opens a game, as its app is shown, after which `listener` hears what happens until it's closed.
     * A game shown by several frames at once is open until the last of them closes it.
     */
    async open(game: MiniAppGame, listener: MiniAppGameListener): Promise<MiniAppOpenOutcome> {
        const key = miniAppGameKey(game);
        let open = this.#open.get(key);
        if (open === undefined) {
            open = { game, listeners: new Set(), opened: false, hadState: false };
            this.#open.set(key, open);
        }
        open.listeners.add(listener);
        const reply = await this.#openRequest(game);
        if (reply?.type === "opened") {
            this.#opened(key, open);
            return { kind: "opened", role: reply.role, playerToken: reply.player_token };
        }
        if (this.#open.get(key) === open) {
            this.#drop(key, open, listener);
        }
        return failed(reply);
    }

    close(game: MiniAppGame, listener: MiniAppGameListener): void {
        const key = miniAppGameKey(game);
        const open = this.#open.get(key);
        if (open === undefined || !open.listeners.has(listener)) return;
        if (this.#drop(key, open, listener) && open.opened) {
            // otherwise it's closed once it's opened
            this.#send({ type: "close", game: wireGame(game) });
        }
    }

    // Takes a frame off a game, and the game off the open ones if it was the last. Returns whether
    // it was.
    #drop(key: string, open: OpenGame, listener: MiniAppGameListener): boolean {
        open.listeners.delete(listener);
        if (open.listeners.size > 0) return false;
        this.#open.delete(key);
        this.#closeIfIdle();
        return true;
    }

    /** A fresh token for a game the user's playing, which their app asked for */
    async playerToken(game: MiniAppGame): Promise<string | undefined> {
        const reply = await this.#request(game.chatId, (id) => ({
            type: "player_token",
            id,
            game: wireGame(game),
        }));
        return reply?.type === "player_token" ? reply.token : undefined;
    }

    /** Asks the bot to start a game the user's playing */
    async start(game: MiniAppGame): Promise<MiniAppStartOutcome> {
        const reply = await this.#request(game.chatId, (id) => ({
            type: "start",
            id,
            game: wireGame(game),
        }));
        if (reply?.type === "ok") return { kind: "started" };
        if (reply?.type === "refused" && reply.reason === "refused_by_bot") {
            return { kind: "refused_by_bot", message: reply.message };
        }
        return failed(reply);
    }

    async #follow(chat: FollowedChat, games: MiniAppGame[]): Promise<void> {
        const reply = await this.#requestWithChatToken(chat.chatId, (id, chatToken) => {
            chat.member = chatToken.member;
            return { type: "follow", id, chat_token: chatToken.token, games: games.map(wireGame) };
        });
        if (reply === undefined) {
            // eg. there was no chat token, or no socket, so they're followed again later
            this.#reconnectLater();
        } else if (reply.type === "refused") {
            console.warn("The MiniApp service refused to follow the chat's games", reply);
        } else {
            // games whose chat the user left while they were being followed, unless they've been
            // followed again since
            const current = this.#followed.get(chatIdentifierToString(chat.chatId));
            const left = games.filter((game) => !current?.games.has(miniAppGameKey(game)));
            if (left.length > 0) {
                this.#send({ type: "unfollow", games: left.map(wireGame) });
            }
        }
    }

    #openRequest(game: MiniAppGame): Promise<Reply | undefined> {
        return this.#requestWithChatToken(game.chatId, (id, chatToken) => ({
            type: "open",
            id,
            chat_token: chatToken.token,
            game: wireGame(game),
        }));
    }

    // Sends a request with the chat's token, and if the token's refused, eg. it expired early, sends
    // it once more with a fresh one
    async #requestWithChatToken(
        chatId: MultiUserChatIdentifier,
        build: (id: number, chatToken: ChatToken) => ClientMessage,
    ): Promise<Reply | undefined> {
        for (let attempt = 0; ; attempt++) {
            const chatToken = await this.#chatToken(chatId);
            if (chatToken === undefined) return undefined;
            const reply = await this.#request(chatId, (id) => build(id, chatToken));
            if (reply?.type !== "refused" || reply.reason !== "invalid_token" || attempt > 0) {
                return reply;
            }
            this.#dropChatToken(chatId);
        }
    }

    // Undefined if there's no socket, or it closes or times out before the reply
    async #request(
        chatId: MultiUserChatIdentifier,
        build: (id: number) => ClientMessage,
    ): Promise<Reply | undefined> {
        const socket = await this.#connected(chatId);
        if (socket === undefined) return undefined;
        const id = ++this.#nextRequestId;
        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                if (this.#pending.delete(id)) {
                    resolve(undefined);
                    // so it reconnects
                    this.#closeSocket?.();
                }
            }, REQUEST_TIMEOUT_MS);
            this.#pending.set(id, (reply) => {
                clearTimeout(timeout);
                resolve(reply);
            });
            socket.send(JSON.stringify(build(id)));
        });
    }

    #send(message: ClientMessage): void {
        this.#socket?.send(JSON.stringify(message));
    }

    // Connects, if there's no socket, with the token of `chatId`, the chat of whatever's asked for
    #connected(chatId: MultiUserChatIdentifier): Promise<MiniAppSocket | undefined> {
        if (this.#connecting === undefined) {
            const connecting = this.#connect(chatId);
            this.#connecting = connecting;
            void connecting.then((socket) => {
                if (socket === undefined && this.#connecting === connecting) {
                    this.#connecting = undefined;
                }
            });
        }
        return this.#connecting;
    }

    async #connect(chatId: MultiUserChatIdentifier): Promise<MiniAppSocket | undefined> {
        try {
            const chatToken = await this.#chatToken(chatId);
            if (chatToken === undefined) return undefined;
            const url = new URL("/ws", this.#deps.url);
            url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
            const socket = this.#createSocket(url.toString());
            return await new Promise((resolve) => {
                let closed = false;
                // the service closes a socket that doesn't connect, but one which has stopped
                // working may never close
                const timeout = setTimeout(() => this.#closeSocket?.(), REQUEST_TIMEOUT_MS);
                const onClose = () => {
                    if (closed) return;
                    closed = true;
                    clearTimeout(timeout);
                    resolve(undefined);
                    this.#onClose();
                };
                this.#closeSocket = () => {
                    socket.close();
                    onClose();
                };
                socket.onopen = () =>
                    socket.send(JSON.stringify({ type: "connect", chat_token: chatToken.token }));
                socket.onmessage = (ev: MessageEvent) => {
                    const message = parse(ev.data);
                    if (closed || message === undefined) return;
                    if (message.type === "connected") {
                        clearTimeout(timeout);
                        this.#socket = socket;
                        this.#reconnectAttempts = 0;
                        resolve(socket);
                    } else if (message.type === "error" && message.code === "invalid_token") {
                        // the socket closes, and reconnects with a fresh token
                        this.#dropChatToken(chatId);
                    } else {
                        this.#onMessage(message);
                    }
                };
                socket.onclose = onClose;
            });
        } catch (err) {
            console.warn("Couldn't connect to the MiniApp service", err);
            return undefined;
        }
    }

    // There's one socket at a time, from when it's created until it closes
    #onClose(): void {
        this.#socket = undefined;
        this.#connecting = undefined;
        this.#closeSocket = undefined;
        for (const open of this.#open.values()) {
            open.opened = false;
        }
        const pending = [...this.#pending.values()];
        this.#pending.clear();
        pending.forEach((resolve) => resolve(undefined));
        this.#reconnectLater();
    }

    // A socket with nothing to follow or open is closed after a while
    #closeIfIdle(): void {
        if (this.#wanted() || this.#idleTimer !== undefined) return;
        this.#idleTimer = setTimeout(() => {
            this.#idleTimer = undefined;
            if (!this.#wanted()) {
                this.#closeSocket?.();
            }
        }, IDLE_CLOSE_MS);
    }

    #reconnectLater(): void {
        if (this.#reconnectTimer !== undefined || !this.#wanted()) return;
        const delay = Math.min(RECONNECT_MAX_MS, RECONNECT_MIN_MS * 2 ** this.#reconnectAttempts);
        this.#reconnectAttempts++;
        this.#reconnectTimer = setTimeout(() => {
            this.#reconnectTimer = undefined;
            void this.#reconnect();
        }, delay);
    }

    // Follows and opens again whatever was followed and open when the socket dropped
    async #reconnect(): Promise<void> {
        const [chat] = this.#followed.values();
        const [open] = this.#open.values();
        const chatId = chat?.chatId ?? open?.game.chatId;
        if (chatId === undefined) return;
        if ((await this.#connected(chatId)) === undefined) {
            this.#reconnectLater();
            return;
        }
        for (const chat of this.#followed.values()) {
            void this.#follow(chat, [...chat.games.values()]);
        }
        for (const [key, open] of this.#open) {
            void this.#reopen(key, open);
        }
    }

    async #reopen(key: string, open: OpenGame): Promise<void> {
        const reply = await this.#openRequest(open.game);
        if (reply?.type === "opened") {
            this.#opened(key, open);
        }
        // closed meanwhile
        if (this.#open.get(key) !== open) return;
        if (reply === undefined) {
            // eg. the socket dropped again, or there was no chat token, so it's opened again later
            this.#reconnectLater();
        } else if (reply.type === "opened") {
            open.listeners.forEach((listener) => listener.onRole(reply.role, reply.player_token));
        } else if (reply.type === "refused" && reply.reason === "unknown_game" && open.hadState) {
            // The game ended while the socket was down, and the service has forgotten it. The frame
            // keeps the final state it has, and nothing more comes for it.
            this.#open.delete(key);
            this.#closeIfIdle();
        } else {
            this.#open.delete(key);
            const message = miniAppFailureMessage(reply.type === "refused" ? reply : undefined);
            open.listeners.forEach((listener) => listener.onClosed(message));
            this.#closeIfIdle();
        }
    }

    // The service has opened a game. If its frame closed meanwhile, it's closed now.
    #opened(key: string, open: OpenGame): void {
        if (this.#open.get(key) === open) {
            open.opened = true;
        } else if (!this.#open.has(key)) {
            this.#send({ type: "close", game: wireGame(open.game) });
        }
    }

    #wanted(): boolean {
        return this.#followed.size > 0 || this.#open.size > 0;
    }

    #onMessage(message: Reply | Push): void {
        if ("id" in message) {
            const resolve = this.#pending.get(message.id);
            this.#pending.delete(message.id);
            resolve?.(message);
            return;
        }
        switch (message.type) {
            case "card":
                this.#onCard(message);
                return;
            case "state": {
                const open = this.#open.get(miniAppGameKey(domainGame(message.game)));
                if (open === undefined) return;
                open.hadState = true;
                const state = {
                    seq: message.seq,
                    shared: message.shared,
                    private: message.private,
                };
                open.listeners.forEach((listener) => listener.onState(state));
                return;
            }
            case "role":
                this.#listeners(message.game).forEach((listener) =>
                    listener.onRole(message.role, message.player_token),
                );
                return;
            case "closed": {
                const key = miniAppGameKey(domainGame(message.game));
                const open = this.#open.get(key);
                this.#open.delete(key);
                open?.listeners.forEach((listener) =>
                    listener.onClosed(i18nKey("bots.miniApp.closed")),
                );
                this.#closeIfIdle();
                return;
            }
            case "error":
                console.warn("The MiniApp service couldn't read a message", message);
                return;
        }
    }

    #onCard(card: Extract<Push, { type: "card" }>): void {
        const game = domainGame(card.game);
        const chat = this.#followed.get(chatIdentifierToString(game.chatId));
        const key = miniAppGameKey(game);
        // unfollowed meanwhile
        if (chat === undefined || !chat.games.has(key)) return;
        const live: MiniAppLiveCard = {
            status: liveStatus(card.status),
            players: card.players,
            waitingFor: card.waiting_for,
            watching: card.watching,
            result: card.result ?? undefined,
            member: chat.member,
        };
        this.#deps.cards.update((cards) => new Map(cards).set(key, live));
    }

    #listeners(game: WireGame): MiniAppGameListener[] {
        return [...(this.#open.get(miniAppGameKey(domainGame(game)))?.listeners ?? [])];
    }

    #chatToken(chatId: MultiUserChatIdentifier): Promise<ChatToken | undefined> {
        const chatKey = chatIdentifierToString(chatId);
        const cached = this.#chatTokens.get(chatKey);
        if (cached !== undefined && cached.usableUntil > Date.now()) {
            return cached.token;
        }
        // shared by every request for it while it's being got
        const entry: CachedChatToken = {
            token: Promise.resolve(undefined),
            usableUntil: Number.POSITIVE_INFINITY,
        };
        entry.token = this.#getChatToken(chatId, entry);
        this.#chatTokens.set(chatKey, entry);
        return entry.token;
    }

    // Kept until shortly before it expires. One that couldn't be got isn't kept, so it's asked for
    // again next time.
    async #getChatToken(
        chatId: MultiUserChatIdentifier,
        entry: CachedChatToken,
    ): Promise<ChatToken | undefined> {
        const token = await this.#deps.chatToken(chatId).catch((err) => {
            console.warn("Couldn't get a chat token for the MiniApp service", err);
            return undefined;
        });
        entry.usableUntil =
            token === undefined ? 0 : (jwtExpiryMs(token) ?? 0) - CHAT_TOKEN_MARGIN_MS;
        return token === undefined
            ? undefined
            : { token, member: jwtClaims(token)?.member === true };
    }

    #dropChatToken(chatId: MultiUserChatIdentifier): void {
        this.#chatTokens.delete(chatIdentifierToString(chatId));
    }
}

function failed(reply: Reply | undefined): { kind: "failed"; message: ResourceKey } {
    return {
        kind: "failed",
        message: miniAppFailureMessage(reply?.type === "refused" ? reply : undefined),
    };
}

function parse(data: unknown): Reply | Push | undefined {
    if (typeof data !== "string") return undefined;
    try {
        return JSON.parse(data);
    } catch {
        return undefined;
    }
}

function liveStatus(status: "Open" | "Active" | "Finished"): MiniAppLiveCard["status"] {
    switch (status) {
        case "Open":
            return "open";
        case "Active":
            return "active";
        case "Finished":
            return "finished";
    }
}

function wireGame({ chatId, threadRootMessageIndex, messageId }: MiniAppGame): WireGame {
    return {
        chat:
            chatId.kind === "group_chat"
                ? { Group: chatId.groupId }
                : { Channel: [chatId.communityId, chatId.channelId] },
        thread: threadRootMessageIndex ?? null,
        message_id: messageId.toString(),
    };
}

function domainGame({ chat, thread, message_id }: WireGame): MiniAppGame {
    return {
        chatId:
            "Group" in chat
                ? { kind: "group_chat", groupId: chat.Group }
                : { kind: "channel", communityId: chat.Channel[0], channelId: chat.Channel[1] },
        threadRootMessageIndex: thread ?? undefined,
        messageId: BigInt(message_id),
    };
}
