export const ringtoneUrls: Record<RingtoneKey, string> = {
    boring: "/assets/ringtones/ringring_boring.mp3",
    pleasant: "/assets/ringtones/tinkle.mp3",
    boomboom: "/assets/ringtones/ringring.mp3",
    garage: "/assets/ringtones/garage.mp3",
    siren: "/assets/ringtones/sirens.mp3",
};

export type RingtoneKey = "boring" | "pleasant" | "boomboom" | "garage" | "siren";

/** The ringtones, in the order the settings list them. */
export const RINGTONE_KEYS = Object.keys(ringtoneUrls) as RingtoneKey[];

/** The ringtone a stored name (selectedRingtone) plays: one the app no longer has is the default. */
export function storedRingtoneKey(stored: string): RingtoneKey {
    return RINGTONE_KEYS.find((key) => key === stored) ?? "boring";
}

export class Ringtone {
    audio: HTMLAudioElement;
    playing = $state(false);
    url: string;

    constructor(
        public key: RingtoneKey,
        public name: string,
    ) {
        this.url = ringtoneUrls[key];
        this.audio = new Audio(ringtoneUrls[key]);
        this.audio.loop = true;
    }

    toggle() {
        this.playing = !this.playing;
        if (this.playing) {
            this.audio.play();
        } else {
            this.audio.pause();
        }
    }

    stop() {
        this.playing = false;
        this.audio.pause();
    }
}
