import { invoke } from "@tauri-apps/api/core";

/** How strong a haptic is: a light tap, or the medium one a long-press plays. */
export type HapticStyle = "light" | "medium";

/**
 * A haptic: light is Android's keyboard tap feedback and iOS's light impact, medium Android's
 * long-press feedback and iOS's medium impact. A shell that takes no style plays its light tap.
 * Rejects on a shell older than the command, which the caller treats as no haptics.
 */
export async function haptic(style: HapticStyle = "light"): Promise<void> {
    return await invoke<void>("plugin:oc|haptic", { style });
}
