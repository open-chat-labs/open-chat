import { setPlayingMedia } from "@src/utils/media";

export type VoiceSpeed = "1x" | "1.5x" | "2x";

/**
 * The conversation's voice messages' playback: one audio element, so one message plays at a time,
 * and starting one pauses any other playing media (setPlayingMedia). Messages are told apart by a
 * key the screen gives them. The speed is the player's, so every message shows the same one.
 */
export class VoicePlayer {
    #audio: HTMLAudioElement | undefined;
    #key = $state<string>();
    #playing = $state(false);
    #time = $state(0);
    speed = $state<VoiceSpeed>("1x");

    #element(): HTMLAudioElement {
        if (this.#audio === undefined) {
            const audio = new Audio();
            audio.addEventListener("timeupdate", () => (this.#time = audio.currentTime));
            audio.addEventListener("play", () => {
                this.#playing = true;
                setPlayingMedia(audio);
            });
            audio.addEventListener("pause", () => (this.#playing = false));
            audio.addEventListener("ended", () => {
                audio.currentTime = 0;
                this.#time = 0;
            });
            this.#audio = audio;
        }
        return this.#audio;
    }

    // the audio element, holding this message's recording
    #load(key: string, url: string): HTMLAudioElement {
        const audio = this.#element();
        if (this.#key !== key) {
            audio.src = url;
            this.#key = key;
            this.#time = 0;
        }
        // a new source starts at the default rate
        audio.defaultPlaybackRate = audio.playbackRate = parseFloat(this.speed);
        return audio;
    }

    play(key: string, url: string | undefined): void {
        if (url === undefined) return;
        this.#load(key, url)
            .play()
            .catch((err) => console.warn("Couldn't play a voice message", err));
    }

    pause(key: string): void {
        if (this.#key === key) this.#audio?.pause();
    }

    seek(key: string, url: string | undefined, seconds: number): void {
        if (url === undefined) return;
        const audio = this.#load(key, url);
        audio.currentTime = seconds;
        this.#time = seconds;
    }

    setSpeed(speed: VoiceSpeed): void {
        this.speed = speed;
        if (this.#audio !== undefined) {
            this.#audio.defaultPlaybackRate = this.#audio.playbackRate = parseFloat(speed);
        }
    }

    playing(key: string): boolean {
        return this.#key === key && this.#playing;
    }

    /** Where this message's recording is, in seconds (0 unless it's the one loaded). */
    time(key: string): number {
        return this.#key === key ? this.#time : 0;
    }

    stop(): void {
        this.#audio?.pause();
        this.#audio?.removeAttribute("src");
        this.#key = undefined;
        this.#time = 0;
    }
}
