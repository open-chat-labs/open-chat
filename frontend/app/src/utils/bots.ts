import type { ExternalBotPermissions } from "openchat-client";

export function togglePermission<P extends keyof ExternalBotPermissions>(
    permissions: ExternalBotPermissions,
    prop: P,
    permission: ExternalBotPermissions[P][number],
) {
    const list = permissions[prop] as ExternalBotPermissions[P][number][];
    if (list.includes(permission)) {
        permissions[prop] = list.filter((p) => p !== permission) as ExternalBotPermissions[P];
    } else {
        list.push(permission);
    }
}
