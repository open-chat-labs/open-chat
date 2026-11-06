// Picking who referred you while signing up (native design notes §3.1, Referrer): search by name
// or @username, or an invite link (pasted, or read from their QR code), whose `ref` names them;
// then a confirm step before they're the form's referrer. Only the latest search or lookup counts.

import type { OpenChat, UserSummary } from "@client";
import { referralCode } from "@openchat/ui/src/lib/referral";
import { resolveReferrer, searchReferrers } from "./signUp";
import type { ReferrerSource } from "./signUpForm.svelte";

const SEARCH_DELAY_MS = 300;

export type ReferrerPickerStep =
    | { kind: "search" }
    | { kind: "scan" }
    | { kind: "confirm"; user: UserSummary; source: ReferrerSource };

/** What a search came to. */
export type ReferrerResults =
    | { kind: "idle" }
    | { kind: "searching" }
    | { kind: "found"; users: UserSummary[] }
    | { kind: "failed" };

/** Why an invite link named no one: it has no `ref`, or no one who can refer goes by it. */
export type ReferralLinkProblem = "no_referrer" | "unknown";

export class ReferrerPicker {
    step = $state<ReferrerPickerStep>({ kind: "search" });
    query = $state("");
    results = $state<ReferrerResults>({ kind: "idle" });
    /** Why the last link looked up named no one. */
    linkProblem = $state<ReferralLinkProblem | undefined>(undefined);
    /** A link is being looked up. */
    resolving = $state(false);

    #client: Pick<OpenChat, "searchUsers" | "getUser">;
    #timer: ReturnType<typeof setTimeout> | undefined;
    // only the latest search or lookup counts
    #run = 0;

    constructor(client: Pick<OpenChat, "searchUsers" | "getUser">) {
        this.#client = client;
    }

    /**
     * The search field's text: an invite link in it is looked up (at once), anything else is
     * searched for once typing pauses.
     */
    input(text: string): void {
        this.query = text;
        this.linkProblem = undefined;
        const run = this.#next();
        if (referralCode(text) !== undefined) {
            void this.#lookUp(text, "pasted", run);
            return;
        }
        if (text.trim().length === 0) {
            this.results = { kind: "idle" };
            return;
        }
        this.results = { kind: "searching" };
        this.#timer = setTimeout(() => void this.#search(text.trim(), run), SEARCH_DELAY_MS);
    }

    /** An invite link from the clipboard or their QR code: who it names goes to the confirm step. */
    fromLink(text: string, source: "pasted" | "qr"): Promise<void> {
        this.linkProblem = undefined;
        return this.#lookUp(text, source, this.#next());
    }

    /** Scanning their QR code. */
    scan(): void {
        this.#next();
        this.linkProblem = undefined;
        this.step = { kind: "scan" };
    }

    /** Someone picked (a search result), to confirm. */
    pick(user: UserSummary, source: ReferrerSource = "search"): void {
        this.#next();
        this.step = { kind: "confirm", user, source };
    }

    /** Back to the search from the confirm step or the scanner ("Pick someone else"). */
    back(): void {
        this.#next();
        this.step = { kind: "search" };
    }

    destroy(): void {
        this.#next();
    }

    #next(): number {
        clearTimeout(this.#timer);
        this.resolving = false;
        return ++this.#run;
    }

    async #search(query: string, run: number): Promise<void> {
        let users: UserSummary[];
        try {
            users = await searchReferrers(this.#client, query);
        } catch {
            if (run === this.#run) this.results = { kind: "failed" };
            return;
        }
        if (run === this.#run) this.results = { kind: "found", users };
    }

    async #lookUp(text: string, source: "pasted" | "qr", run: number): Promise<void> {
        const code = referralCode(text);
        if (code === undefined) {
            this.linkProblem = "no_referrer";
            if (source === "qr") this.step = { kind: "search" };
            return;
        }
        this.resolving = true;
        const user = await resolveReferrer(this.#client, code);
        if (run !== this.#run) return;
        this.resolving = false;
        if (user === undefined) {
            this.linkProblem = "unknown";
            this.step = { kind: "search" };
            return;
        }
        this.step = { kind: "confirm", user, source };
    }
}
