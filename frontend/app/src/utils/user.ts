import type { ReadonlyMap, UserLookup, UserSummary, WebhookDetails } from "openchat-client";
import { _ } from "svelte-i18n";
import { get } from "svelte/store";

export function buildDisplayName(
    users: UserLookup,
    userId: string,
    me: boolean,
    bold = true,
    webhooks: ReadonlyMap<string, WebhookDetails> | undefined = undefined,
): string {
    const summary = findSender(userId, users, webhooks ?? new Map());
    const name = me
        ? get(_)("you")
        : summary?.displayName ?? summary?.username ?? get(_)("unknownUser");
    return bold ? `**${name}**` : name;
}

export function trimLeadingAtSymbol(term: string): string {
    return term.length > 0 && term[0] === "@" ? term.substring(1) : term;
}

export function findSender(
    senderId: string,
    users: UserLookup,
    webhooks: ReadonlyMap<string, WebhookDetails>,
): UserSummary | undefined {
    const user = users.get(senderId);
    if (user !== undefined) {
        return user;
    }

    const webhook = webhooks.get(senderId);
    if (webhook === undefined) {
        return undefined;
    }

    return {
        kind: "bot",
        userId: webhook.id,
        username: webhook.name,
        blobUrl: webhook.avatarUrl,
        displayName: undefined,
        updated: BigInt(0),
        suspended: false,
        diamondStatus: "inactive",
        chitBalance: 0,
        streak: 0,
        isUniquePerson: false,
        totalChitEarned: 0,
    };
}
