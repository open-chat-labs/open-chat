// Haptics for the native shell kit: a light tap where the design notes ask for one (a tab tap, a row's long-press menu
// opening), a medium one for a message's long-press menu. The host installs the device's haptics once (the Tauri app,
// its plugin's impact feedback); without one, the kit falls back to the browser's vibration, where there is one
// (Android's mobile web), and otherwise does nothing.

export type HapticStyle = 'light' | 'medium';
export type Haptics = (style: HapticStyle) => void;

// the browser fallback's vibration (ms) for each style
const VIBRATION: Record<HapticStyle, number> = { light: 10, medium: 20 };

let installed: Haptics | null = null;

/** Installs the host's haptics (null puts the browser fallback back). */
export function setHaptics(haptics: Haptics | null): void {
  installed = haptics;
}

/** A haptic (a light tap by default): the host's haptics, else a 10ms vibration (20ms for medium) where the browser
 *  has one. Never throws. */
export function haptic(style: HapticStyle = 'light'): void {
  try {
    if (installed) installed(style);
    else if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(VIBRATION[style]);
  } catch {
    // no haptics is never an error
  }
}
