import { Type } from "@sinclair/typebox";
import { describe, expect, test } from "vitest";
import { typeboxValidate } from "../../utils/typebox";

// The call schemas exactly as the website shipped them before audio calls existed (#9455).
// Frozen here on purpose: these stand in for every bundle already in a browser tab or an
// installed app. Do not update them when the generated schemas change.
const PreviousVideoCallType = Type.Union([Type.Literal("Broadcast"), Type.Literal("Default")]);
const PreviousVideoCallContent = Type.Object({
    call_type: PreviousVideoCallType,
    ended: Type.Optional(Type.BigInt()),
    participants: Type.Array(Type.Object({ user_id: Type.Uint8Array(), joined: Type.BigInt() })),
    hidden_participants: Type.Number(),
});
const PreviousVideoCall = Type.Object({
    started: Type.BigInt(),
    started_by: Type.Uint8Array(),
    event_index: Type.Number(),
    message_index: Type.Number(),
    message_id: Type.BigInt(),
    call_type: PreviousVideoCallType,
    joined_by_current_user: Type.Boolean(),
});

describe("audio calls and the website that predates them", () => {
    // #9455 invariant 5: an audio call message and an audio call in progress both decode under
    // the website's previous response schema. The website validates whole responses, so a
    // failure here would cost an old bundle the chat's events or its whole updates answer.
    test("invariant 5: an audio call message decodes under the previous schema", () => {
        const fromCanister = {
            call_type: "Default",
            audio_only: true,
            ended: undefined,
            participants: [{ user_id: new Uint8Array([1]), joined: BigInt(1) }],
            hidden_participants: 0,
        };
        expect(typeboxValidate(fromCanister, PreviousVideoCallContent)).toMatchObject({
            call_type: "Default",
        });
    });

    test("invariant 5: an audio call in progress decodes under the previous schema", () => {
        const fromCanister = {
            started: BigInt(1),
            started_by: new Uint8Array([1]),
            event_index: 1,
            message_index: 1,
            message_id: BigInt(1),
            call_type: "Default",
            audio_only: true,
            joined_by_current_user: false,
        };
        expect(typeboxValidate(fromCanister, PreviousVideoCall)).toMatchObject({
            call_type: "Default",
        });
    });

    // the reason the type did not simply gain a third value
    test("a third call type would not have decoded", () => {
        expect(() =>
            typeboxValidate(
                { call_type: "Audio", participants: [], hidden_participants: 0 },
                PreviousVideoCallContent,
            ),
        ).toThrow();
    });
});
