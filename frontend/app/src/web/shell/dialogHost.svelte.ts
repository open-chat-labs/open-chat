import { subscribe, type RulesAcceptanceResolver } from "@client";
import type { AppEventDialog } from "@src/logic/appEvents/appEvents";
import type { ProfileCard } from "@src/logic/profile/profileCard";
import { flushPendingNavigation, navigate } from "@src/utils/navigation";
import type { Readable } from "svelte/store";

/** The local dialogs the shell shows (a dialog people link to is a query param instead, ROUTES.md). */
export type HostDialog =
    | { kind: "app_event"; dialog: AppEventDialog }
    // checked against the user when it shows, as the old trees did: a bot shows nothing
    | { kind: "user"; clicked: ProfileCard };

export const dialogHostKey = Symbol("dialogHost");

// The one place that knows which of the app's local dialogs is open (features/app/DialogHost
// mounts them). navigate() doesn't go anywhere by itself: it publishes closeModalStack, and
// answerNavigations (subscribed by the router) closes everything here before the navigation goes.
export class DialogHost {
    #open = $state<HostDialog | undefined>(undefined);
    #prompts = new Set<() => void>();
    #dismissedRoute: () => string;

    /** dismissedRoute: where closing the not-found, no-access or restricted dialog goes. */
    constructor(dismissedRoute: () => string) {
        this.#dismissedRoute = dismissedRoute;
    }

    get open(): HostDialog | undefined {
        return this.#open;
    }

    show(dialog: HostDialog): void {
        this.#open = dialog;
    }

    /** The user closed the open dialog. An app event's dialog then goes away from what it couldn't show. */
    dismiss(): void {
        const open = this.#open;
        this.#open = undefined;
        if (open?.kind === "app_event") navigate(this.#dismissedRoute());
    }

    /**
     * Gives up the client's rules prompt on a navigation, as Reject does (the send ends
     * rules_declined): the client reads the selected chat's rules when the prompt is answered, so
     * accepting it after a navigation would accept another chat's rules. Returns the unsubscribe.
     */
    watchRulesPrompt(prompts: Readable<RulesAcceptanceResolver | undefined>): () => void {
        let release = () => {};
        const unsubscribe = prompts.subscribe((prompt) => {
            release();
            release =
                prompt === undefined ? () => {} : this.holdPrompt(() => prompt.resolve(false));
        });
        return () => {
            unsubscribe();
            release();
        };
    }

    /** Registers how to give up a prompt the client opened (rules acceptance); returns the unregister. */
    holdPrompt(cancel: () => void): () => void {
        this.#prompts.add(cancel);
        return () => this.#prompts.delete(cancel);
    }

    /**
     * closeModalStack's answer: closes everything open, then lets navigate()'s pending navigation
     * go. A dialog closed here never runs its own close navigation (dismiss), which would replace
     * the one asked for.
     */
    closeForNavigation(flush: () => void): void {
        this.#open = undefined;
        for (const cancel of [...this.#prompts]) cancel();
        flush();
    }
}

/** Answers navigate()'s closeModalStack for the app: the host closes its dialogs, then the
 * navigation goes. The router subscribes it once; returns the unsubscribe. */
export function answerNavigations(host: DialogHost): () => void {
    return subscribe("closeModalStack", () => host.closeForNavigation(flushPendingNavigation));
}
