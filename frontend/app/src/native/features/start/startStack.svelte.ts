import type { IdentityState } from "@client";
import { withoutAccount } from "@src/logic/auth/authFlow";

// The signed-out start (native design notes §3.1): Welcome, and the screens pushed from it. They
// have no URLs (on the web they're a dialog), so the start keeps its own small stack rather than
// the tabs' URL-driven one, and the URL stays as it was for after sign-in. Its shape is fixed:
// Welcome → Pick a username, and Welcome → Welcome back → Link to your account.

export type StartStep = "welcome" | "welcome_back" | "sign_up" | "link";

/** How the stack changed, for the push motion (as TabStacks'). */
export type StartChange = "push" | "pop" | "replace" | "none";

/** The screens under a step, then the step: Back goes through them. */
export function startPath(step: StartStep): StartStep[] {
    switch (step) {
        case "welcome":
            return ["welcome"];
        case "welcome_back":
            return ["welcome", "welcome_back"];
        case "sign_up":
            return ["welcome", "sign_up"];
        case "link":
            return ["welcome", "welcome_back", "link"];
    }
}

/**
 * Where the start opens: Pick a username for an identity signed in without an account (a sign-up
 * left before it made the account), else Welcome.
 */
export function startStepFor(state: IdentityState): StartStep {
    return withoutAccount(state) ? "sign_up" : "welcome";
}

/** What the native tree shows, from who's signed in: the start, a spinner, or the app. */
export type StartEntry = "start" | "loading" | "app";

/**
 * The start for someone signed out, and through a sign-in or sign-up started there until there's
 * a user; a spinner while a session from before loads (a cold start signed in), so Welcome doesn't
 * flash first; and the app once there's a user. `onStart`: the start is showing.
 */
export function startEntry(state: IdentityState, anonUser: boolean, onStart: boolean): StartEntry {
    switch (state.kind) {
        case "logged_in":
            return anonUser ? (onStart ? "start" : "loading") : "app";
        case "anon":
        case "logging_in":
        case "registering":
            return "start";
        case "loading_user":
            return state.registering || onStart ? "start" : "loading";
    }
}

export class StartStack {
    steps = $state<StartStep[]>(["welcome"]);
    change = $state<StartChange>("none");

    get top(): StartStep {
        return this.steps[this.steps.length - 1];
    }

    /** There's a screen under the one showing. */
    get canGoBack(): boolean {
        return this.steps.length > 1;
    }

    /** Opens a step: pushed over the screens it shares, or popped back to. */
    go(step: StartStep): void {
        const next = startPath(step);
        this.change = changeOf(this.steps, next);
        this.steps = next;
    }

    back(): void {
        if (this.canGoBack) this.go(this.steps[this.steps.length - 2]);
    }

    /** Starts again at `step`, without motion (signed out, or back from the app). */
    reset(step: StartStep): void {
        this.change = "none";
        this.steps = startPath(step);
    }
}

function changeOf(before: StartStep[], after: StartStep[]): StartChange {
    let shared = 0;
    while (shared < before.length && shared < after.length && before[shared] === after[shared]) {
        shared++;
    }
    if (shared === before.length && shared === after.length) return "none";
    if (shared === before.length) return "push";
    if (shared === after.length) return "pop";
    return "replace";
}
