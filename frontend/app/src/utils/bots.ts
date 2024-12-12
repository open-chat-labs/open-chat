import type { SlashCommandPermissions } from "openchat-client";

export let botsEnabled = localStorage.getItem("openchat_bots_enabled") === "true";

export function togglePermission<P extends keyof SlashCommandPermissions>(
    permissions: SlashCommandPermissions,
    prop: P,
    permission: SlashCommandPermissions[P][number],
) {
    const list = permissions[prop] as SlashCommandPermissions[P][number][];
    if (list.includes(permission)) {
        permissions[prop] = list.filter((p) => p !== permission) as SlashCommandPermissions[P];
    } else {
        list.push(permission);
    }
}
