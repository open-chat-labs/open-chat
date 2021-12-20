import { Writable, writable } from "svelte/store";
import type {
    CreatedUser,
    CurrentUserResponse,
    PhoneNumber,
    RegistrationState,
} from "../domain/user/user";
import type { ServiceContainer } from "../services/serviceContainer";

export type ChooseRegistrationPath = { kind: "choose_registration_path" };
export type AwaitingPhoneNumber = { kind: "awaiting_phone_number" };
export type AwaitingCode = { kind: "awaiting_code"; phoneNumber: PhoneNumber };
export type AwaitingTransferConfirmation = {
    kind: "awaiting_transfer_confirmation";
    requiredTransfer: number;
};
export type Verifying = { kind: "verifying" };
export type AwaitingUsername = { kind: "awaiting_username" };
export type AwaitingCompletion = { kind: "awaiting_completion" };
export type AwaitingCanister = { kind: "awaiting_canister" };

export type RegisterState =
    | ChooseRegistrationPath
    | AwaitingPhoneNumber
    | AwaitingCode
    | AwaitingTransferConfirmation
    | Verifying
    | AwaitingUsername
    | AwaitingCompletion
    | AwaitingCanister;

export class RegisterController {
    public state: Writable<RegisterState> = writable({ kind: "awaiting_phone_number" });
    public error: Writable<string | undefined> = writable(undefined);
    public username: Writable<string | undefined> = writable(undefined);
    public registrationState: Writable<RegistrationState | undefined> = writable(undefined);
    private _createdUser?: CreatedUser;

    constructor(
        private _api: ServiceContainer,
        private currentUser: CurrentUserResponse,
        private _onComplete: (user: CreatedUser) => void,
        private _regState?: RegistrationState
    ) {
        this.registrationState = writable(_regState);
        this.deriveStateFromUser(currentUser);
    }

    private deriveStateFromUser(user: CurrentUserResponse): void {
        if (user.kind === "unknown_user") {
            this.state.set({ kind: "choose_registration_path" });
        } else if (user.kind === "unconfirmed_user") {
            if (user.registrationState.kind === "phone_registration") {
                this.state.set({
                    kind: "awaiting_code",
                    phoneNumber: user.registrationState.phoneNumber,
                });
            } else {
                this.state.set({
                    kind: "awaiting_transfer_confirmation",
                    requiredTransfer: user.registrationState.requiredTransfer,
                });
            }
        } else if (user.kind === "confirmed_pending_username") {
            this.state.set({ kind: "awaiting_username" });
        } else if (user.kind === "confirmed_user") {
            if (user.canisterCreationStatus === "in_progress") {
                this.state.set({ kind: "awaiting_canister" });
            } else if (user.canisterCreationStatus === "pending") {
                this.state.set({ kind: "awaiting_canister" });
                this.loadUser();
            }
        }
    }

    async transferConfirmed(): Promise<void> {
        this.state.set({ kind: "verifying" });
        this.currentUser = await this.loadUser();
        this.deriveStateFromUser(this.currentUser);
    }

    reset(): void {
        this.state.set({ kind: "choose_registration_path" });
    }

    choosePhoneVerification(): void {
        this.state.set({ kind: "awaiting_phone_number" });
    }

    chooseCyclesTransfer(): void {
        // todo - we need to make an api call here so that we can get hold of the required transfer amount
        this.state.set({ kind: "verifying" });
        setTimeout(() => {
            this.state.set({
                kind: "awaiting_transfer_confirmation",
                requiredTransfer: 1.0012345,
            });
        }, 2000);
    }

    submitRegistrationCode(phoneNumber: PhoneNumber, code: string): void {
        this.state.set({ kind: "verifying" });
        this._api.confirmPhoneNumber(code).then((resp) => {
            this.state.set({ kind: "awaiting_code", phoneNumber });
            if (resp === "already_claimed") {
                this.error.set("register.confirmAlreadyClaimed");
            } else if (resp === "code_expired") {
                this.error.set("register.codeExpired");
            } else if (resp === "code_incorrect") {
                this.error.set("register.codeIncorrect");
            } else if (resp === "not_found") {
                this.error.set("register.codeNotFound");
            } else if (resp === "success") {
                this.error.set(undefined);
                this.state.set({ kind: "awaiting_username" });
            }
        });
    }

    changePhoneNumber(): void {
        this.state.set({ kind: "awaiting_phone_number" });
    }

    requestRegistrationCode(phoneNumber: PhoneNumber): void {
        this.registrationState.set({
            kind: "phone_registration",
            phoneNumber,
        });
        this.state.set({ kind: "verifying" });
        this._api.submitPhoneNumber(phoneNumber).then((resp) => {
            this.state.set({ kind: "awaiting_phone_number" });
            if (resp.kind === "already_registered") {
                this.error.set("register.phoneAlreadyRegistered");
            } else if (resp.kind === "already_registered_by_other") {
                this.error.set("register.phoneAlreadyRegisteredByAnother");
            } else if (resp.kind === "invalid_phone_number") {
                this.error.set("register.phoneInvalid");
            } else if (resp.kind === "user_limit_reached") {
                this.error.set("register.userLimitReached");
            } else if (resp.kind === "success") {
                this.error.set(undefined);
                this.state.set({ kind: "awaiting_code", phoneNumber });
            }
        });
    }

    registerUser(username: string): void {
        this.state.set({ kind: "verifying" });
        this.username.set(username);
        this._api.setUsername(username).then((resp) => {
            this.state.set({ kind: "awaiting_username" });
            if (resp === "username_taken") {
                this.error.set("register.usernameTaken");
            } else if (resp === "user_not_found") {
                this.error.set("register.userNotFound");
            } else if (resp === "username_too_short") {
                this.error.set("register.usernameTooShort");
            } else if (resp === "username_too_long") {
                this.error.set("register.usernameTooLong");
            } else if (resp === "username_invalid") {
                this.error.set("register.usernameInvalid");
            } else if (resp === "success") {
                this.error.set(undefined);
                this.state.set({ kind: "awaiting_canister" });
                this.loadUser();
            }
        });
    }

    private loadUser(): Promise<CurrentUserResponse> {
        return this._api.getCurrentUser().then((resp) => {
            if (
                (resp.kind === "confirmed_user" || resp.kind === "confirmed_pending_username") &&
                resp.canisterCreationStatus === "pending"
            ) {
                return this._api.createCanister().then((canisterResp) => {
                    if (canisterResp !== "success") {
                        console.log("Create use canister failed: ", canisterResp);
                    }
                    return this.loadUser();
                });
            } else if (resp.kind === "created_user") {
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

    resendRegistrationCode(phoneNumber: PhoneNumber): void {
        this.state.set({ kind: "verifying" });
        this._api.resendRegistrationCode().then((resp) => {
            if (resp === "already_claimed") {
                this.error.set("register.resendAlreadyClaimed");
            } else if (resp === "user_not_found") {
                this.error.set("register.userNotFound");
            } else {
                this.error.set(undefined);
            }
            this.state.set({ kind: "awaiting_code", phoneNumber });
        });
    }
}
