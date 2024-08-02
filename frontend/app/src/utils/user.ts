import { get } from "svelte/store";
import { _ } from "svelte-i18n";
import type { UserLookup } from "openchat-client";

export function buildDisplayName(
    users: UserLookup,
    userId: string,
    me: boolean,
    bold = true,
): string {
    const summary = users.get(userId);
    const name = me
        ? get(_)("you")
        : summary?.displayName ?? summary?.username ?? get(_)("unknownUser");
    return bold ? `**${name}**` : name;
}

export function trimLeadingAtSymbol(term: string): string {
    return term.length > 0 && term[0] === "@" ? term.substring(1) : term;
}
