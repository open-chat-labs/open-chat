import { describe, expect, test } from "vitest";
import { chipName, linkTabView, sendLabel, sentToast } from "./invite.adapter";

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

    // some went and some didn't: both said, not just the failure
    test("where some weren't sent, the toast says who went and then why the rest didn't", () => {
        expect(sentToast(["Sofia"], [], t, "Couldn't invite")).toBe(
            "native.invite.addedOne(Sofia) · Couldn't invite",
        );
    });

    test("the link tab: loading, a failed load to retry, off, or the link", () => {
        const enabled = { kind: "loaded", link: { kind: "enabled", code: "1" } } as const;
        const url = "https://oc.app/group/x/?code=1";
        expect(linkTabView({ kind: "idle" }, false, undefined)).toEqual({ kind: "loading" });
        expect(linkTabView({ kind: "loading" }, false, undefined)).toEqual({ kind: "loading" });
        // not a spinner for good
        expect(linkTabView({ kind: "failed" }, false, undefined)).toEqual({ kind: "failed" });
        expect(linkTabView(enabled, true, undefined)).toEqual({ kind: "loading" });
        expect(
            linkTabView({ kind: "loaded", link: { kind: "disabled" } }, false, undefined),
        ).toEqual({ kind: "off" });
        expect(linkTabView(enabled, true, url)).toEqual({ kind: "link", url, gatesIgnored: true });
    });

    // only a private chat's invite code lets people skip the gates: a public chat's link is plain
    test("the gates footnote is for a private chat's link, not a public chat's", () => {
        const url = "https://oc.app/group/x";
        expect(linkTabView({ kind: "loaded", link: { kind: "public" } }, true, url)).toEqual({
            kind: "link",
            url,
            gatesIgnored: false,
        });
    });

    test("a chip shows the first name, else the username", () => {
        expect(chipName("Sofia Marín", "sofia")).toBe("Sofia");
        expect(chipName("  ", "sofia")).toBe("sofia");
    });
});
