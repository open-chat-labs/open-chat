import { get } from "svelte/store";
import { _ } from "svelte-i18n";
import type { UserLookup } from "openchat-client";

export function buildDisplayName(users: UserLookup, userId: string, me: boolean, bold = true): string {
    const summary = users[userId];
    const name = me ? get(_)("you") : summary?.displayName ?? summary?.username ?? get(_)("unknownUser");
    return bold ? `**${name}**` : name;
}