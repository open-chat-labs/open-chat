import {
    OPENCHAT_BOT_AVATAR_URL,
    ROLE_ADMIN,
    ROLE_MEMBER,
    ROLE_OWNER,
    type CommunitySummary,
    type FullMember,
    type GroupAvatarLookups,
    type MemberActions,
    type MultiUserChat,
    type UserLookup,
    type UserSummary,
} from "@client";
import { describe, expect, test } from "vitest";
import {
    collectionAvatarUrl,
    memberPerson,
    panelHeader,
    userGroupDialogGroup,
    userPerson,
} from "./group.adapter";

const noActions: MemberActions = {
    canPromoteToOwner: false,
    canPromoteToAdmin: false,
    canDemoteToAdmin: false,
    canPromoteToModerator: false,
    canDemoteToModerator: false,
    canDemoteToMember: false,
    canRemoveMember: false,
    canBlockUser: false,
};

describe("the group panel adapter", () => {
    // 4a invariant 5: member counts come from the summary's memberCount, not the members held
    test("the member count is the summary's", () => {
        // a large group's summary, which holds only its first page of members
        const summary = {
            name: "Big group",
            public: true,
            memberCount: 12_345,
            membership: { role: ROLE_MEMBER },
        } as MultiUserChat;
        expect(panelHeader(summary, "", undefined).memberTotal).toBe(12_345);
    });

    // 4a invariant 2: a member's row offers the roles memberActions allows, and nothing more
    test("a member's row carries exactly the actions it was given", () => {
        const member = { userId: "u", username: "alice", role: ROLE_MEMBER } as FullMember;
        const person = memberPerson(member, "me", {
            ...noActions,
            canPromoteToAdmin: true,
            canPromoteToOwner: true,
            canPromoteToModerator: true,
            canRemoveMember: true,
        });
        expect(person.actions).toEqual({
            roles: ["OWNER", "ADMIN", "MODERATOR"],
            remove: true,
            block: false,
        });
        expect(memberPerson(member, "me", noActions).actions).toEqual({
            roles: [],
            remove: false,
            block: false,
        });
        expect(
            memberPerson({ ...member, role: ROLE_OWNER } as FullMember, "me", noActions).tag,
        ).toBe("OWNER");
        expect(
            memberPerson(
                { ...member, role: ROLE_ADMIN, userId: "me" } as FullMember,
                "me",
                noActions,
            ).tag,
        ).toBe("YOU");
    });
});

describe("the user group dialog adapter", () => {
    // 4b invariant 5: the dialog saves the members it shows, so one whose user isn't held yet must
    // still be among them or the save would remove them
    test("the dialog's group has every member, held user or not", () => {
        const users: UserLookup = new Map([
            ["a", { userId: "a", username: "alice" } as UserSummary],
        ]);
        const group = userGroupDialogGroup(
            { kind: "user_group", id: 3, name: "devs", members: new Set(["a", "b"]) },
            users,
        );

        expect(group.members.map((m) => m.userId)).toEqual(["a", "b"]);
    });

    test("a member's row has their own picture, and none (their colour) without one", () => {
        const member = (blobUrl?: string) =>
            ({ userId: "u", username: "alice", role: ROLE_MEMBER, blobUrl }) as FullMember;
        expect(memberPerson(member("https://blobs/u"), "me", noActions).image).toBe(
            "https://blobs/u",
        );
        // the client's generated identicon isn't a picture of their own
        expect(
            memberPerson(member("data:image/svg+xml;base64,PHN2Zz4="), "me", noActions).image,
        ).toBeUndefined();
        expect(memberPerson(member(), "me", noActions).image).toBeUndefined();
        expect(
            userPerson(
                { userId: "b", username: "bot", blobUrl: OPENCHAT_BOT_AVATAR_URL } as UserSummary,
                "BLOCKED",
            ).image,
        ).toBe(OPENCHAT_BOT_AVATAR_URL);
    });

    test("a group's, channel's or community's own picture, none without one", () => {
        const lookups: GroupAvatarLookups = {
            snsLogo: () => undefined,
            communityAvatar: () => "https://blobs/community",
        };
        const community = (blobUrl?: string) =>
            ({ kind: "community", avatar: { blobUrl } }) as CommunitySummary;
        expect(collectionAvatarUrl(community("https://blobs/c"), lookups)).toBe("https://blobs/c");
        expect(collectionAvatarUrl(community(), lookups)).toBeUndefined();
        const group = {
            kind: "group_chat",
            id: { kind: "group_chat", groupId: "g" },
        } as MultiUserChat;
        expect(collectionAvatarUrl(group, lookups)).toBeUndefined();
        expect(collectionAvatarUrl({ ...group, blobUrl: "https://blobs/g" }, lookups)).toBe(
            "https://blobs/g",
        );
        const channel = {
            kind: "channel",
            id: { kind: "channel", communityId: "c", channelId: 1 },
        } as MultiUserChat;
        expect(collectionAvatarUrl(channel, lookups)).toBe("https://blobs/community");
    });
});
