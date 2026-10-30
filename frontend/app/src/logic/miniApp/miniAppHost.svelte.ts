// OpenChat's side of a game's app, shared by the frames in both trees. Showing the app opens the game
// through the MiniApp service, and closing it closes the game. In between it relays: the user's role
// and player token, and the game's state, to the app, and the app's requests for a fresh token and to
// start the game to the service (backend/docs/mini_app_service_protocol.md, "App ↔ website"). Nothing
// else about the user is shared with the app.
//
// A finished game whose card records how it ended doesn't go through the service, which has forgotten
// it: the app's shown that end state instead, as a player if the user was one.

import type {
    MiniAppContent,
    MiniAppGame,
    MiniAppGameListener,
    MiniAppRole,
    MiniAppState,
    OpenChat,
    ResourceKey,
} from "@client";
import { i18nKey } from "@src/i18n/i18n";
import { miniAppMessage, type MiniAppHostMessage } from "@src/utils/miniApp";

// The bot's app shown in a game's card
export type HostedMiniApp = {
    url: URL;
    botName: string;
    game: MiniAppGame;
    // the card it's shown in, for the buttons around the frame. The frame passes the host the card as
    // it changes (`setContent`).
    content: MiniAppContent;
};

export type MiniAppFrameStatus =
    // until the service says how the user has it open
    | { kind: "opening" }
    | { kind: "open"; role: MiniAppRole }
    // eg. the user stopped playing a game that can't be watched
    | { kind: "closed"; message: ResourceKey };

type MiniAppGames = Pick<
    OpenChat,
    "openMiniApp" | "closeMiniApp" | "miniAppPlayerToken" | "startMiniApp"
>;

export type MiniAppHostOptions = {
    userId: string;
    darkMode: boolean;
    // read whenever the app's initialised, so it's current if the app reloads itself
    locale: () => string;
    // for OpenChat's reason a game didn't start, which the app shows
    translate: (key: ResourceKey) => string;
};

// How a game ended, as its card records it, parsed from the JSON the bot chose. Undefined if the card
// doesn't say, or what it says isn't JSON, when there's nothing for the app to show.
export function miniAppEndState(content: MiniAppContent): { state: unknown } | undefined {
    if (content.status.kind !== "finished" || content.status.endState === undefined) {
        return undefined;
    }
    try {
        return { state: JSON.parse(content.status.endState) };
    } catch {
        return undefined;
    }
}

// The game's settings, as its card records them from its start, parsed from the JSON the bot chose.
// Undefined while the card has none, or if what it holds isn't JSON.
export function miniAppSettings(content: MiniAppContent): unknown {
    const settings = content.status.kind === "open" ? undefined : content.status.settings;
    if (settings === undefined) return undefined;
    try {
        return JSON.parse(settings);
    } catch {
        return undefined;
    }
}

export class MiniAppHost {
    status = $state<MiniAppFrameStatus>({ kind: "opening" });
    #games: MiniAppGames;
    #app: HostedMiniApp;
    #content: MiniAppContent;
    // how the game ended, once its card records that
    #endState: { state: unknown } | undefined;
    #options: MiniAppHostOptions;
    #frame: HTMLIFrameElement | undefined;
    // what the service tells this frame about the game, while it's open through the service
    #listener: MiniAppGameListener | undefined;
    #playerToken: string | undefined;
    // whether the app has said it's ready
    #ready = false;
    // the latest state, which is held until the app's ready
    #state: MiniAppState | undefined;

    constructor(games: MiniAppGames, app: HostedMiniApp, options: MiniAppHostOptions) {
        this.#games = games;
        this.#app = app;
        this.#content = app.content;
        this.#endState = miniAppEndState(app.content);
        this.#options = { ...options };
    }

    // Opens the game, listening for the app's messages from `frame`, and returns a function which
    // closes it. A host opens the game again with each frame it's given, afresh: the app in a new
    // frame hasn't said it's ready, and the service sends the latest state once the game's open.
    open(frame: HTMLIFrameElement): () => void {
        this.reset();
        this.#frame = frame;
        const listener = (ev: MessageEvent) => void this.#onMessage(ev);
        window.addEventListener("message", listener);
        if (this.#endState !== undefined) {
            this.#openFinished();
        } else {
            void this.#open();
        }
        return () => {
            window.removeEventListener("message", listener);
            this.#frame = undefined;
            this.#closeListener();
        };
    }

    // Forgets how the last opening went, so the next frame opens the game afresh
    reset(): void {
        this.#ready = false;
        this.#playerToken = undefined;
        this.status = { kind: "opening" };
    }

