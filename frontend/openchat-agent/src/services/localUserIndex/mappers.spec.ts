import { Principal } from "@icp-sdk/core/principal";
import type { ChatIdentifier } from "@shared";
import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, test } from "vitest";
import { apiAccessTokenType } from "./mappers";

const GROUP = "rrkah-fqaaa-aaaaa-aaaaq-cai";
const chatId: ChatIdentifier = { kind: "group_chat", groupId: GROUP };
const groupBytes = Principal.fromText(GROUP).toUint8Array();

// #9559 invariant 17: the web layer asks the local user index for the participant token,
// which is its own variant, when it declines or leaves a call; the join token is asked for
// only to join. The bridge refuses a join token on those paths, so a wrong kind here would
// fail every decline and every native leave.
describe("access token kinds (#9559 invariant 17)", () => {
    test("video_call_participant maps to the VideoCallParticipant variant", () => {
        expect(apiAccessTokenType({ kind: "video_call_participant", chatId })).toEqual({
            VideoCallParticipant: { chat: { Group: groupBytes } },
        });
        expect(apiAccessTokenType({ kind: "join_video_call", chatId })).toEqual({
            JoinVideoCall: { chat: { Group: groupBytes } },
        });
    });

    test("the decline and leave paths ask for the participant kind, never the join kind", () => {
        const src = readFileSync(
            resolve(__dirname, "../../../../openchat-client/src/openchat.ts"),
            "utf8",
        );
        const body = (name: string) => {
            const start = src.indexOf(`    ${name}(`);
            expect(start).toBeGreaterThan(0);
            return src.slice(start, src.indexOf("\n    }\n", start));
        };
        const decline = body("declineVideoCall");
        expect(decline).toContain('kind: "video_call_participant"');
        expect(decline).not.toContain('kind: "join_video_call"');
        const teardown = body("getVideoCallTeardownToken");
        expect(teardown).toContain('kind: "video_call_participant"');
        expect(teardown).toContain('kind: "mark_video_call_ended"');
        expect(teardown).not.toContain('kind: "join_video_call"');
    });
});
