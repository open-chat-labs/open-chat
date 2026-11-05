import { describe, expect, test } from "vitest";
import { chatOnScreen, type PushNotification } from "./push_notification";

const dm: PushNotification = { id: 1, type: "DM", senderId: "alice" };
const group: PushNotification = { id: 2, type: "GROUP", groupId: "g1", threadIndex: 4 };
const channel: PushNotification = { id: 3, type: "CHANNEL", communityId: "c1", channelId: 7 };

describe("#10398 invariant 15: a push for the chat on screen is not shown in the foreground", () => {
    test("the chat on screen, or one of its threads, hides the push", () => {
        expect(chatOnScreen(dm, "/user/alice")).toBe(true);
        expect(chatOnScreen(group, "/group/g1")).toBe(true);
        expect(chatOnScreen(group, "/group/g1/4")).toBe(true);
        expect(chatOnScreen(channel, "/community/c1/channel/7")).toBe(true);
    });

    test("any other screen shows it", () => {
        expect(chatOnScreen(dm, "/user/bob")).toBe(false);
        expect(chatOnScreen(dm, "/group/alice")).toBe(false);
        expect(chatOnScreen(group, "/group/g2")).toBe(false);
        expect(chatOnScreen(channel, "/community/c1/channel/8")).toBe(false);
        // A chat whose id starts with the push's chat's id
        expect(chatOnScreen(channel, "/community/c1/channel/70")).toBe(false);
        expect(chatOnScreen(channel, "/")).toBe(false);
    });
});
