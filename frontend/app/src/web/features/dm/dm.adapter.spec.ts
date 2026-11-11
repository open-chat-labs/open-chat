import type { PublicProfile } from "@client";
import { describe, expect, test } from "vitest";
import { senderColor } from "@src/logic/conversation/messageRow";
import { dmPanelProps, type DmPanelInput } from "./dm.adapter";

const input: DmPanelInput = {
    name: "Alice",
    userId: "alice-id",
    profile: { username: "alice", bio: "", created: 0n } as PublicProfile,
    avatarUrl: "/a.png",
    online: false,
    joined: "Oct 2026",
    chit: { streak: 1, earned: 500 },
    eventsTTL: undefined,
    muted: false,
    favourite: false,
    blocked: false,
};

describe("the DM panel adapter", () => {
    // 4a invariant 4: no CHIT when the viewer has turned it off
    test("leaves out CHIT earned when the viewer turned CHIT off", () => {
        expect(dmPanelProps(input).chit).toBe("500");
        expect(dmPanelProps({ ...input, chit: undefined }).chit).toBeUndefined();
    });

    // native plan 10's default, the one the native details start at too (ttlDurationId)
    test("disappearing messages that are off start at a day when turned on", () => {
        expect(dmPanelProps(input)).toMatchObject({ disappearOn: false, disappearAfter: "1 day" });
        expect(dmPanelProps({ ...input, eventsTTL: 3_600_000n })).toMatchObject({
            disappearOn: true,
            disappearAfter: "1 hour",
        });
    });

    test("shows their own picture, else their swatch", () => {
        expect(dmPanelProps(input).avatar).toBe('url("/a.png") center / cover no-repeat');
        const without = dmPanelProps({ ...input, avatarUrl: undefined });
        expect(without.avatar).toBeUndefined();
        expect(without.color).toBe(senderColor("alice-id"));
    });
});
