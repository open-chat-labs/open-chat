// OpenChat's side of the app a bot opens from one of its MiniApp messages, shared by the frames in
// both trees. When the app says it's ready, it's sent a token which tells its server who the user
// is, and later a fresh one whenever it asks. Nothing else about the user is shared with it.

import type { ChatIdentifier, OpenChat } from "@client";
import { miniAppMessage, type MiniAppHostMessage } from "@src/utils/miniApp";

export type MiniAppHostArgs = {
    chatId: ChatIdentifier;
    threadRootMessageIndex: number | undefined;
    messageId: bigint;
    // the bot which posted the message
    botId: string;
    // the app's, which only it may talk to OpenChat from
    origin: string;
};

export type MiniAppStatus = "connecting" | "connected" | "failed";

export class MiniAppHost {
    // "failed" if no token could be got for the app when it opened, eg. the user has left the chat
    status = $state<MiniAppStatus>("connecting");
    #client: OpenChat;
    #args: MiniAppHostArgs;
    #frame: HTMLIFrameElement | undefined;
    #darkMode = false;

    constructor(client: OpenChat, args: MiniAppHostArgs) {
        this.#client = client;
        this.#args = args;
    }

    // Listens for the app's messages from `frame`, returning a function which stops
    attach(frame: HTMLIFrameElement, darkMode: boolean, locale: string): () => void {
        this.#frame = frame;
        this.#darkMode = darkMode;
        const listener = (ev: MessageEvent) => void this.#onMessage(ev, locale);
        window.addEventListener("message", listener);
        return () => {
            window.removeEventListener("message", listener);
            this.#frame = undefined;
        };
    }

    setDarkMode(darkMode: boolean): void {
        if (darkMode === this.#darkMode) return;
        this.#darkMode = darkMode;
        if (this.status === "connected") {
            this.#send({ kind: "set_dark_mode", dark_mode: darkMode });
        }
    }

    async #onMessage(ev: MessageEvent, locale: string): Promise<void> {
        const message = miniAppMessage(ev, this.#frame?.contentWindow, this.#args.origin);
        if (message === undefined) return;

        const { chatId, threadRootMessageIndex, messageId, botId } = this.#args;
        const token = await this.#client.miniAppToken(
            chatId,
            threadRootMessageIndex,
            messageId,
            botId,
        );

        switch (message.kind) {
            // Sent again if the app reloads itself
            case "mini_app_ready":
                if (token === undefined) {
                    this.status = "failed";
                    return;
                }
                this.#send({
                    kind: "initialise_mini_app",
                    token,
                    dark_mode: this.#darkMode,
                    locale,
                });
                this.status = "connected";
                return;

            // Left unanswered if there's no token, eg. the user has since left the chat: the app's
            // server refuses the old one, and the app says so
            case "mini_app_token_request":
                if (token !== undefined) {
                    this.#send({ kind: "mini_app_token", token });
                }
                return;
        }
    }

    #send(message: MiniAppHostMessage): void {
        this.#frame?.contentWindow?.postMessage(message, this.#args.origin);
    }
}
