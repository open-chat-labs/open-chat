import {
    identityStateStore,
    type OpenChat,
    type SignUpAvatar,
    type SignUpOutcome,
    type UserSummary,
} from "@client";
import { afterAbandoned, referralCode, type ReferralLookup } from "./authFlow";

// Sign-up and the sign-ins around it, for every tree that signs people in: src/web's AuthDialog
// hosts (features/auth/signIn.ts) and the native tree's signed-out start. The account is the
// client's operation (client.signUp); what's here is what goes with it in a host: the referrer
// (the referral link's, or one picked), and a sign-in someone walked away from.

// A sign-in someone walked away from (closed its dialog, left its page or screen). It's kept here
// rather than in a host, so whichever host is mounted when it comes to something, it's handled the
// same: an identity without an account it leaves behind is signed out, and until then the in-app
// dialog doesn't open for it (signInAbandoned). A new sign-in, or a user, ends it (afterAbandoned).
let stopAbandoned: (() => void) | undefined = undefined;
// an account being made: walking away lets it finish (it can't be taken back), and signs out only
// an identity it left without one
let registration: Promise<unknown> | undefined = undefined;

/** Whether a sign-in someone walked away from is still being seen through. */
export function signInAbandoned(): boolean {
    return stopAbandoned !== undefined;
}

/**
 * Someone walked away from a sign-in or sign-up: an identity without an account it leaves behind
 * is signed out, now or once it gets there (an account being made is let finish first), until the
 * next sign-in starts (resumeSignIn) or there's a user.
 */
export function abandonSignIn(client: Pick<OpenChat, "logout">): void {
    stopAbandoned?.();
    let done = false;
    let unsubscribe: (() => void) | undefined = undefined;
    const stop = () => {
        done = true;
        unsubscribe?.();
        if (stopAbandoned === stop) stopAbandoned = undefined;
    };
    stopAbandoned = stop;
    unsubscribe = identityStateStore.subscribe((state) => {
        if (done) return;
        const next = afterAbandoned(state);
        if (next === "wait") return;
        if (next === "end") return stop();
        // still abandoned until signed out, so the in-app dialog doesn't open meanwhile
        done = true;
        unsubscribe?.();
        signOutIfLeftWithoutAccount(client, registration, stop);
    });
    // the store calls back during subscribe, before `unsubscribe` was set
    if (done) unsubscribe();
}

/** A sign-in or sign-up is starting: one walked away from before is over. */
export function resumeSignIn(): void {
    stopAbandoned?.();
}

async function signOutIfLeftWithoutAccount(
    client: Pick<OpenChat, "logout">,
    making: Promise<unknown> | undefined,
    stop: () => void,
): Promise<void> {
    try {
        await making;
    } catch {
        // a failed sign-up leaves the identity without an account, which the check below sees
    }
    // the account it was making may have made it
    if (afterAbandoned(identityStateStore.value) !== "sign_out") return stop();
    try {
        await client.logout();
    } finally {
        stop();
    }
}

/**
 * Makes the account (client.signUp: the passkey unless the identity has no account already, then
 * the account, and its photo uploaded when there's one). Once the account is asked for it's made
 * even if the host goes: a walk-away (abandonSignIn) waits for it.
 */
export async function signUp(
    client: Pick<OpenChat, "signUp">,
    username: string,
    email: string | undefined,
    termsAccepted: boolean,
    signal?: AbortSignal,
    avatar?: SignUpAvatar,
): Promise<SignUpOutcome> {
    resumeSignIn();
    const signingUp = client.signUp(username, email, termsAccepted, signal, avatar);
    registration = signingUp;
    return signingUp.finally(() => {
        if (registration === signingUp) registration = undefined;
    });
}

/** Whether someone can be named as a referrer: a bot or a suspended user would have the sign-up refused. */
export function canRefer(user: UserSummary): boolean {
    return user.kind === "user" && !user.suspended;
}

/** The people a search for a referrer finds, without those who can't be one (canRefer). */
export async function searchReferrers(
    client: Pick<OpenChat, "searchUsers">,
    query: string,
): Promise<UserSummary[]> {
    return (await client.searchUsers(query, 20)).filter(canRefer);
}

/**
 * Who an invite link's `ref` names (the referrer's user id, as in the link this browser came in
 * on), if they can be a referrer. A code that isn't a user id, or can't be looked up, names no one.
 */
export async function resolveReferrer(
    client: Pick<OpenChat, "getUser">,
    code: string,
): Promise<UserSummary | undefined> {
    try {
        const user = await client.getUser(code);
        return user !== undefined && canRefer(user) ? user : undefined;
    } catch {
        return undefined;
    }
}

/**
 * One sign-up host's referral: whoever the referral link this browser came in on names (looked up
 * once), and what a sign-up does with the stored code (authFlow's referralCode).
 */
export class Referral {
    #client: Pick<OpenChat, "getReferringUser" | "setReferralCode" | "clearReferralCode">;
    #referrer: Promise<UserSummary | undefined> | undefined = undefined;
    // what the referral link's lookup came to, and whether a sign-up here stored a code
    #lookup: ReferralLookup = "pending";
    #codeFromForm = false;

    constructor(
        client: Pick<OpenChat, "getReferringUser" | "setReferralCode" | "clearReferralCode">,
    ) {
        this.#client = client;
    }

    /** Whoever the referral link names, if anyone; none when the lookup fails. */
    link(): Promise<UserSummary | undefined> {
        this.#referrer ??= this.#lookUp();
        return this.#referrer;
    }

    /**
     * Before a sign-up: sets the referrer the form names; without one, clears a code that a
     * referrer the person removed came from, or that names no one, and keeps the link's code when
     * its lookup failed or hasn't finished.
     */
    apply(referrerId: string | undefined): void {
        const code = referralCode(referrerId, this.#lookup, this.#codeFromForm);
        if (code === "set" && referrerId !== undefined) {
            this.#client.setReferralCode(referrerId);
            this.#codeFromForm = true;
        } else if (code === "clear") {
            this.#client.clearReferralCode();
        }
    }

    async #lookUp(): Promise<UserSummary | undefined> {
        let user: UserSummary | undefined;
        try {
            user = await this.#client.getReferringUser();
        } catch {
            this.#lookup = "failed";
            return undefined;
        }
        this.#lookup = user === undefined ? "none" : "found";
        return user;
    }
}
