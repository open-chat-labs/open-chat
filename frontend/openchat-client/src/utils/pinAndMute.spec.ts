import { describe, expect, test } from "vitest";
import { muteNotificationsFailureMessage, pinChatFailureMessage } from "./pinAndMute";

const formatter = (id: string) => `<${id}>`;

describe("pinChatFailureMessage", () => {
    test("a failed pin and a failed unpin say which one failed", () => {
        expect(pinChatFailureMessage(true).key).toBe("pinChat.failed");
        expect(pinChatFailureMessage(false).key).toBe("pinChat.unpinFailed");
    });
});

describe("muteNotificationsFailureMessage", () => {
    test("a failed mute, including muting @everyone, says muted; a failed unmute says unmuted", () => {
        const operation = (mute?: boolean, everyone?: boolean) =>
            muteNotificationsFailureMessage(mute, everyone, formatter).params?.operation;
        expect(operation(true, undefined)).toBe("<muted>");
        expect(operation(undefined, true)).toBe("<muted>");
        expect(operation(false, undefined)).toBe("<unmuted>");
        expect(operation(undefined, false)).toBe("<unmuted>");
    });
});
