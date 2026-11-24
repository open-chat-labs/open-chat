import {
    ROLE_ADMIN,
    ROLE_MEMBER,
    ROLE_OWNER,
    type CommunityPermissions,
    type CommunitySummary,
} from "@client";
import { MAX_DESC_LENGTH } from "@src/logic/groupOrCommunity/community.svelte";
import { createCandidateCommunity, defaultCommunityPermissions } from "@src/stores/community";
import { describe, expect, test } from "vitest";
import {
    changedCommunityPermissions,
    communityDraftSavable,
    communityNameValid,
    communityPageTitle,
    communityPermissionRows,
    communityRoleId,
    communityRoleOf,
    communityRoleOptions,
    communitySettingsReady,
} from "./communitySettings.adapter";

const t = (key: string, values?: Record<string, string | number>) =>
    values === undefined ? key : `${key} ${JSON.stringify(values)}`;

function community(overrides: Partial<CommunitySummary> = {}): CommunitySummary {
    return { ...createCandidateCommunity("c1", 0), name: "Book club", ...overrides };
}

describe("community settings pages", () => {
    test("each page's title", () => {
        expect(communityPageTitle("edit", t)).toBe("native.communitySettings.edit");
        expect(communityPageTitle("invite", t)).toBe("native.community.manage.invite");
        expect(communityPageTitle("user_groups", t)).toBe("native.community.manage.userGroups");
        expect(communityPageTitle("gates", t)).toBe("native.details.manage.gates");
        expect(communityPageTitle("permissions", t)).toBe("native.details.manage.permissions");
    });

    test("a page waits for the community, and Rules for its rules too", () => {
        const rules = { enabled: true, text: "Be kind", version: 1 };
        expect(communitySettingsReady("edit", undefined, rules)).toBe(false);
        expect(communitySettingsReady("edit", community(), undefined)).toBe(true);
        expect(communitySettingsReady("rules", community(), undefined)).toBe(false);
        expect(communitySettingsReady("rules", community(), rules)).toBe(true);
    });
});

describe("Edit community's checks", () => {
    test("the name is 3 to 25 characters, trimmed", () => {
        expect(communityNameValid("ab")).toBe(false);
        expect(communityNameValid("  ab  ")).toBe(false);
        expect(communityNameValid("abc")).toBe(true);
        expect(communityNameValid("a".repeat(25))).toBe(true);
        expect(communityNameValid("a".repeat(26))).toBe(false);
    });

    test("saving needs the editor's checks, the name trimmed and a description that fits", () => {
        expect(communityDraftSavable(community(), true)).toBe(true);
        expect(communityDraftSavable(community(), false)).toBe(false);
        expect(communityDraftSavable(community({ name: " ab " }), true)).toBe(false);
        expect(
            communityDraftSavable(community({ description: "a".repeat(MAX_DESC_LENGTH + 1) }), true),
        ).toBe(false);
    });
});

describe("a community's permissions", () => {
    test("the roles are owners, admins and everyone", () => {
        expect(communityRoleOptions(t).map((o) => o.id)).toEqual(["owner", "admin", "member"]);
        expect(communityRoleId(ROLE_MEMBER)).toBe("member");
        expect(communityRoleOf("owner")).toBe(ROLE_OWNER);
        expect(communityRoleOf("moderator")).toBeUndefined();
        expect(communityRoleOf("none")).toBeUndefined();
    });

    test("each card's rows, marked where they're not the default", () => {
        const permissions: CommunityPermissions = {
            ...defaultCommunityPermissions(),
            inviteUsers: ROLE_MEMBER,
        };
        expect(communityPermissionRows(permissions, "members", t)).toEqual([
            {
                key: "changeRoles",
                label: "native.communitySettings.permissions.perm.changeRoles",
                value: "admin",
                changed: false,
            },
            {
                key: "updateDetails",
                label: "native.communitySettings.permissions.perm.updateDetails",
                value: "admin",
                changed: false,
            },
            {
                key: "inviteUsers",
                label: "native.communitySettings.permissions.perm.inviteUsers",
                value: "member",
                changed: true,
            },
            {
                key: "removeMembers",
                label: "native.communitySettings.permissions.perm.removeMembers",
                value: "admin",
                changed: false,
            },
        ]);
        expect(communityPermissionRows(permissions, "channels", t).map((r) => r.key)).toEqual([
            "createPublicChannel",
            "createPrivateChannel",
            "manageUserGroups",
        ]);
    });

    test("how many differ from the defaults", () => {
        expect(changedCommunityPermissions(defaultCommunityPermissions())).toBe(0);
        const permissions: CommunityPermissions = {
            ...defaultCommunityPermissions(),
            createPublicChannel: ROLE_MEMBER,
            manageUserGroups: ROLE_OWNER,
            changeRoles: ROLE_ADMIN,
        };
        expect(changedCommunityPermissions(permissions)).toBe(2);
    });
});
