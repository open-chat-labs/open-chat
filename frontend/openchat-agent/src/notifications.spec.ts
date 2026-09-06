import { Principal } from "@icp-sdk/core/principal";
import { TypeboxValidationError } from "@shared";
import { describe, expect, test } from "vitest";
import * as agent from "./index";
import * as entry from "./notifications";
import { serializeToMsgPack } from "./utils/msgpack";

// Characterisation: the service worker decodes push payloads through the
// notification-only entry point. It must behave exactly like decoding through
// the full agent barrel, and must still reject malformed payloads.

const sender = Principal.fromText("2vxsx-fae").toUint8Array();
const timestamp = 1_700_000_000_000n;

const payload = {
    dm: {
        s: sender,
        m: 7,
        e: 12,
        sn: "alice",
        sd: "Alice",
        ty: "Text",
        tx: "hello",
        a: 5n,
    },
};

function decode(
    mod: typeof entry,
    bytes: Uint8Array,
): ReturnType<typeof entry.notification> {
    const deserialized = mod.deserializeFromMsgPack(bytes);
    const validated = mod.typeboxValidate(deserialized, mod.Notification);
    return mod.notification(validated, timestamp);
}

describe("notification entry point", () => {
    test("exports the same functions and schema as the agent barrel", () => {
        expect(entry.deserializeFromMsgPack).toBe(agent.deserializeFromMsgPack);
        expect(entry.typeboxValidate).toBe(agent.typeboxValidate);
        expect(entry.Notification).toBe(agent.Notification);
        expect(entry.notification).toBe(agent.notification);
    });

    test("a valid payload decodes identically via either path", () => {
        const bytes = serializeToMsgPack(payload);
        const viaEntry = decode(entry, bytes);
        const viaAgent = decode(agent, bytes);
        expect(viaEntry).toEqual(viaAgent);
        expect(viaEntry).toEqual({
            kind: "direct_notification",
            chatId: { kind: "direct_chat", userId: "2vxsx-fae" },
            messageIndex: 7,
            messageEventIndex: 12,
            username: "alice",
            displayName: "Alice",
            messageType: "Text",
            messageText: "hello",
            imageUrl: undefined,
            userAvatarId: 5n,
            cryptoTransfer: undefined,
            timestamp,
        });
    });

    test("a malformed payload fails validation", () => {
        const bytes = serializeToMsgPack({ dm: { s: sender, sn: "alice" } });
        expect(() => decode(entry, bytes)).toThrow(TypeboxValidationError);
    });

    test("an unknown payload variant fails validation", () => {
        const bytes = serializeToMsgPack({ xx: { anything: true } });
        expect(() => decode(entry, bytes)).toThrow(TypeboxValidationError);
    });
});