    // The card as it now is. Once it records how the game ended, the app's shown that: one open
    // through the service is told, and the service is done with.
    setContent(content: MiniAppContent): void {
        this.#content = content;
        if (this.#endState !== undefined) return;
        this.#endState = miniAppEndState(content);
        if (this.#endState === undefined) return;
        this.#closeListener();
        if (this.status.kind === "open") {
            // the app, if it's ready, has had the game as it was played, and now its end
            this.#playerToken = undefined;
            if (this.#ready) {
                this.#send({ kind: "mini_app_end_state", state: this.#endState.state });
            }
        } else {
            // opening through the service, or closed by it: the end's shown instead
            this.#openFinished();
        }
    }

    setDarkMode(darkMode: boolean): void {
        if (darkMode === this.#options.darkMode) return;
        this.#options.darkMode = darkMode;
        if (this.#ready && this.status.kind === "open") {
            this.#send({ kind: "set_dark_mode", dark_mode: darkMode });
        }
    }

    async #open(): Promise<void> {
        const listener: MiniAppGameListener = {
            onState: (state) => this.#onState(state),
            onRole: (role, token) => this.#onRole(role, token),
            onClosed: (message) => (this.status = { kind: "closed", message }),
        };
        this.#listener = listener;
        const outcome = await this.#games.openMiniApp(this.#app.game, listener);
        // a frame given since then has an opening of its own, or the game's finished meanwhile
        if (this.#listener !== listener) return;
        if (outcome.kind === "failed") {
            // The service forgets a game once its card records the end, so a finished card's app
            // can't be opened, which isn't an error
            const finished =
                this.#content.status.kind === "finished" &&
                outcome.message.key === "bots.miniApp.refusals.unknownGame";
            this.status = {
                kind: "closed",
                message: finished ? i18nKey("bots.miniApp.refusals.finished") : outcome.message,
            };
            return;
        }
        this.#playerToken = outcome.playerToken;
        this.status = { kind: "open", role: outcome.role };
        this.#initialise(true);
    }

    // Shows the app how the game ended, as one of its players if the user was, without the service
    #openFinished(): void {
        const players =
            this.#content.status.kind === "finished" ? this.#content.status.players : [];
        this.#playerToken = undefined;
        this.status = {
            kind: "open",
            role: players.includes(this.#options.userId) ? "player" : "spectator",
        };
        this.#initialise(true);
    }

    #closeListener(): void {
        if (this.#listener !== undefined) {
            this.#games.closeMiniApp(this.#app.game, this.#listener);
            this.#listener = undefined;
        }
    }

    // Tells the app the user's role, and the game's settings if its card records them yet, once it's
    // ready, and then how the game ended, or else the latest state, unless the service is about to
    // send it
    #initialise(withState: boolean): void {
        if (!this.#ready || this.status.kind !== "open") return;
        this.#send({
            kind: "initialise_mini_app",
            role: this.status.role,
            user_id: this.#options.userId,
            token: this.#playerToken,
            dark_mode: this.#options.darkMode,
            locale: this.#options.locale(),
            finished: this.#endState !== undefined,
            settings: miniAppSettings(this.#content),
        });
        if (this.#endState !== undefined) {
            this.#send({ kind: "mini_app_end_state", state: this.#endState.state });
        } else if (withState && this.#state !== undefined) {
            this.#send(stateMessage(this.#state));
        }
    }

    #onRole(role: MiniAppRole, playerToken: string | undefined): void {
        if (this.status.kind !== "open") return;
        const changed = role !== this.status.role;
        this.#playerToken = playerToken;
        this.status = { kind: "open", role };
        // The service sends the latest state next, with the user's own part if they're now playing
        if (changed) {
            this.#initialise(false);
        }
    }

    #onState(state: MiniAppState): void {
        // A state can come twice, or out of order. One with the same seq is the same state, re-sent
        // when the user's role changed, so it takes the place of the one held.
        if (this.#state !== undefined && state.seq < this.#state.seq) return;
        this.#state = state;
        if (this.#ready && this.status.kind === "open") {
            this.#send(stateMessage(state));
        }
    }

    async #onMessage(ev: MessageEvent): Promise<void> {
        const message = miniAppMessage(ev, this.#frame?.contentWindow, this.#app.url.origin);
        switch (message?.kind) {
            // Sent again if the app reloads itself
            case "mini_app_ready":
                this.#ready = true;
                this.#initialise(true);
                return;

            // Left unanswered if there's no token, eg. the user's no longer playing, or the game's
            // over: the bot refuses the old one, and the app says so
            case "mini_app_token_request": {
                if (
                    this.status.kind !== "open" ||
                    this.status.role !== "player" ||
                    this.#endState !== undefined
                ) {
                    return;
                }
                const token = await this.#games.miniAppPlayerToken(this.#app.game);
                if (token !== undefined) {
                    this.#playerToken = token;
                    this.#send({ kind: "mini_app_token", token });
                }
                return;
            }

            // Nothing to start once the game's over
            case "mini_app_start": {
                if (this.#endState !== undefined) return;
                const outcome = await this.#games.startMiniApp(this.#app.game);
                this.#send({
                    kind: "mini_app_start_result",
                    accepted: outcome.kind === "started",
                    message:
                        outcome.kind === "refused_by_bot"
                            ? outcome.message
                            : outcome.kind === "failed"
                              ? this.#options.translate(outcome.message)
                              : undefined,
                });
                return;
            }
        }
    }

    #send(message: MiniAppHostMessage): void {
        this.#frame?.contentWindow?.postMessage(message, this.#app.url.origin);
    }
}

function stateMessage(state: MiniAppState): MiniAppHostMessage {
    return { kind: "mini_app_state", seq: state.seq, shared: state.shared, private: state.private };
}
