// OpenChat's side of a game's app, shared by the frames in both trees. Showing the app opens the game
// through the MiniApp service, and closing it closes the game. In between it relays: the user's role
// and player token, and the game's state, to the app, and the app's requests for a fresh token and to
// start the game to the service (backend/docs/mini_app_service_protocol.md, "App ↔ website"). Nothing
// else about the user is shared with the app.

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
    // the card it's shown in, for the buttons around the frame
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

export class MiniAppHost {
    status = $state<MiniAppFrameStatus>({ kind: "opening" });
    #games: MiniAppGames;
    #app: HostedMiniApp;
    #options: MiniAppHostOptions;
    #frame: HTMLIFrameElement | undefined;
    // what the service tells this frame about the game, once it's open
    #listener: MiniAppGameListener | undefined;
    #playerToken: string | undefined;
    // whether the app has said it's ready
    #ready = false;
    // the latest state, which is held until the app's ready
    #state: MiniAppState | undefined;

    constructor(games: MiniAppGames, app: HostedMiniApp, options: MiniAppHostOptions) {
        this.#games = games;
        this.#app = app;
        this.#options = { ...options };
    }

    // Opens the game, listening for the app's messages from `frame`, and returns a function which
    // closes it
    open(frame: HTMLIFrameElement): () => void {
        this.#frame = frame;
        const listener = (ev: MessageEvent) => void this.#onMessage(ev);
        window.addEventListener("message", listener);
        void this.#open();
        return () => {
            window.removeEventListener("message", listener);
            this.#frame = undefined;
            if (this.#listener !== undefined) {
                this.#games.closeMiniApp(this.#app.game, this.#listener);
            }
        };
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
        if (outcome.kind === "failed") {
            // The service forgets a game once its card records the end, so a finished card's app
            // can't be opened, which isn't an error
            const finished =
                this.#app.content.status.kind === "finished" &&
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

    // Tells the app the user's role, once it's ready, and then the latest state, unless the service
    // is about to send it
    #initialise(withState: boolean): void {
        if (!this.#ready || this.status.kind !== "open") return;
        this.#send({
            kind: "initialise_mini_app",
            role: this.status.role,
            user_id: this.#options.userId,
            token: this.#playerToken,
            dark_mode: this.#options.darkMode,
            locale: this.#options.locale(),
        });
        if (withState && this.#state !== undefined) {
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

            // Left unanswered if there's no token, eg. the user's no longer playing: the bot
            // refuses the old one, and the app says so
            case "mini_app_token_request": {
                if (this.status.kind !== "open" || this.status.role !== "player") return;
                const token = await this.#games.miniAppPlayerToken(this.#app.game);
                if (token !== undefined) {
                    this.#playerToken = token;
                    this.#send({ kind: "mini_app_token", token });
                }
                return;
            }

            case "mini_app_start": {
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
