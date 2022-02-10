import { get, Writable, writable } from "svelte/store";
import type { CreatedUser, CurrentUserResponse } from "../domain/user/user";
import type { ServiceContainer } from "../services/serviceContainer";

export type Verifying = { kind: "verifying" };
export type AwaitingUsername = { kind: "awaiting_username" };
export type AwaitingCompletion = { kind: "awaiting_completion" };

export type RegisterState = Verifying | AwaitingUsername | AwaitingCompletion;

export class RegisterController {
    public state: Writable<RegisterState> = writable({ kind: "awaiting_username" });
    public error: Writable<string | undefined> = writable(undefined);
    public username: Writable<string | undefined> = writable(undefined);
    private _createdUser?: CreatedUser;

    constructor(
        private _api: ServiceContainer,
        private currentUser: CurrentUserResponse,
        private _onComplete: (user: CreatedUser) => void
    ) {
        this.deriveStateFromUser(currentUser);
    }

    private deriveStateFromUser(user: CurrentUserResponse): void {
        if (user.kind === "unknown_user") {
            this.state.set({ kind: "awaiting_username" });
        }
    }

    registerUser(username: string): void {
        const currentState = get(this.state);
        this.state.set({ kind: "verifying" });
        this.username.set(username);
        this._api.registerUser(username).then((resp) => {
            this.state.set(currentState);
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
            } else if (resp === "success") {
                this.error.set(undefined);
                this.loadUser();
            }
        });
    }

    private loadUser(): Promise<CurrentUserResponse> {
        return this._api.getCurrentUser().then((resp) => {
            if (resp.kind === "created_user") {
                this.state.set({ kind: "awaiting_completion" });
                this._createdUser = resp;
                return resp;
            }
            return resp;
        });
    }

    complete(): void {
        if (this._createdUser !== undefined) {
            this._onComplete(this._createdUser);
        }
    }
}
