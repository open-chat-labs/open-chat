import type { IdentityState } from "@client";
import { withoutAccount } from "@src/logic/auth/authFlow";

/** What the app's routes show: a spinner, an error with Retry, or the app. */
export type AppGate = "loading" | "failed" | "app";

/**
 * A spinner while the user loads and their chats arrive, as the existing trees do, except for an
 * identity without an account (sign-up goes on); in its place an error with Retry when start-up
 * couldn't load the session from before (`startUpFailed`, #10562); then the app.
 */
export function appGate(
    state: IdentityState,
    chatsInitialised: boolean,
    startUpFailed: boolean,
): AppGate {
    if (withoutAccount(state)) return "app";
    if (!chatsInitialised || state.kind === "loading_user") {
        return startUpFailed ? "failed" : "loading";
    }
    return "app";
}
