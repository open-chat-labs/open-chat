import { untrack } from "svelte";
import type { NativeCallAction } from "./call_bridge";

// What the native shell parked during a cold start, before the app could take it: an answered call,
// a deep link, a notification tap. The listeners park them as they arrive (they pull them from the
// shell once they're registered, which can be after the router first looked); the router opens one
// once it can. `pending` is reactive, so a router that looked too early and reads it sees one
// when it lands (src/native's does; components_mobile's takes one only when its list shows).

/** Where a cold start should land instead of the app's usual start. */
export type ColdStartIntent =
    | { kind: "call"; action: NativeCallAction }
    | { kind: "deep_link"; url: string }
    | { kind: "notification"; path: string };

export class ColdStartIntents {
    #call = $state.raw<NativeCallAction | null>(null);
    #deepLink = $state<string | null>(null);
    #tap = $state<string | null>(null);

    parkCall(action: NativeCallAction): void {
        this.#call = action;
    }

    parkDeepLink(url: string): void {
        this.#deepLink = url;
    }

    parkNotificationTap(path: string): void {
        this.#tap = path;
    }

    /** Whether anything's parked. Tracked: an effect reading it runs again when one lands. */
    get pending(): boolean {
        return this.#call !== null || this.#deepLink !== null || this.#tap !== null;
    }

    /**
     * Takes what's parked, once: an answered native ring beats a deep link, which beats a
     * notification tap, and the others are dropped (a cold start lands in one place).
     * Untracked: taking an intent never makes the effect that took it run again (it would find
     * nothing parked and fall through to its default, such as components_mobile's default chat).
     * An effect that wants to open an intent landing later reads `pending` on purpose.
     */
    take(): ColdStartIntent | undefined {
        return untrack(() => {
            const call = this.#call;
            const url = this.#deepLink;
            const path = this.#tap;
            if (call === null && url === null && path === null) return undefined;
            this.#call = null;
            this.#deepLink = null;
            this.#tap = null;
            if (call !== null) return { kind: "call", action: call };
            if (url !== null) return { kind: "deep_link", url };
            return path !== null ? { kind: "notification", path } : undefined;
        });
    }
}

export const coldStartIntents = new ColdStartIntents();

/** Takes what a cold start parked, if anything (ColdStartIntents.take). */
export function consumeColdStartIntent(): ColdStartIntent | undefined {
    return coldStartIntents.take();
}
