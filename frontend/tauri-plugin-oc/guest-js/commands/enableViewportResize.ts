import { invoke } from "@tauri-apps/api/core";

export async function enableViewportResize(): Promise<void> {
    return await invoke<void>("plugin:oc|enable_viewport_resize");
}
