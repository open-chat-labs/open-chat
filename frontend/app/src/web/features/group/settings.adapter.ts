import {
    ROLE_ADMIN,
    ROLE_MEMBER,
    ROLE_MODERATOR,
    ROLE_NONE,
    ROLE_OWNER,
    type CandidateGroupChat,
    type ChatPermissionRole,
    type ChatPermissions,
    type CommunityAndRules,
    type CommunityPermissions,
    type DataContent,
    type MessagePermissions,
} from "@client";
import { durationMs } from "@openchat/ui/src/features/components/GroupSettingsDialog.svelte";
import type {
    AccessGatesState,
    CreateGroupResult,
    GroupRole,
    GroupSettings,
} from "@openchat/ui/src/lib/types";
import { gateConfig, gatesState, type GateLookups } from "../access/gates.adapter";

// A group or channel being edited (UpdateGroupState's candidate), or a community (UpdateCommunityState's),
// to GroupSettingsDialog's value, and the dialog's save back to a candidate. What the dialog has no place for (tips, adding members,
// the colour and cover swatches) is kept from the group as it was, so opening the dialog and saving
// without changes changes nothing (4b invariant 6).

const ROLE: Record<ChatPermissionRole, GroupRole> = {
    [ROLE_NONE]: "nobody",
    [ROLE_MEMBER]: "member",
    [ROLE_MODERATOR]: "moderator",
    [ROLE_ADMIN]: "admin",
    [ROLE_OWNER]: "owner",
};

const PERMISSION_ROLE: Record<GroupRole, ChatPermissionRole> = {
    nobody: ROLE_NONE,
    member: ROLE_MEMBER,
    moderator: ROLE_MODERATOR,
    admin: ROLE_ADMIN,
    owner: ROLE_OWNER,
};

// the dialog's general permissions, by the group's
const GENERAL = {
    roles: "changeRoles",
    edit: "updateGroup",
    invite: "inviteUsers",
    remove: "removeMembers",
    delete: "deleteMessages",
    pin: "pinMessages",
    react: "reactToMessages",
    everyone: "mentionAllMembers",
    calls: "startVideoCall",
} as const satisfies Record<string, keyof ChatPermissions>;

// the dialog's message kinds, by the group's
const CONTENT = {
    text: "text",
    image: "image",
    video: "video",
    audio: "audio",
    file: "file",
    poll: "poll",
    crypto: "crypto",
    giphy: "giphy",
    prize: "prize",
    meme: "memeFighter",
    p2p: "p2pSwap",
} as const satisfies Record<string, Exclude<keyof MessagePermissions, "default">>;

const INHERIT = "inherit";

// The dialog's durations are its TimedToggle labels ("12 hours"); any other TTL is named in the
// largest unit it divides into, which durationMs reads back to the same length.
const UNITS: [string, number][] = [
    ["week", 604_800_000],
    ["day", 86_400_000],
    ["hour", 3_600_000],
    ["minute", 60_000],
];

export function durationLabel(ms: number): string {
    for (const [unit, size] of UNITS) {
        if (ms % size === 0) {
            const n = ms / size;
            return `${n} ${unit}${n === 1 ? "" : "s"}`;
        }
    }
    return `${Math.round(ms / 60_000)} minutes`;
}

function messagesValue(perms: MessagePermissions): Record<string, GroupRole | "inherit"> {
    const value: Record<string, GroupRole | "inherit"> = { default: ROLE[perms.default] };
    for (const [key, field] of Object.entries(CONTENT)) {
        const role = perms[field];
        value[key] = role === undefined ? INHERIT : ROLE[role];
    }
    return value;
}

function messagePermissions(value: Record<string, GroupRole | "inherit">): MessagePermissions {
    const perms: MessagePermissions = {
        default: PERMISSION_ROLE[value.default as GroupRole] ?? ROLE_MEMBER,
    };
    for (const [key, field] of Object.entries(CONTENT)) {
        const role = value[key];
        if (role !== undefined && role !== INHERIT) perms[field] = PERMISSION_ROLE[role];
    }
    return perms;
}

