// Short rising two-tone blip played when a pose is captured. Synthesised so
// no audio asset is needed; safe to call repeatedly (the AudioContext is
// created after the consent click, so autoplay policies are satisfied).

let context: AudioContext | undefined;

export function playCaptureTone(): void {
    try {
        context ??= new AudioContext();
        const now = context.currentTime;
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(660, now);
        oscillator.frequency.setValueAtTime(880, now + 0.09);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
        oscillator.connect(gain).connect(context.destination);
        oscillator.start(now);
        oscillator.stop(now + 0.3);
    } catch {
        // audio is a nice-to-have
    }
}
