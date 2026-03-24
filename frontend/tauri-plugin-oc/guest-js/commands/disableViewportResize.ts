import { invoke } from "@tauri-apps/api/core";

export async function disableViewportResize(): Promise<void> {
    return await invoke<void>("plugin:oc|disable_viewport_resize");
}
