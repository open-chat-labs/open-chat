import type WaveSurfer from "wavesurfer.js";
import type RecordPlugin from "wavesurfer.js/dist/plugins/record.esm.js";

// wavesurfer.js draws the waveform of an audio message, a recording or a ringtone. On the desktop
// layout that is only the ringtone settings, so it is fetched when a waveform is first drawn
// rather than with the app. The browser keeps the module, so later calls resolve at once.
export function loadWaveSurfer(): Promise<typeof WaveSurfer> {
    return import("wavesurfer.js").then((m) => m.default);
}

export function loadRecordPlugin(): Promise<typeof RecordPlugin> {
    return import("wavesurfer.js/dist/plugins/record.esm.js").then((m) => m.default);
}

// For the components which draw a waveform: without wavesurfer there is no waveform to draw, and
// nothing the user can do about it.
export function waveSurferFailedToLoad(err: unknown): void {
    console.error("Failed to load wavesurfer", err);
}
