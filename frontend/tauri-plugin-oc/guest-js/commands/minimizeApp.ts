import { invoke } from "@tauri-apps/api/core";

export async function minimizeApp(): Promise<void> {
    return await invoke<void>("plugin:oc|minimize_app");
}
