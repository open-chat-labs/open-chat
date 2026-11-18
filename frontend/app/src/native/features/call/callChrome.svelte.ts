/** How long the controls of a video call stay after the last tap (design notes §3.5 Controls). */
export const CHROME_HIDE_MS = 4000;

/**
 * Whether the call screen's controls show. In a video call they hide `CHROME_HIDE_MS` after the
 * last tap, so the video grows, and a tap on the stage brings them back (or hides them at once
 * while they show). In a voice call, or while a menu is open (`held`), they always show.
 */
export class CallChrome {
    #shown = $state(true);
    #video = false;
    #held = false;
    #timer: ReturnType<typeof setTimeout> | undefined;

    get shown(): boolean {
        return this.#shown;
    }

    /** The call's media and whether a menu holds the controls up. */
    update(video: boolean, held: boolean) {
        const changed = video !== this.#video || held !== this.#held;
        this.#video = video;
        this.#held = held;
        if (changed) this.wake();
    }

    /** A control was used, or the screen opened: show them, and start the wait again. */
    wake() {
        this.#shown = true;
        this.#cancel();
        if (this.#video && !this.#held) {
            this.#timer = setTimeout(() => {
                this.#timer = undefined;
                this.#shown = false;
            }, CHROME_HIDE_MS);
        }
    }

    /** A tap on the stage: hides them at once in a video call, brings them back if hidden. */
    tapStage() {
        if (this.#shown && this.#video && !this.#held) {
            this.#cancel();
            this.#shown = false;
        } else {
            this.wake();
        }
    }

    dispose() {
        this.#cancel();
    }

    #cancel() {
        if (this.#timer !== undefined) clearTimeout(this.#timer);
        this.#timer = undefined;
    }
}