// The dialog saves rules switched off without their text, and switched on, trimmed. The group keeps
// its text through both, as the old editors did, so only a real edit is a change.
function rulesText(saved: GroupSettings["rules"], original: string): string {
    return !saved.enabled || saved.text === original.trim() ? original : saved.text;
}

/** A group's or channel's permissions as GroupSettingsDialog and GroupPanel show them. */
export function permissionsValue(permissions: ChatPermissions): GroupSettings["permissions"] {
    const general: Record<string, GroupRole> = {};
    for (const [key, field] of Object.entries(GENERAL)) {
        general[key] = ROLE[permissions[field]];
    }
    return {
        general,
        messages: messagesValue(permissions.messagePermissions),
        threads:
            permissions.threadPermissions === undefined
                ? null
                : messagesValue(permissions.threadPermissions),
    };
}

/** GroupSettingsDialog's value for a group or channel being edited. */
export function groupSettings(candidate: CandidateGroupChat, lookups: GateLookups): GroupSettings {
    const ttl = candidate.eventsTTL === undefined ? undefined : Number(candidate.eventsTTL);
    return {
        info: {
            name: candidate.name,
            about: candidate.description,
            color: "teal",
            coverKey: "plum",
            coverUrl: null,
            avatar: candidate.avatar?.blobUrl ?? "",
        },
        settings: {
            isPublic: candidate.public,
            history: candidate.historyVisible,
            disappearOn: ttl !== undefined,
            after: ttl === undefined ? "12 hours" : durationLabel(ttl),
            afterMs: ttl ?? null,
        },
        gates: gatesState(candidate.gateConfig, lookups),
        rules: { enabled: candidate.rules.enabled, text: candidate.rules.text },
        permissions: permissionsValue(candidate.permissions),
    };
}

/**
 * The candidate GroupSettingsDialog's save makes from the group as it was (`original`). `avatar` is
 * a newly picked image, read by the caller. The dialog's empty `avatar` without one clears it here,
 * but the client can't send a removal, so the avatar stays (GAPS.md).
 */
export function candidateFromSettings(
    all: GroupSettings,
    original: CandidateGroupChat,
    lookups: GateLookups,
    avatar?: DataContent,
): CandidateGroupChat {
    const permissions: ChatPermissions = { ...original.permissions };
    for (const [key, field] of Object.entries(GENERAL)) {
        const role = all.permissions.general[key];
        if (role !== undefined) permissions[field] = PERMISSION_ROLE[role];
    }
    permissions.messagePermissions = messagePermissions(all.permissions.messages);
    permissions.threadPermissions =
        all.permissions.threads === null ? undefined : messagePermissions(all.permissions.threads);

    const ms = all.settings.disappearOn
        ? (all.settings.afterMs ?? durationMs(all.settings.after))
        : null;
    return {
        ...original,
        name: all.info.name,
        description: all.info.about,
        avatar: avatar ?? (all.info.avatar === "" ? undefined : original.avatar),
        public: all.settings.isPublic,
        historyVisible: all.settings.history,
        eventsTTL: ms === null ? undefined : BigInt(ms),
        gateConfig:
            all.gates === null
                ? original.gateConfig
                : gateConfig(all.gates, original.gateConfig, lookups),
        rules: {
            ...original.rules,
            enabled: all.rules.enabled,
            text: rulesText(all.rules, original.rules.text),
            newVersion: all.rules.newVersion ?? false,
        },
        permissions,
    };
}

/**
 * The group or channel CreateGroupDialog's create makes, from the client's blank one
 * (`createCandidateGroup`): the dialog's result read as the settings dialog's value, so a new group
 * and an edited one are made the same way (`candidateFromSettings`), plus what only creating has:
 * an embedded channel's URL and whether non-members can see its messages. `avatar` is the picked
 * photo, read by the caller.
 */
