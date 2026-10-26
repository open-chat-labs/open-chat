import { isTouchDevice } from "@src/utils/devices";

// Where the Invaders game can be played: it steers with the arrow keys, or on a touch screen with
// the tilt, which only iOS asks to read (DeviceOrientationEvent.requestPermission).

/** Whether reading the tilt needs the user's permission first (iOS). */
export function tiltNeedsPermission(): boolean {
    return (
        typeof window !== "undefined" &&
        window.DeviceOrientationEvent !== undefined &&
        "requestPermission" in window.DeviceOrientationEvent
    );
}

/** Whether this device can play: one with a keyboard, or iOS, which can steer by tilting. */
export function invadersSupported(): boolean {
    return !isTouchDevice || tiltNeedsPermission();
}
