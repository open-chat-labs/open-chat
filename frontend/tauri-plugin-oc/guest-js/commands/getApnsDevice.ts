import { invoke } from "@tauri-apps/api/core";

export type GetApnsDeviceResponse = {
    alertToken: string | null;
};

// The iOS app's APNs alert token, prefixed `sandbox:` by a development build. Null when APNs gave
// none. Always null on Android, which pushes through FCM.
export async function getApnsDevice(): Promise<{ alertToken?: string }> {
    return await invoke<GetApnsDeviceResponse>("plugin:oc|get_apns_device").then((r) =>
        r.alertToken ? { alertToken: r.alertToken } : {},
    );
}
