import type { Identity } from "@dfinity/agent";
import type { Principal } from "@dfinity/principal";
import { writable } from "svelte/store";
import type { CurrentUserResponse, PhoneNumber, UserSummary } from "../domain/user/user";
import { getIdentity, login, startSession } from "../services/auth";
import { ServiceContainer } from "../services/serviceContainer";
import { rollbar } from "../utils/logging";

export type AppState = FatalError | Authenticated | NotAuthenticated | SessionExpired;

type FatalError = {
    kind: "fatal_error";
    error: Error;
};

type SessionExpired = {
    kind: "session_expired";
};

type Authenticated = VerifyingUser | VerifiedUser;

export type VerifyingUser = {
    kind: "verifying_user";
    identity: Identity;
    api: ServiceContainer;
    userState: UnknownUserState | CurrentUserResponse;
    registrationCode?: string;
    userCanister?: Principal;
    username?: string;
    verifying?: boolean;
    error?: Error;
};

type UnknownUserState = { kind: "unknown_user_state" };

type VerifiedUser = {
    kind: "verified_user";
    identity: Identity;
    api: ServiceContainer;
    user: UserSummary;
};

type NotAuthenticated = {
    kind: "not_authenticated";
    signingIn: boolean;
};

export const appState = writable<AppState>({
    kind: "not_authenticated",
    signingIn: false,
});

export function startLogin(): void {
    appState.update((state) => {
        if (state.kind === "not_authenticated") {
            login().then(checkIdentity).catch(fatalError);
            return {
                ...state,
                signingIn: true,
            };
        }
        return state;
    });
}

function fatalError(err: Error): void {
    appState.set({ kind: "fatal_error", error: err });
    rollbar.error("Fatal error", err);
}

function checkIdentity(identity: Identity) {
    if (!identity.getPrincipal().isAnonymous()) {
        const api = new ServiceContainer(identity);
        const state: VerifyingUser = {
            kind: "verifying_user",
            identity,
            api,
            userState: { kind: "unknown_user_state" },
        };
        appState.set(state);
        api.getCurrentUser()
            .then((userState) => {
                if (userState.kind === "created_user") {
                    // todo - need to deal with upgrade
                    startSession(identity).then(() => appState.set({ kind: "session_expired" }));
                    return appState.set({
                        kind: "verified_user",
                        user: {
                            userId: userState.userId,
                            username: userState.username,
                            secondsSinceLastOnline: 0,
                        },
                        identity,
                        api: new ServiceContainer(identity).createUserClient(userState.userId),
                    });
                } else {
                    return appState.set({ ...state, userState });
                }
            })
            .catch(fatalError);
    }
}

export function checkUser(): void {
    getIdentity().then(checkIdentity).catch(fatalError);
}

export function registering(appState: AppState): boolean {
    return (
        appState.kind === "verifying_user" &&
        (appState.userState.kind === "confirmed_user" ||
            appState.userState.kind === "unknown_user" ||
            appState.userState.kind === "unconfirmed_user" ||
            appState.userState.kind === "confirmed_pending_username")
    );
}

export function logout(): void {
    appState.set({ kind: "not_authenticated", signingIn: false });
}

export function saveUsername(username: string): void {
    appState.update((state) => {
        if (
            state.kind === "verifying_user" &&
            state.userState.kind === "confirmed_pending_username"
        ) {
            state.api.setUsername(username).then((resp) => {
                if (resp === "username_taken") {
                    appState.set({
                        ...state,
                        verifying: false,
                        error: new Error("register.usernameTaken"),
                    });
                } else if (resp === "user_not_found") {
                    appState.set({
                        ...state,
                        verifying: false,
                        error: new Error("register.userNotFound"),
                    });
                } else if (resp === "username_too_short") {
                    appState.set({
                        ...state,
                        verifying: false,
                        error: new Error("register.usernameTooShort"),
                    });
                } else if (resp === "username_too_long") {
                    appState.set({
                        ...state,
                        verifying: false,
                        error: new Error("register.usernameTooLong"),
                    });
                } else if (resp === "username_invalid") {
                    appState.set({
                        ...state,
                        verifying: false,
                        error: new Error("register.usernameInvalid"),
                    });
                } else if (resp === "success") {
                    appState.set({
                        ...state,
                        verifying: false,
                        error: undefined,
                    });
                }
            });
            return {
                ...state,
                verifying: true,
            };
        }
        return state;
    });
}

export function requestNewCode(): void {
    appState.update((state) => {
        if (state.kind === "verifying_user" && state.userState.kind === "unconfirmed_user") {
            state.api.resendRegistrationCode().then((resp) => {
                if (resp === "already_claimed") {
                    appState.set({
                        ...state,
                        verifying: false,
                        error: new Error("register.resendAlreadyClaimed"),
                    });
                } else if (resp === "user_not_found") {
                    appState.set({
                        ...state,
                        verifying: false,
                        error: new Error("register.userNotFound"),
                    });
                } else if (resp === "success") {
                    appState.set({
                        ...state,
                        verifying: false,
                        error: undefined,
                    });
                }
            });
            return {
                ...state,
                verifying: true,
            };
        }
        return state;
    });
}

export function sendConfirmationCode(code: string): void {
    appState.update((state) => {
        if (state.kind === "verifying_user" && state.userState.kind === "unconfirmed_user") {
            state.api.confirmPhoneNumber(code).then((resp) => {
                if (resp === "already_claimed") {
                    appState.set({
                        ...state,
                        verifying: false,
                        error: new Error("register.confirmAlreadyClaimed"),
                    });
                } else if (resp === "code_incorrect") {
                    appState.set({
                        ...state,
                        verifying: false,
                        error: new Error("register.codeIncorrect"),
                    });
                } else if (resp === "code_expired") {
                    appState.set({
                        ...state,
                        verifying: false,
                        error: new Error("register.codeExpired"),
                    });
                } else if (resp === "not_found") {
                    appState.set({
                        ...state,
                        verifying: false,
                        error: new Error("register.codeNotFound"),
                    });
                } else if (resp === "success") {
                    appState.set({
                        ...state,
                        userState: {
                            kind: "confirmed_pending_username",
                            canisterCreationStatus: "in_progress",
                        },
                        verifying: false,
                        error: undefined,
                    });
                }
            });
            return {
                ...state,
                verifying: true,
            };
        }
        return state;
    });
}

export function savePhoneNumber(phoneNumber: PhoneNumber): void {
    appState.update((state) => {
        if (state.kind === "verifying_user") {
            state.api.submitPhoneNumber(phoneNumber).then((resp) => {
                if (resp.kind === "already_registered") {
                    appState.set({
                        ...state,
                        verifying: false,
                        error: new Error("regiter.phoneAlreadyRegistered"),
                    });
                } else if (resp.kind === "already_registered_by_other") {
                    appState.set({
                        ...state,
                        verifying: false,
                        error: new Error("regiter.phoneAlreadyRegisteredByAnother"),
                    });
                } else if (resp.kind === "invalid_phone_number") {
                    appState.set({
                        ...state,
                        verifying: false,
                        error: new Error("regiter.phoneInvalid"),
                    });
                } else if (resp.kind === "success") {
                    appState.set({
                        ...state,
                        userState: {
                            kind: "unconfirmed_user",
                            phoneNumber,
                        },
                        verifying: false,
                        error: undefined,
                    });
                }
            });
            return {
                ...state,
                verifying: true,
            };
        }
        return state;
    });
}
