/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
declare module "remount/es5";

declare module "svelte-qr";

declare module "svelte-confetti";

declare global {
    interface Window {
        twttr: any;
        platformModerator: any;
        platformOperator: any;
    }

    interface Document {
        startViewTransition?: (callback: () => void | Promise<void>) => {
            finished: Promise<void>;
            updateCallbackDone: Promise<void>;
            ready: Promise<void>;
        };
    }
}

declare namespace svelteHTML {
    interface HTMLAttributes<T> {
        "on:consider"?: (event: CustomEvent) => void;
        "on:finalize"?: (event: CustomEvent) => void;
        onswiping?: (event: CustomEvent) => void;
        onleftswipe?: (event: CustomEvent) => void;
        onrightswipe?: (event: CustomEvent) => void;
        "on:profile-clicked"?: (event: CustomEvent) => void;
    }
}

declare function gtag(command: "event", name: string, options?: any): void;

declare interface Set<T> {
    difference(other: Set<T>): Set<T>;
}
