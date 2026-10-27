import { i18nKey, type OptionUpdate, type ResourceKey, type WebhookDetails } from "@shared";

/** What an edit to a webhook changes: its name, and its avatar set, replaced or removed. */
export type WebhookChanges = { name?: string; avatar: OptionUpdate<string> };

/**
 * The changes from `original` to the name and avatar (a data URL, or undefined for none) the user
 * left it with. Only what differs is sent; nothing at all means nothing to save.
 */
export function webhookChanges(
    original: WebhookDetails,
    name: string,
    avatarUrl: string | undefined,
): WebhookChanges | undefined {
    const nameChanged = name !== original.name;
    const avatarChanged = avatarUrl !== original.avatarUrl;
    if (!nameChanged && !avatarChanged) return undefined;
    return {
        name: nameChanged ? name : undefined,
        avatar: !avatarChanged
            ? undefined
            : avatarUrl === undefined
              ? "set_to_none"
              : { value: avatarUrl },
    };
}

export type WebhookSaveOutcome =
    | { kind: "registered"; webhook: WebhookDetails & { secret?: string } }
    | { kind: "updated" }
    | { kind: "unchanged" }
    | { kind: "failed"; message: ResourceKey };

export type WebhookFailure = "register" | "update" | "regenerate";

/** The message for a webhook register, update or regenerate that failed. */
export function webhookFailure(what: WebhookFailure): ResourceKey {
    switch (what) {
        case "register":
            return i18nKey("webhook.registerFailed");
        case "update":
            return i18nKey("webhook.updateFailed");
        case "regenerate":
            return i18nKey("webhook.regenerateFailed");
        default:
            return what satisfies never;
    }
}
