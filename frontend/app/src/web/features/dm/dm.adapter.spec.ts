import type { PublicProfile } from "@client";
import { durationMs } from "@openchat/ui/src/features/components/DmChatSettings.svelte";
import { describe, expect, test } from "vitest";
import { dmPanelProps, ttlLabel, type DmPanelInput } from "./dm.adapter";

const input: DmPanelInput = {
    name: "Alice",
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

    // a TTL read into the panel and changed back must be the same length of time
    test("a chat's TTL reads as a duration the panel turns back into the same milliseconds", () => {
        for (const ms of [
            3_600_000,
            8 * 3_600_000,
            86_400_000,
            604_800_000,
            30 * 86_400_000,
            90 * 60_000,
        ]) {
            expect(durationMs(ttlLabel(BigInt(ms)))).toBe(ms);
        }
    });

    // #10112: turned on, disappearing messages start at a week
    test("disappearing messages that are off start at a week when turned on", () => {
        expect(dmPanelProps(input)).toMatchObject({ disappearOn: false, disappearAfter: "1 week" });
        expect(dmPanelProps({ ...input, eventsTTL: 3_600_000n })).toMatchObject({
            disappearOn: true,
            disappearAfter: "1 hour",
        });
    });
});
