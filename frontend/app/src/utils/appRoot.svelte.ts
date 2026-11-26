import {
    i18nKey,
    inititaliseLogger,
    signUpInterruptedStore,
    subscribe,
    type Logger,
    type OpenChat,
} from "@client";
import { rtlStore } from "@stores/rtl";
import { toastStore } from "@stores/toast";
import { broadcastLoggedInUser } from "@stores/xframe";
import { recordError } from "@utils/errorPostmortem";

// Wiring every App tree's root (components, components_mobile, web) does the same way, and some
// only the new trees' roots (web, native) do.

export function initialiseAppLogger(): Logger {
    return inititaliseLogger(
        import.meta.env.OC_ROLLBAR_ACCESS_TOKEN!,
        import.meta.env.OC_WEBSITE_VERSION!,
        import.meta.env.OC_BUILD_ENV!,
    );
}

// Sets the page direction from the locale. Call during the root component's initialisation.
export function followDocumentDirection(): void {
    $effect(() =>
        rtlStore.subscribe((rtl) => {
            document.dir = rtl ? "rtl" : "ltr";
        }),
    );
}

// The root's <svelte:boundary> onerror
export function boundaryErrorHandler(logger: Logger | undefined): (err: unknown) => void {
    return (err) => {
        recordError("boundary", err);
        logger?.error("Top level boundary error: ", err);
    };
}

// Login, session expiry and user id changes. A login is broadcast to the app's other tabs.
// Returns the unsubscribe.
export function subscribeToSessionEvents(
    client: OpenChat,
    {
        onLoggedIn,
        onUserIdChanged = () => window.location.reload(),
    }: {
        onLoggedIn?: (userId: string) => void;
        // The current user has a new user id, so start again under it
        onUserIdChanged?: () => void;
    } = {},
): () => void {
    const unsubs = [
        subscribe("userLoggedIn", (userId) => {
            onLoggedIn?.(userId);
            broadcastLoggedInUser(userId);
        }),
        subscribe("sessionExpired", () => client.logout()),
        subscribe("currentUserIdChanged", onUserIdChanged),
    ];
    return () => unsubs.forEach((u) => u());
}

// A passkey sign-up from before a reload that couldn't be carried on left the page signed out
// (signUpInterruptedStore, #10596): the new trees' roots say why, as a failure toast, which stays
// until it's closed. Returns the unsubscribe.
export function sayWhenSignUpInterrupted(): () => void {
    return signUpInterruptedStore.subscribe((interrupted) => {
        if (!interrupted) return;
        signUpInterruptedStore.set(false);
        toastStore.showFailureToast(i18nKey("signUpInterrupted"));
    });
}
