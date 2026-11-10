import { describe, expect, test } from "vitest";
import { chipName, sendLabel, sentToast } from "./invite.adapter";

const t = (key: string, values?: Record<string, string | number>) =>
    values === undefined ? key : `${key}(${Object.values(values).join(",")})`;

describe("the Invite people screen's words", () => {
    test("the button counts the invites, or the people to add when all are added", () => {
        expect(sendLabel([], t)).toBe("native.invite.send(0)");
        expect(sendLabel([{ way: "invite", name: "Sofia" }], t)).toBe("native.invite.send(1)");
        expect(
            sendLabel(
                [
                    { way: "invite", name: "a" },
                    { way: "add", name: "b" },
                ],
                t,
            ),
        ).toBe("native.invite.send(2)");
        expect(
            sendLabel(
                [
                    { way: "add", name: "a" },
                    { way: "add", name: "b" },
                ],
                t,
            ),
        ).toBe("native.invite.add(2)");
    });

    test("the toast names one person, counts several, and says both when some were added", () => {
        expect(sentToast([], ["Sofia"], t)).toBe("native.invite.sentOne(Sofia)");
        expect(sentToast([], ["a", "b", "c"], t)).toBe("native.invite.sent(3)");
        expect(sentToast(["Sofia"], [], t)).toBe("native.invite.addedOne(Sofia)");
        expect(sentToast(["a", "b"], [], t)).toBe("native.invite.added(2)");
        expect(sentToast(["a"], ["b", "c"], t)).toBe("native.invite.sentBoth(1,2)");
    });

    test("a chip shows the first name, else the username", () => {
        expect(chipName("Sofia Marín", "sofia")).toBe("Sofia");
        expect(chipName("  ", "sofia")).toBe("sofia");
    });
});
