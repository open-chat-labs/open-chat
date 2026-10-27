import type { UserOrUserGroup } from "./user";
import { expandTypedMentions, extractUserIdsFromMentions, typedMentions } from "./user.utils";
import { vi } from "vitest";

const now = Date.now();
vi.setSystemTime(now);

describe("extract user ids from mentions", () => {
    test("extract a single user id", () => {
        const parsed = extractUserIdsFromMentions("hello there @UserId(xyz), how are you?");
        expect(parsed).toEqual(["xyz"]);
    });
    test("extract multiple user ids", () => {
        const parsed = extractUserIdsFromMentions(
            "hello there @UserId(xyz) and hello @UserId(abc), how are you?",
        );
        expect(parsed).toEqual(["xyz", "abc"]);
    });
    test("when there are no userIds to extract", () => {
        const parsed = extractUserIdsFromMentions("this is a string that doesn't have any userIds");
        expect(parsed).toEqual([]);
    });
});

describe("mentions typed as @username", () => {
    const known: Record<string, UserOrUserGroup> = {
        alice: { kind: "user", userId: "a1", username: "alice" } as UserOrUserGroup,
        mods: { kind: "user_group", id: 7 } as UserOrUserGroup,
        everyone: { kind: "everyone" },
    };
    const lookup = (username: string) => known[username.toLowerCase()];

    test("become the mentions, listing the users", () => {
        expect(expandTypedMentions("hi @alice, @mods and @everyone", lookup)).toEqual({
            text: "hi @UserId(a1), @UserGroup(7) and @everyone",
            mentioned: [known.alice],
        });
    });

    test("leave unknown names as typed, and list a user once", () => {
        expect(expandTypedMentions("@bob @alice @alice", lookup)).toEqual({
            text: "@bob @UserId(a1) @UserId(a1)",
            mentioned: [known.alice],
        });
    });

    test("are found by username", () => {
        expect(typedMentions("hi @alice, @Bob_1 and @everyone")).toEqual([
            "alice",
            "Bob_1",
            "everyone",
        ]);
        expect(typedMentions("no mentions")).toEqual([]);
    });

    test("don't include mentions picked from the mention picker", () => {
        const picked = "@UserId(a1) and @UserGroup(7)";
        expect(typedMentions(picked)).toEqual([]);
        // even if someone's username is UserId
        const userId = { kind: "user", userId: "u2", username: "UserId" } as UserOrUserGroup;
        expect(expandTypedMentions(picked, () => userId).text).toEqual(picked);
    });
});
