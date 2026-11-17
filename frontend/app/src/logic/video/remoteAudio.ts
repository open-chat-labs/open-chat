/**
 * Plays the call's remote audio: one hidden `<audio>` element per track, added as a track starts
 * playing and removed as it stops. Daily's call object draws nothing, so without these a call made
 * with it is silent (#10124).
 */
export class RemoteAudio {
    #elements = new Map<string, { track: MediaStreamTrack; element: HTMLAudioElement }>();
    #root: HTMLElement;
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
            // autoplay can be refused until the page has had a gesture, which joining a call is
            try {
                element.play()?.catch(() => undefined);
            } catch {
                // not playable here (no media support); the element is still attached
            }
        }
    }

    /** Stops everything: the call is over. */
    clear(): void {
        for (const key of [...this.#elements.keys()]) {
            this.#remove(key);
        }
    }

    #remove(key: string) {
        const entry = this.#elements.get(key);
        if (entry === undefined) return;
        entry.element.srcObject = null;
        entry.element.remove();
        this.#elements.delete(key);
    }
}
