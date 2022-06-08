import { get, Writable, writable } from "svelte/store";
import type {
    Challenge,
    ChallengeAttempt,
    CheckUsernameResponse,
    CreatedUser,
    CurrentUserResponse,
} from "../domain/user/user";
import type { ServiceContainer } from "../services/serviceContainer";

export type Spinning = { kind: "spinning" };
export type AwaitingUsername = { kind: "awaiting_username" };
export type AwaitingChallengeAttempt = { kind: "awaiting_challenge_attempt" };
export type AwaitingCompletion = { kind: "awaiting_completion" };

export type RegisterState =
    | Spinning
    | AwaitingUsername
    | AwaitingChallengeAttempt
    | AwaitingCompletion;

export class RegisterController {
    public state: Writable<RegisterState> = writable({ kind: "awaiting_username" });
    public error: Writable<string | undefined> = writable(undefined);
    public username: Writable<string | undefined> = writable(undefined);
    public challenge: Writable<Challenge | undefined> = writable(undefined);
    private _challengeAttempt: ChallengeAttempt | undefined = undefined;
    private _createdUser?: CreatedUser;

    constructor(
        private _api: ServiceContainer,
        private currentUser: CurrentUserResponse,
        private _onComplete: (user: CreatedUser) => void,
        private _referredBy: string | undefined
    ) {
        if (currentUser.kind === "unknown_user") {
            // Try to create a challenge.
            this.createChallenge();

            // In parallel goto the "username" panel.
            this.state.set({ kind: "awaiting_username" });
        }
    }

    api(): ServiceContainer {
        return this._api;
    }

    checkUsername(username: string): Promise<CheckUsernameResponse> {
        return this._api.checkUsername(username);
    }

    submitUsername(username: string): void {
        this.username.set(username);

        if (this._challengeAttempt !== undefined) {
            // The user already has an untried challenge attempt so call register_user
            this.registerUser(username, this._challengeAttempt, this._referredBy);
        } else if (get(this.challenge) === undefined) {
            // The challenge isn't ready yet so wait...
            this.state.set({ kind: "spinning" });
        } else {
            // The challenge is ready so goto the "challenge" panel.
            this.state.set({ kind: "awaiting_challenge_attempt" });
        }
    }

    submitChallengeAttempt(challengeAttempt: ChallengeAttempt): void {
        this._challengeAttempt = challengeAttempt;
        this.challenge.set(undefined);

        const username = get(this.username);

        if (username !== undefined) {
            // The username has been entered so try to register the user.
            this.registerUser(username, challengeAttempt, this._referredBy);
        } else {
            // The username has not been set so goto the "username" panel.
            this.state.set({ kind: "awaiting_username" });
        }
    }

    cancelChallengeAttempt(): void {
        this._challengeAttempt = undefined;
        this.state.set({ kind: "awaiting_username" });
    }

    complete(): void {
        if (this._createdUser !== undefined) {
            this._onComplete(this._createdUser);
        }
    }

    private registerUser(
        username: string,
        challengeAttempt: ChallengeAttempt,
        referredBy: string | undefined
    ): void {
        this.state.set({ kind: "spinning" });
        this._api.registerUser(username, challengeAttempt, referredBy).then((resp) => {
            this.state.set({ kind: "awaiting_username" });
            if (resp === "username_taken") {
                this.error.set("register.usernameTaken");
            } else if (resp === "username_too_short") {
                this.error.set("register.usernameTooShort");
            } else if (resp === "username_too_long") {
                this.error.set("register.usernameTooLong");
            } else if (resp === "username_invalid") {
                this.error.set("register.usernameInvalid");
            } else if (resp === "user_limit_reached") {
                this.error.set("register.userLimitReached");
            } else if (resp === "challenge_failed") {
                this.error.set("register.challengeAttemptFailed");
                this.createChallenge();
            } else if (resp === "success") {
                this.error.set(undefined);
                this.loadUser();
            }
        });
    }

    private createChallenge(): void {
        this.state.set({ kind: "spinning" });
        this.challenge.set(undefined);
        this._challengeAttempt = undefined;
        this._api.createChallenge().then((challengeResponse) => {
            if (challengeResponse.kind === "challenge") {
                this.challenge.set(challengeResponse);
                if (get(this.username) !== undefined) {
                    // The user has submitted a username so goto the "challenge" panel.
                    this.state.set({ kind: "awaiting_challenge_attempt" });
                } else {
                    // The user has not submitted a username so goto the "username" panel.
                    this.state.set({ kind: "awaiting_username" });
                }
            } else {
                // Creating a new challenge has failed.
                // Goto the "username" panel and show the error message.
                this.error.set("register.challengeThrottled");
                this.state.set({ kind: "awaiting_username" });
            }
        });
    }

    private loadUser(): void {
        this.state.set({ kind: "spinning" });
        this._api.getCurrentUser().then((resp) => {
            if (resp.kind === "created_user") {
                this.state.set({ kind: "awaiting_completion" });
                this._createdUser = resp;
            }
        });
    }
}
