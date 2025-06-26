import { extractUserIdsFromMentions } from "./user.utils";
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
