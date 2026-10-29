// Joining and leaving a game, from its card or around its app, shared by both trees. Only OpenChat's
// own buttons do either: nothing lets an app join or leave for its user.

import type { MiniAppGame, MiniAppOutcome, OpenChat, ResourceKey } from "@client";

export class MiniAppActions {
    // what's being asked for, if anything
    busy = $state<"join" | "leave" | undefined>(undefined);
    // why the last request failed, eg. the bot's reason for refusing a join
    error = $state<ResourceKey | undefined>(undefined);
    #client: Pick<OpenChat, "joinMiniApp" | "leaveMiniApp">;
    #game: MiniAppGame;

    constructor(client: Pick<OpenChat, "joinMiniApp" | "leaveMiniApp">, game: MiniAppGame) {
        this.#client = client;
        this.#game = game;
    }

    join(): Promise<void> {
        return this.#request("join", () => this.#client.joinMiniApp(this.#game));
    }

    leave(): Promise<void> {
        return this.#request("leave", () => this.#client.leaveMiniApp(this.#game));
    }

    async #request(
        action: "join" | "leave",
        request: () => Promise<MiniAppOutcome>,
    ): Promise<void> {
        if (this.busy !== undefined) return;
        this.busy = action;
        this.error = undefined;
        const outcome = await request();
        this.busy = undefined;
        this.error = outcome.kind === "failed" ? outcome.message : undefined;
    }
}
