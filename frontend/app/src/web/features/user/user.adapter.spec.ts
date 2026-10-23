import type { PublicProfile } from "@client";
import { describe, expect, test } from "vitest";
import { userDialogProps, type UserDialogInput } from "./user.adapter";

const input: UserDialogInput = {
    name: "Alice",
    profile: { username: "alice", bio: "hi", created: 0n } as PublicProfile,
    avatarUrl: "/a.png",
    coverUrl: undefined,
    online: false,
    joined: "1 Nov 2021",
    chit: { streak: 3, earned: 1000 },
};

describe("userDialogProps", () => {
    // 4a invariant 4: the user adapter never marks a user verified, and shows no CHIT when it's off
    test("never marks the user verified, and leaves out CHIT earned when the viewer turned CHIT off", () => {
        expect(userDialogProps(input).verified).toBe(false);
        expect(userDialogProps(input).facts.map((f) => f.label)).toContain("ui.dmPanel.chitEarned");
        expect(
            userDialogProps({ ...input, chit: undefined }).facts.map((f) => f.label),
        ).not.toContain("ui.dmPanel.chitEarned");
    });
});
