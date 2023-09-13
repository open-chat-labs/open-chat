let current: HTMLMediaElement | undefined;

export function setPlayingMedia(element: HTMLMediaElement) {
    if (current !== undefined &&
        current !== element &&
        current.duration > 0 &&
        !current.paused
    ) {
        current.pause();
    }
    current = element;
}
