import { invoke } from "@tauri-apps/api/core";

export type GetFcmTokenResponse = {
    fcmToken: string | null;
};

export async function getFcmToken(): Promise<string | null> {
    return await invoke<GetFcmTokenResponse>("plugin:oc|get_fcm_token").then((r) => r.fcmToken);
}
