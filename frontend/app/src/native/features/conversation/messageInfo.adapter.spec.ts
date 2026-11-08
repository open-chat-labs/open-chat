import { infoStatus, reactionRows } from "./messageInfo.adapter";

describe("a message's info", () => {
    test("the double tick is read; a plain tick is sent", () => {
        expect(infoStatus("delivered")).toBe("native.conversation.info.read");
        expect(infoStatus("sent")).toBe("native.conversation.info.sent");
        expect(infoStatus("sending")).toBe("native.conversation.info.sending");
        expect(infoStatus("failed")).toBe("native.conversation.info.failed");
    });

    test("a row for each reaction of each person, the reader's own first, then by name", () => {
        const names: Record<string, string> = { me: "You", a: "Zoe", b: "Ann" };
        const rows = reactionRows(
            [
                { reaction: "👍", userIds: new Set(["a", "me", "b"]) },
                { reaction: "😂", userIds: new Set(["a"]) },
            ],
            "me",
            (userId) => names[userId],
        );
        expect(rows.map((r) => `${r.emoji} ${r.name}`)).toEqual([
            "👍 You",
            "👍 Ann",
            "👍 Zoe",
            "😂 Zoe",
        ]);
    });
});