export function candidateFromCreate(
    result: CreateGroupResult,
    blank: CandidateGroupChat,
    lookups: GateLookups,
    avatar?: DataContent,
): CandidateGroupChat {
    const settings: GroupSettings = {
        info: {
            name: result.name,
            about: result.about,
            color: result.color,
            coverKey: result.coverKey,
            coverUrl: null,
            avatar: "",
        },
        settings: {
            isPublic: result.isPublic,
            history: result.visibleHistory,
            disappearOn: result.disappearAfterMs !== null,
            after: result.disappearAfter ?? "12 hours",
            afterMs: result.disappearAfterMs,
        },
        gates: result.gates.count === 0 ? null : (result.gates as AccessGatesState),
        rules: { ...result.rules, newVersion: false },
        permissions: result.permissions,
    };
    return {
        ...candidateFromSettings(settings, blank, lookups, avatar),
        externalUrl: result.embedded ? result.url : undefined,
        messagesVisibleToNonMembers: result.previewForNonMembers,
    };
}

// ── communities ──

// the dialog's community permissions, by the community's
const COMMUNITY_GENERAL = {
    roles: "changeRoles",
    edit: "updateDetails",
    invite: "inviteUsers",
    remove: "removeMembers",
    pubChannels: "createPublicChannel",
    privChannels: "createPrivateChannel",
    userGroups: "manageUserGroups",
} as const satisfies Record<string, keyof CommunityPermissions>;

/** A community's permissions as GroupSettingsDialog and GroupPanel show them (general only). */
export function communityPermissionsValue(
    permissions: CommunityPermissions,
): GroupSettings["permissions"] {
    const general: Record<string, GroupRole> = {};
    for (const [key, field] of Object.entries(COMMUNITY_GENERAL)) {
        general[key] = ROLE[permissions[field]];
    }
    return { general, messages: { default: "member" }, threads: null };
}

/** GroupSettingsDialog's value (with `noun: "community"`) for a community being edited. */
export function communitySettings(
    { community, rules }: CommunityAndRules,
    lookups: GateLookups,
): GroupSettings {
    return {
        info: {
            name: community.name,
            about: community.description,
            color: "teal",
            coverKey: "plum",
            coverUrl: community.banner.blobUrl ?? null,
            avatar: community.avatar.blobUrl ?? "",
        },
        settings: {
            isPublic: community.public,
            history: false,
            disappearOn: false,
            after: "12 hours",
            afterMs: null,
        },
        gates: gatesState(community.gateConfig, lookups),
        rules: { enabled: rules.enabled, text: rules.text },
        permissions: communityPermissionsValue(community.permissions),
    };
}

/**
 * The community GroupSettingsDialog's save makes from the community as it was (`original`).
 * `avatar` and `banner` are newly picked images, read by the caller. The dialog's empty `avatar`
 * or `coverUrl` without one clears that image here, but the client can't send a removal, so the
 * image stays (GAPS.md).
 */
export function candidateCommunityFromSettings(
    all: GroupSettings,
    original: CommunityAndRules,
    lookups: GateLookups,
    images: { avatar?: DataContent; banner?: DataContent } = {},
): CommunityAndRules {
    const { community } = original;
    const permissions: CommunityPermissions = { ...community.permissions };
    for (const [key, field] of Object.entries(COMMUNITY_GENERAL)) {
        const role = all.permissions.general[key];
        // a community's roles are member, admin and owner
        if (role === "member" || role === "admin" || role === "owner") {
            permissions[field] = PERMISSION_ROLE[role] as CommunityPermissions[typeof field];
        }
    }
    return {
        community: {
            ...community,
            name: all.info.name,
            description: all.info.about,
            avatar: images.avatar ?? (all.info.avatar === "" ? {} : community.avatar),
            banner: images.banner ?? (all.info.coverUrl === null ? {} : community.banner),
            public: all.settings.isPublic,
            gateConfig:
                all.gates === null
                    ? community.gateConfig
                    : gateConfig(all.gates, community.gateConfig, lookups),
            permissions,
        },
        rules: {
            ...original.rules,
            enabled: all.rules.enabled,
            text: rulesText(all.rules, original.rules.text),
            newVersion: all.rules.newVersion ?? false,
        },
    };
}
