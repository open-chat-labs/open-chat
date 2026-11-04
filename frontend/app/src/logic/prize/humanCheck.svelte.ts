/** What the human check's frame (public/turnstile.js) tells the page that framed it. */
export type HumanCheckMessage =
    | { kind: "turnstile_token"; token: string }
    | { kind: "turnstile_expired" }
    | { kind: "turnstile_interactive" }
    | { kind: "turnstile_error"; code: string };

export function isHumanCheckMessage(data: unknown): data is HumanCheckMessage {
    if (typeof data !== "object" || data === null || !("kind" in data)) return false;
    switch (data.kind) {
        case "turnstile_token":
            return "token" in data && typeof data.token === "string";
        case "turnstile_error":
            return "code" in data && typeof data.code === "string";
        case "turnstile_expired":
        case "turnstile_interactive":
            return true;
        default:
            return false;
    }
}

type HumanCheckState =
    | { kind: "running" }
    | { kind: "interactive" }
    | { kind: "passed"; token: string }
    | { kind: "failed" };

/**
 * A prize's check that the reader is human (Cloudflare Turnstile), run as the prize shows so a
 * claim needn't wait for it. Its token serves one claim of this prize by this reader, so each claim
 * takes it and the check runs again, ready for a retry. The frame (HumanCheckFrame) is keyed on
 * `run`, and passes on what the check says.
 */
export class HumanCheck {
    #state = $state<HumanCheckState>({ kind: "running" });
    #run = $state(0);
    #waiting: ((token: string | undefined) => void)[] = [];

    /** Changes each time the check starts again. */
    get run(): number {
        return this.#run;
    }

    /** Cloudflare wants the reader to tick its box. */
    get interactive(): boolean {
        return this.#state.kind === "interactive";
    }

    receive(message: HumanCheckMessage): void {
        switch (message.kind) {
            case "turnstile_token": {
                const waiting = this.#waiting.shift();
                if (waiting !== undefined) {
                    this.#restart();
                    waiting(message.token);
                } else {
                    this.#state = { kind: "passed", token: message.token };
                }
                break;
            }
            // The widget renews an expired token itself
            case "turnstile_expired":
                this.#state = { kind: "running" };
                break;
            case "turnstile_interactive":
                this.#state = { kind: "interactive" };
                break;
            case "turnstile_error":
                console.warn("Human check failed", message.code);
                this.#state = { kind: "failed" };
                this.#settleWaiting(undefined);
                break;
        }
    }

    /**
     * The token for a claim: at once if the check has passed, else once it does, running it again
     * if it had failed. Undefined if it fails.
     */
    take(): Promise<string | undefined> {
        const state = this.#state;
        if (state.kind === "passed") {
            this.#restart();
            return Promise.resolve(state.token);
        }
        if (state.kind === "failed") {
            this.#restart();
        }
        return new Promise((resolve) => this.#waiting.push(resolve));
    }

    #restart() {
        this.#state = { kind: "running" };
        this.#run += 1;
    }

    #settleWaiting(token: string | undefined) {
        const waiting = this.#waiting;
        this.#waiting = [];
        waiting.forEach((resolve) => resolve(token));
    }
}
