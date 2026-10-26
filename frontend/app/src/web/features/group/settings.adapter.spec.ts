import {
    defaultChatPermissions,
    defaultChatRules,
    communityChanges,
    groupChanges,
    ROLE_ADMIN,
    ROLE_MODERATOR,
    ROLE_OWNER,
    ROLE_MEMBER,
    type CandidateGroupChat,
    type CommunityAndRules,
    type CommunitySummary,
} from "@client";
import { durationMs } from "@openchat/ui/src/features/components/GroupSettingsDialog.svelte";
import type { CreateGroupResult, GroupSettings } from "@openchat/ui/src/lib/types";
import { describe, expect, test } from "vitest";
import type { GateLookups } from "../access/gates.adapter";
import {
    candidateCommunityFromSettings,
    candidateFromCreate,
    candidateFromSettings,
    communitySettings,
    groupSettings,
} from "./settings.adapter";

const lookups: GateLookups = { tokens: new Map(), nervousSystems: new Map() };

function group(overrides: Partial<CandidateGroupChat> = {}): CandidateGroupChat {
    return {
        id: { kind: "group_chat", groupId: "g" },
        kind: "candidate_group_chat",
        name: "Hikers",
        description: "Walks at the weekend",
        historyVisible: true,
        public: false,
        frozen: false,
        members: [],
        permissions: {
            ...defaultChatPermissions(),
            tipMessages: ROLE_MODERATOR,
            messagePermissions: { default: ROLE_MODERATOR, poll: ROLE_ADMIN },
            threadPermissions: { default: ROLE_OWNER, memeFighter: ROLE_ADMIN },
        },
        rules: { enabled: true, text: "Be kind", version: 2, newVersion: false },
        avatar: { blobUrl: "blob:avatar", blobReference: undefined, blobData: undefined },
        gateConfig: { gate: { kind: "no_gate" }, expiry: undefined },
        level: "group",
        membership: { role: ROLE_OWNER },
        // set by the old editors, and none of the dialog's durations
        eventsTTL: 7_200_000n,
        messagesVisibleToNonMembers: false,
        verified: false,
        ...overrides,
    } as CandidateGroupChat;
}

// What GroupSettingsDialog's Save hands back for a value it was opened with and not changed: it
// works out `afterMs` from the duration label, and only offers a new rules version for new rules
function savedUnchanged(value: GroupSettings): GroupSettings {
    const { settings } = value;
    return {
        ...value,
        settings: {
            ...settings,
            afterMs: settings.disappearOn ? durationMs(settings.after) : null,
        },
        // rules switched off are saved without their text, and switched on, trimmed
        rules: {
            enabled: value.rules.enabled,
            text: value.rules.enabled ? value.rules.text.trim() : "",
            newVersion: false,
        },
    };
}

describe("group settings adapter", () => {
    // 4b invariant 6: opening Manage and saving without changes sends nothing
    test("a group opened in the dialog and saved unchanged has no changes", () => {
        for (const original of [
            group(),
            group({ eventsTTL: undefined, permissions: defaultChatPermissions() }),
            group({ avatar: undefined, public: true }),
            // the default rules come switched off with their text
            group({ rules: { ...defaultChatRules("group"), newVersion: false } }),
            group({ rules: { enabled: true, text: "Be kind\n", newVersion: false } }),
        ]) {
            const saved = savedUnchanged(groupSettings(original, lookups));
            const candidate = candidateFromSettings(saved, original, lookups);
            expect(groupChanges(original, candidate)).toEqual({});
        }
    });

    test("an edit in the dialog is the only change sent", () => {
        const original = group();
        const saved = savedUnchanged(groupSettings(original, lookups));
        saved.info.name = "Ramblers";
        saved.permissions.general.pin = "member";

        const changes = groupChanges(original, candidateFromSettings(saved, original, lookups));

        expect(changes.name).toBe("Ramblers");
        expect(changes.permissions?.pinMessages).toBe(1);
        expect(Object.keys(changes).sort()).toEqual(["name", "permissions"]);
    });
});

