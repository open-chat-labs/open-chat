import {
    permissionsToGrant,
    type BotInstallationLocation,
    type ExternalBotPermissions,
    type GrantedBotPermissions,
    type BotDefinition as AppBotDefinition,
} from "@client";
import type { BotPermissionInfo } from "@openchat/ui/src/features/components/BotDialog.svelte";

// A bot's permissions as BotDialog lists them, and its toggles back as the permissions to grant.
// Each permission keeps the app's own name and scope in its key ("command:chat:pinMessages"), so
// what's granted is exactly what was toggled on: nothing is mapped onto the dialog's built-in
// vocabulary.

type Use = keyof GrantedBotPermissions; // "command" | "autonomous"
type Scope = "chat" | "community" | "message";

const LISTS: Record<Scope, keyof ExternalBotPermissions> = {
    chat: "chatPermissions",
    community: "communityPermissions",
    message: "messagePermissions",
};

// permissions that act on people, called out in the dialog's summary
const RISKY = new Set([
    "changeRoles",
    "updateGroup",
    "updateDetails",
    "removeMembers",
    "deleteMessages",
    "pinMessages",
    "mentionAllMembers",
    "inviteUsers",
    "addMembers",
]);

export type BotPermissionLabels = {
    /** The app's words for a permission: chat and community permissions, then message ones. */
    permission: (scope: Scope, name: string) => string;
    /** The heading a permission is listed under. */
    group: (use: Use, scope: Scope) => string;
};

function key(use: Use, scope: Scope, name: string): string {
    return `${use}:${scope}:${name}`;
}

function* entries(granted: GrantedBotPermissions): Generator<[Use, Scope, string]> {
    for (const use of ["command", "autonomous"] as const) {
        const perms = granted[use];
        if (perms === undefined) continue;
        for (const scope of ["chat", "community", "message"] as const) {
            for (const name of perms[LISTS[scope]]) yield [use, scope, name];
        }
    }
}

/** The keys of a set of permissions, all on: what an installed bot has now. */
export function grantedKeys(granted: GrantedBotPermissions): Record<string, boolean> {
    return Object.fromEntries([...entries(granted)].map(([u, s, n]) => [key(u, s, n), true]));
}

/**
 * What the bot asks for here (its commands' and its autonomous permissions; community permissions
 * only in a community), as BotDialog's `perms` and `permissions`.
 */
export function botPermissions(
    definition: AppBotDefinition,
    location: BotInstallationLocation,
    labels: BotPermissionLabels,
): { perms: string[]; permissions: BotPermissionInfo[] } {
    const permissions = [...entries(permissionsToGrant(definition, location))].map(
        ([use, scope, name]): BotPermissionInfo => ({
            key: key(use, scope, name),
            label: labels.permission(scope, name),
            group: labels.group(use, scope),
            risky: RISKY.has(name),
        }),
    );
    return { perms: permissions.map((p) => p.key), permissions };
}

/** A command's permissions, as the keys BotDialog greys it out by. */
export function commandNeeds(permissions: ExternalBotPermissions): string[] {
    return [...entries({ command: permissions, autonomous: undefined })].map(([u, s, n]) =>
        key(u, s, n),
    );
}

/**
 * The permissions to grant from BotDialog's toggles: exactly those of the bot's requested ones
 * (`requested`) that are on. A bot with no autonomous permissions gets none.
 */
export function grantedFromDialog(
    toggles: Record<string, boolean>,
    requested: GrantedBotPermissions,
): GrantedBotPermissions {
    const pick = (use: Use, perms: ExternalBotPermissions): ExternalBotPermissions => ({
        chatPermissions: perms.chatPermissions.filter((n) => toggles[key(use, "chat", n)]),
        communityPermissions: perms.communityPermissions.filter(
            (n) => toggles[key(use, "community", n)],
        ),
        messagePermissions: perms.messagePermissions.filter((n) => toggles[key(use, "message", n)]),
    });
    return {
        command: pick("command", requested.command),
        autonomous:
            requested.autonomous === undefined
                ? undefined
                : pick("autonomous", requested.autonomous),
    };
}
