import { get, Writable, writable } from "svelte/store";
import { rollbar } from "utils/logging";
import type {
    CreatedUser,
    CurrentUserResponse,
    FeeCurrency,
    NotificationFeePaidResponse,
    PhoneNumber,
} from "../domain/user/user";
import type { ServiceContainer } from "../services/serviceContainer";
import { toastStore } from "../stores/toast";

export type ChooseRegistrationPath = { kind: "choose_registration_path" };
export type AwaitingPhoneNumber = { kind: "awaiting_phone_number" };
export type AwaitingCode = { kind: "awaiting_code"; phoneNumber: PhoneNumber };
export type AwaitingCyclesTransferConfirmation = {
    kind: "awaiting_cycles_transfer_confirmation";
    amount: bigint;
};
export type AwaitingICPTransferConfirmation = {
    kind: "awaiting_icp_transfer_confirmation";
    amount: bigint;
    receiver: string;
};
export type Verifying = { kind: "verifying" };
export type AwaitingUsername = { kind: "awaiting_username" };
export type AwaitingCompletion = { kind: "awaiting_completion" };
export type AwaitingCanister = { kind: "awaiting_canister" };

export type RegisterState =
    | ChooseRegistrationPath
    | AwaitingPhoneNumber
    | AwaitingCode
    | AwaitingCyclesTransferConfirmation
    | AwaitingICPTransferConfirmation
    | Verifying
    | AwaitingUsername
    | AwaitingCompletion
    | AwaitingCanister;

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
        } else if (user.kind === "unconfirmed_user") {
            if (user.registrationState.kind === "phone_registration") {
                this.state.set({
                    kind: "awaiting_code",
                    phoneNumber: user.registrationState.phoneNumber,
                });
            } else if (user.registrationState.fee.kind === "icp_registration_fee") {
                this.state.set({
                    kind: "awaiting_icp_transfer_confirmation",
                    amount: user.registrationState.fee.amount,
                    receiver: user.registrationState.fee.recipient,
                });
            } else if (user.registrationState.fee.kind === "cycles_registration_fee") {
                this.state.set({
                    kind: "awaiting_cycles_transfer_confirmation",
                    amount: user.registrationState.fee.amount,
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

    notifyRegistrationFeePaid(): Promise<NotificationFeePaidResponse> {
        return this._api.notifyRegistrationFeePaid();
    }

    async cyclesTransferConfirmed(): Promise<void> {
        this.state.set({ kind: "verifying" });
        this.currentUser = await this.loadUser();
        this.deriveStateFromUser(this.currentUser);
    }

    async icpTransferConfirmed(): Promise<void> {
        const currentState = get(this.state);
        this.state.set({ kind: "verifying" });
        const resp = await this.notifyRegistrationFeePaid();
        if (resp === "success" || resp === "already_registered") {
            this.error.set(undefined);
            this.currentUser = await this.loadUser();
            this.deriveStateFromUser(this.currentUser);
        } else {
            this.state.set(currentState);
            this.error.set("register.unableToConfirmFee");
            rollbar.warn("Unable to confirm registration fee", resp);
        }
    }

    reset(): void {
        this.state.set({ kind: "choose_registration_path" });
    }

    choosePhoneVerification(): void {
        this.state.set({ kind: "awaiting_phone_number" });
    }

    chooseTransfer(currency: FeeCurrency): void {
        this.state.set({ kind: "verifying" });
        this._api.generateRegistrationFee(currency).then((resp) => {
            if (resp.kind === "currency_registration") {
                if (resp.fee.kind === "icp_registration_fee") {
                    this.state.set({
                        kind: "awaiting_icp_transfer_confirmation",
                        amount: resp.fee.amount,
                        receiver: resp.fee.recipient,
                    });
                }
                if (resp.fee.kind === "cycles_registration_fee") {
                    this.state.set({
                        kind: "awaiting_cycles_transfer_confirmation",
                        amount: resp.fee.amount,
                    });
                }
            } else {
                this.state.set({ kind: "choose_registration_path" });
                toastStore.showFailureToast("register.failedToGetFee");
            }
        });
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
                this.state.set({
                    kind: "awaiting_username",
                });
            }
        });
    }

    changePhoneNumber(): void {
        this.state.set({ kind: "awaiting_phone_number" });
    }

    requestRegistrationCode(phoneNumber: PhoneNumber): void {
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
        const currentState = get(this.state);
        this.state.set({ kind: "verifying" });
        this.username.set(username);
        this._api.setUsername(username).then((resp) => {
            this.state.set(currentState);
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
