import type { TurnstilePass } from "@client";

/** What the human check's frame (public/turnstile.js) tells the page that framed it. */
export type HumanCheckMessage =
    | { kind: "turnstile_token"; token: string; salt: string }
    | { kind: "turnstile_interactive" }
    | { kind: "turnstile_error"; code: string };

export function isHumanCheckMessage(data: unknown): data is HumanCheckMessage {
    if (typeof data !== "object" || data === null || !("kind" in data)) return false;
    switch (data.kind) {
        case "turnstile_token":
            return (
                "token" in data &&
                typeof data.token === "string" &&
                "salt" in data &&
                typeof data.salt === "string"
            );
        case "turnstile_error":
            return "code" in data && typeof data.code === "string";
        case "turnstile_interactive":
            return true;
        default:
            return false;
    }
}

// How long a claim waits for a check which says nothing (its frame didn't load, say), before
// going ahead without it. Not while the reader is asked to tick Cloudflare's box: Turnstile times
// that out itself.
export const HUMAN_CHECK_WAIT_MS = 30_000;

type HumanCheckState = { kind: "idle" } | { kind: "running" } | { kind: "interactive" };

/**
 * A prize's check that the reader is human (Cloudflare Turnstile). It runs only once the reader
 * clicks Claim, so Cloudflare hears nothing from anyone who doesn't. Its token serves one claim of
 * this prize by this reader, so each claim runs it afresh. The frame (HumanCheckFrame) is there
 * while it runs, keyed on `run`, and passes on what the check says.
 */
export class HumanCheck {
    #state = $state<HumanCheckState>({ kind: "idle" });
    #run = $state(0);
    #waiting: ((pass: TurnstilePass | undefined) => void) | undefined;
    #deadline: ReturnType<typeof setTimeout> | undefined;

    /** Changes each time the check starts. */
    get run(): number {
        return this.#run;
    }

    /** A claim is waiting for the check. */
    get running(): boolean {
        return this.#state.kind !== "idle";
    }

    /** Cloudflare wants the reader to tick its box. */
    get interactive(): boolean {
        return this.#state.kind === "interactive";
    }

    receive(message: HumanCheckMessage): void {
        switch (message.kind) {
            case "turnstile_token":
                this.#finish({ token: message.token, salt: message.salt });
                break;
            case "turnstile_interactive":
                this.#clearDeadline();
                this.#state = { kind: "interactive" };
                break;
            case "turnstile_error":
                console.warn("Human check failed", message.code);
                this.#finish(undefined);
                break;
        }
    }

    /**
     * Runs the check for a claim, and gives its token (and salt) once it passes. Undefined if it
     * fails, is stopped, or says nothing for HUMAN_CHECK_WAIT_MS. One claim at a time
     * (claimPrizeWithHumanCheck sees to that): a run still going is stopped.
     */
    take(): Promise<TurnstilePass | undefined> {
        this.stop();
        this.#state = { kind: "running" };
        this.#run += 1;
        return new Promise((resolve) => {
            this.#waiting = resolve;
            this.#deadline = setTimeout(() => {
                console.warn("Human check timed out");
                this.#finish(undefined);
            }, HUMAN_CHECK_WAIT_MS);
        });
    }

    /** Ends the check if it's running, failing its claim: its frame has gone, say. */
    stop(): void {
        this.#finish(undefined);
    }

    #finish(pass: TurnstilePass | undefined) {
        this.#clearDeadline();
        this.#state = { kind: "idle" };
        const waiting = this.#waiting;
        this.#waiting = undefined;
        waiting?.(pass);
    }

    #clearDeadline() {
        clearTimeout(this.#deadline);
        this.#deadline = undefined;
    }
}