function community(
    overrides: Partial<CommunitySummary> = {},
    rules = { ...defaultChatRules("community"), newVersion: false },
): CommunityAndRules {
    return {
        community: {
            kind: "community",
            id: { kind: "community", communityId: "c" },
            name: "Walkers",
            description: "All the walking groups",
            public: true,
            verified: false,
            frozen: false,
            avatar: { blobUrl: "blob:avatar" },
            banner: { blobUrl: "blob:banner" },
            gateConfig: { gate: { kind: "no_gate" }, expiry: undefined },
            permissions: {
                changeRoles: ROLE_OWNER,
                updateDetails: ROLE_ADMIN,
                inviteUsers: ROLE_MEMBER,
                removeMembers: ROLE_ADMIN,
                createPublicChannel: ROLE_ADMIN,
                createPrivateChannel: ROLE_MEMBER,
                manageUserGroups: ROLE_ADMIN,
            },
            primaryLanguage: "en",
            membership: { role: ROLE_OWNER },
            level: "community",
            ...overrides,
        } as CommunitySummary,
        rules,
    };
}

describe("community settings adapter", () => {
    // 4b invariant 6, for a community
    test("a community opened in the dialog and saved unchanged has no changes", () => {
        for (const original of [
            community(),
            community({ avatar: {}, banner: {}, public: false }),
            community({}, { enabled: true, text: "Be kind\n", version: 1, newVersion: false }),
        ]) {
            const saved = savedUnchanged(communitySettings(original, lookups));
            const candidate = candidateCommunityFromSettings(saved, original, lookups);
            expect(communityChanges(original, candidate)).toEqual({});
        }
    });

    // each of the dialog's rows is the community permission it says
    test("shows each community permission on its own row", () => {
        expect(communitySettings(community(), lookups).permissions.general).toEqual({
            roles: "owner",
            edit: "admin",
            invite: "member",
            remove: "admin",
            pubChannels: "admin",
            privChannels: "member",
            userGroups: "admin",
        });
    });

    test("an edit in the dialog is the only change sent", () => {
        const original = community();
        const saved = savedUnchanged(communitySettings(original, lookups));
        saved.info.about = "Walking, mostly";
        saved.permissions.general.invite = "admin";

        const changes = communityChanges(
            original,
            candidateCommunityFromSettings(saved, original, lookups),
        );

        expect(changes.description).toBe("Walking, mostly");
        expect(changes.permissions?.inviteUsers).toBe(ROLE_ADMIN);
        expect(Object.keys(changes).sort()).toEqual(["description", "permissions"]);
    });
});

describe("a channel created from CreateGroupDialog", () => {
    const blank = group({
        id: { kind: "channel", communityId: "c", channelId: 0 },
        name: "",
        description: "",
        public: false,
        eventsTTL: undefined,
        avatar: undefined,
        permissions: defaultChatPermissions(),
        rules: { ...defaultChatRules("channel"), newVersion: false },
        level: "channel",
    } as Partial<CandidateGroupChat>);

    const result = (overrides: Partial<CreateGroupResult> = {}): CreateGroupResult => ({
        name: "Weekend walks",
        about: "Where we meet",
        color: "teal",
        coverKey: "plum",
        avatarFile: null,
        kind: "channel",
        embedded: false,
        language: null,
        coverFile: null,
        channels: [],
        url: "",
        previewForNonMembers: false,
        isPublic: true,
        visibleHistory: true,
        disappearAfter: "1 week",
        disappearAfterMs: 604_800_000,
        members: [],
        invites: [],
        gates: { count: 0 },
        rules: { enabled: true, text: "Be kind" },
        permissions: {
            ...groupSettings(blank, lookups).permissions,
            general: { ...groupSettings(blank, lookups).permissions.general, pin: "member" },
        },
        ...overrides,
    });

    // what's sent for a new channel: everything the dialog set, the name as typed
    test("sends the dialog's settings, with the name as typed", () => {
        const channel = candidateFromCreate(result(), blank, lookups);

        expect(channel).toMatchObject({
            id: blank.id,
            name: "Weekend walks",
            description: "Where we meet",
            public: true,
            historyVisible: true,
            eventsTTL: 604_800_000n,
            rules: { enabled: true, text: "Be kind" },
            gateConfig: blank.gateConfig,
        });
        expect(channel.permissions.pinMessages).toBe(ROLE_MEMBER);
        expect(channel.externalUrl).toBeUndefined();
    });

    test("an embedded channel keeps its URL", () => {
        const channel = candidateFromCreate(
            result({ kind: "embedded", embedded: true, url: "https://example.com" }),
            blank,
            lookups,
        );
        expect(channel.externalUrl).toBe("https://example.com");
    });
});
