/**
 * Plays the call's remote audio: one hidden `<audio>` element per track, added as a track starts
 * playing and removed as it stops. Daily's call object draws nothing, so without these a call made
 * with it is silent (#10124).
 */
export class RemoteAudio {
    #elements = new Map<string, { track: MediaStreamTrack; element: HTMLAudioElement }>();
    // Elements the browser refused to start (Safari, without a recent gesture), started again on
    // the user's next tap or key
    #blocked = new Set<HTMLAudioElement>();
    #retry = () => this.#playBlocked();
    #root: HTMLElement;
    // The speaker the user chose, which every element plays to (none: the system's default)
    #sinkId: string | undefined;
    #streamOf: (track: MediaStreamTrack) => MediaStream;

    constructor(
        root: HTMLElement = document.body,
        streamOf: (track: MediaStreamTrack) => MediaStream = (track) => new MediaStream([track]),
    ) {
        this.#root = root;
        this.#streamOf = streamOf;
    }

    /** Plays exactly these tracks (`remoteAudioTracks`), keyed by participant and kind. */
    sync(tracks: Map<string, MediaStreamTrack>): void {
        for (const [key, entry] of this.#elements) {
            if (tracks.get(key) !== entry.track) {
                this.#remove(key);
            }
        }
        for (const [key, track] of tracks) {
            if (this.#elements.has(key)) continue;
            const element = document.createElement("audio");
            element.autoplay = true;
            element.hidden = true;
            element.dataset.callAudio = key;
            element.srcObject = this.#streamOf(track);
            this.#root.appendChild(element);
            this.#elements.set(key, { track, element });
            if (this.#sinkId !== undefined) void this.#applySink(element, this.#sinkId);
            this.#play(element);
        }
    }

    /** Whether this browser lets the app choose where audio plays (`setSinkId`). */
    get canChooseSink(): boolean {
        return typeof HTMLMediaElement !== "undefined" && "setSinkId" in HTMLMediaElement.prototype;
    }

    get sinkId(): string | undefined {
        return this.#sinkId;
    }

    /** Plays every remote voice, now and later, through this speaker. */
    async setSink(deviceId: string): Promise<void> {
        this.#sinkId = deviceId;
        await Promise.all(
            [...this.#elements.values()].map(({ element }) => this.#applySink(element, deviceId)),
        );
    }

    async #applySink(element: HTMLAudioElement, deviceId: string) {
        try {
            await (
                element as HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> }
            ).setSinkId?.(deviceId);
        } catch (err) {
            console.warn("Couldn't play call audio on the chosen speaker", err);
        }
    }

    /** Stops everything: the call is over. */
    clear(): void {
        for (const key of [...this.#elements.keys()]) {
            this.#remove(key);
        }
        this.#stopRetrying();
    }

    #play(element: HTMLAudioElement) {
        try {
            element.play()?.catch(() => {
                if (!element.isConnected) return;
                this.#blocked.add(element);
                document.addEventListener("pointerdown", this.#retry, { capture: true });
                document.addEventListener("keydown", this.#retry, { capture: true });
            });
        } catch {
            // not playable here (no media support); the element is still attached
        }
    }

    #playBlocked() {
        const blocked = [...this.#blocked];
        this.#stopRetrying();
        blocked.filter((element) => element.isConnected).forEach((element) => this.#play(element));
    }

    #stopRetrying() {
        this.#blocked.clear();
        document.removeEventListener("pointerdown", this.#retry, { capture: true });
        document.removeEventListener("keydown", this.#retry, { capture: true });
    }

    #remove(key: string) {
        const entry = this.#elements.get(key);
        if (entry === undefined) return;
        entry.element.srcObject = null;
        entry.element.remove();
        this.#blocked.delete(entry.element);
        this.#elements.delete(key);
    }
}
