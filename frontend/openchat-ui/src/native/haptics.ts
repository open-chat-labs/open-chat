// Haptics for the native shell kit: a light tap where the design notes ask for one (a tab tap, a long-press menu
// opening). The host installs the device's haptics once (the Tauri app, its plugin's impact feedback); without one,
// the kit falls back to the browser's vibration, where there is one (Android's mobile web), and otherwise does nothing.

export type HapticStyle = 'light';
export type Haptics = (style: HapticStyle) => void;

let installed: Haptics | null = null;

/** Installs the host's haptics (null puts the browser fallback back). */
export function setHaptics(haptics: Haptics | null): void {
  installed = haptics;
}

/** A light tap: the host's haptics, else a 10ms vibration where the browser has one. Never throws. */
export function haptic(style: HapticStyle = 'light'): void {
  try {
    if (installed) installed(style);
    else if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(10);
  } catch {
    // no haptics is never an error
  }
}
