export const ringtoneUrls: Record<RingtoneKey, string> = {
    boring: "/assets/ringtones/ringring_boring.mp3",
    pleasant: "/assets/ringtones/tinkle.mp3",
    boomboom: "/assets/ringtones/ringring.mp3",
    garage: "/assets/ringtones/garage.mp3",
    siren: "/assets/ringtones/sirens.mp3",
};

export type RingtoneKey = "boring" | "pleasant" | "boomboom" | "garage" | "siren";

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
        this.audio.pause();
    }
}
