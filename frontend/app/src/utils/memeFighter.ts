import { MEME_MAKER_URL } from "@memefighter/maker-core";

export const MEME_MAKER_ORIGIN = new URL(MEME_MAKER_URL).origin;

// @memefighter/maker-core's window "message" handler switches on `event.data.messageType`
// without checking `event.origin`, so any window able to post to ours (an external content
// frame, a popup, the parent when OpenChat is embedded) could feed it a MEME_CREATED url.
// This guard is registered before maker-core's listener; listeners on the same target run in
// registration order, so stopImmediatePropagation() keeps such messages from reaching it.
// Returns the function that removes the guard.
export function guardMemeFighterMessages(target: Window = window): () => void {
    function guard(ev: MessageEvent) {
        if (ev.origin === MEME_MAKER_ORIGIN) return;
        if (typeof ev.data === "object" && ev.data !== null && "messageType" in ev.data) {
            ev.stopImmediatePropagation();
        }
    }
    target.addEventListener("message", guard);
    return () => target.removeEventListener("message", guard);
}
