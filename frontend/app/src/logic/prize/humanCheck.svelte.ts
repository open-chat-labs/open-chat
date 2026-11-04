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

// How long a claim waits for a check which says nothing (its frame didn't load, say), before
// going ahead without it and running the check again. Not while the reader is asked to tick
// Cloudflare's box: Turnstile times that out itself.
export const HUMAN_CHECK_WAIT_MS = 30_000;

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
    #deadline: ReturnType<typeof setTimeout> | undefined;

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
                this.#clearDeadline();
                const waiting = this.#waiting.shift();
                if (waiting !== undefined) {
                    this.#restart();
                    waiting(message.token);
                    this.#startDeadline();
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
                this.#clearDeadline();
                this.#state = { kind: "interactive" };
                break;
            case "turnstile_error":
                console.warn("Human check failed", message.code);
                this.#clearDeadline();
                this.#state = { kind: "failed" };
                this.#settleWaiting();
                break;
        }
    }

    /**
     * The token for a claim: at once if the check has passed, else once it does, running it again
     * if it had failed. Undefined if it fails, or says nothing for HUMAN_CHECK_WAIT_MS.
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
        return new Promise((resolve) => {
            this.#waiting.push(resolve);
            this.#startDeadline();
        });
    }

    #restart() {
        this.#state = { kind: "running" };
        this.#run += 1;
    }

    #settleWaiting() {
        const waiting = this.#waiting;
        this.#waiting = [];
        waiting.forEach((resolve) => resolve(undefined));
    }

    #startDeadline() {
        if (
            this.#deadline !== undefined ||
            this.#waiting.length === 0 ||
            this.#state.kind === "interactive"
        ) {
            return;
        }
        this.#deadline = setTimeout(() => {
            this.#deadline = undefined;
            console.warn("Human check timed out");
            this.#restart();
            this.#settleWaiting();
        }, HUMAN_CHECK_WAIT_MS);
    }

    #clearDeadline() {
        clearTimeout(this.#deadline);
        this.#deadline = undefined;
    }
}
