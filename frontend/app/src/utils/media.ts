export function pauseAnyPlayingMedia(except?: HTMLMediaElement) {
    const mediaElements = [
        ...window.document.getElementsByTagName("audio"),
        ...window.document.getElementsByTagName("video")
    ];
    for (const el of mediaElements) {
        if ((except === undefined || except !== el) && el.duration > 0 && !el.paused) {
            el.pause();
        }
    }
}
