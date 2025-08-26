import { invoke } from "@tauri-apps/api/core";

export type ShowNotificationRequest = {
    data: object;
};

export async function showNotification(payload: ShowNotificationRequest): Promise<void> {
    return await invoke<void>("plugin:oc|show_notification", { payload });
}
