// The sign-up form, in every tree that has one of its own (the native tree's Pick a username, and
// the old UIs' SignUp): the username checked as it's typed, an optional recovery email, the
// referrer (the referral link's, or one picked), an optional photo (the native tree's), and the
// account made through the shared signUp (the client's operation, which uploads the photo once
// the account is made). src/web's AuthDialog keeps its form in the library and calls the same
// signUp (features/auth/signIn.ts).

import type { OpenChat, SignUpAvatar, SignUpOutcome, UserSummary } from "@client";
import EmailValidator from "email-validator";
import { UsernameCheck } from "../profile/usernameCheck.svelte";
import { Referral, signUp } from "./signUp";

// the name last tried, if sign-up didn't finish, is where the next one starts
const CANDIDATE_KEY = "openchat_candidate_username";

/** How the referrer got onto the form: the link this browser came in on, or the person's pick. */
export type ReferrerSource = "link" | "search" | "qr" | "pasted";

export type FormReferrer = { user: UserSummary; source: ReferrerSource };

export type SignUpFormClient = Pick<
    OpenChat,
    | "checkUsername"
    | "logError"
    | "signUp"
    | "getReferringUser"
    | "setReferralCode"
    | "clearReferralCode"
>;

/** Whether a recovery email can go with the sign-up: none, or one that looks like an address. */
export function recoveryEmailValid(email: string): boolean {
    const address = email.trim();
    return address.length === 0 || EmailValidator.validate(address);
}

export class SignUpForm {
    readonly username: UsernameCheck;
    /** The recovery email: optional, used only to recover the account. */
    email = $state("");
    referrer = $state<FormReferrer | undefined>(undefined);
    /** The account's photo (the picked image, cropped), if one was picked. */
    avatar = $state.raw<SignUpAvatar | undefined>(undefined);
    busy = $state(false);
    /** Why the last try failed, as an i18n key. */
    error = $state<string | undefined>(undefined);
    /** The last try's referral code was turned down: the next one goes ahead without it. */
    referralRefused = $state(false);

    #client: SignUpFormClient;
    #referral: Referral;

    constructor(client: SignUpFormClient) {
        this.#client = client;
        this.#referral = new Referral(client);
        this.username = new UsernameCheck(client, readCandidate, { ownName: false });
    }

    get emailValid(): boolean {
        return recoveryEmailValid(this.email);
    }

    /** Whether the form can be sent: a name that can be used, a valid email or none, and not busy. */
    get ready(): boolean {
        return this.username.valid && this.emailValid && !this.busy;
    }

    /**
     * Looks up whoever the referral link names (once), who's the referrer unless one was picked
     * meanwhile. Resolves the link's referrer, if any.
     */
    async loadLinkReferrer(): Promise<UserSummary | undefined> {
        const user = await this.#referral.link();
        if (user !== undefined && this.referrer === undefined) {
            this.referrer = { user, source: "link" };
        }
        return user;
    }

    pickReferrer(user: UserSummary, source: ReferrerSource): void {
        this.referrer = { user, source };
    }

    removeReferrer(): void {
        this.referrer = undefined;
    }

    /**
     * Makes the account, if the form is ready and the terms are agreed to: the referrer goes with
     * it (or a code nobody wants any more is cleared), then the shared signUp, with the photo. Resolves its
     * outcome, or undefined when the form wasn't sent.
     */
    async submit(termsAccepted: boolean, signal?: AbortSignal): Promise<SignUpOutcome | undefined> {
        if (!this.ready || !termsAccepted) return undefined;
        const username = this.username.value;
        writeCandidate(username);
        this.busy = true;
        this.error = undefined;
        this.#referral.apply(this.referrer?.user.userId);
        const email = this.email.trim();
        let outcome: SignUpOutcome;
        try {
            outcome = await signUp(
                this.#client,
                username,
                email.length > 0 ? email : undefined,
                termsAccepted,
                signal,
                this.avatar,
            );
        } finally {
            this.busy = false;
        }
        this.referralRefused = outcome.kind === "referral_refused";
        switch (outcome.kind) {
            case "success":
                writeCandidate("");
                break;
            case "referral_refused":
                // the client never sends a refused code again, so the referrer goes with it
                this.referrer = undefined;
                this.error = outcome.reason.key;
                break;
            case "failed":
                this.error = outcome.reason.key;
                break;
        }
        return outcome;
    }

    destroy(): void {
        this.username.destroy();
    }
}

function readCandidate(): string {
    try {
        return localStorage.getItem(CANDIDATE_KEY) ?? "";
    } catch {
        return "";
    }
}

function writeCandidate(username: string): void {
    try {
        localStorage.setItem(CANDIDATE_KEY, username);
    } catch {
        // without storage the next try starts empty
    }
}
