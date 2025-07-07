import { invoke } from "@tauri-apps/api/core";

export async function svelteReady(): Promise<void> {
    return await invoke<void>("plugin:oc|svelte_ready");
}
