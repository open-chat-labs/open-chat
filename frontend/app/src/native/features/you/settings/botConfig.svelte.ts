import type { BotClientConfigData, OpenChat } from "@client";

// The connection details You → Bots shows (the IC host, the OpenStorage index, OpenChat's public
// key): fetched once a session, as the You tab opens, so the page has them when it's opened
// rather than waiting on them there. A failed fetch is tried again the next time.

export type BotConfigState =
    | { kind: "loading" }
    | { kind: "loaded"; config: BotClientConfigData }
    | { kind: "failed" };

class BotConfig {
    #state = $state<BotConfigState>({ kind: "loading" });
    #fetching = false;

    get state(): BotConfigState {
        return this.#state;
    }

    /** Fetches them, unless they're in or on their way. */
    async load(client: OpenChat): Promise<void> {
        if (this.#state.kind === "loaded" || this.#fetching) return;
        this.#fetching = true;
        this.#state = { kind: "loading" };
        try {
            this.#state = { kind: "loaded", config: await client.getBotConfig() };
        } catch (err) {
            console.warn("Unable to load the bot configuration", err);
            this.#state = { kind: "failed" };
        } finally {
            this.#fetching = false;
        }
    }
}

export const botConfig = new BotConfig();
