let audio: HTMLAudioElement | undefined;

export function scream(): HTMLAudioElement {
    if (audio === undefined) {
        audio = new Audio("/assets/scream.mp3");
    }
    return audio;
}
