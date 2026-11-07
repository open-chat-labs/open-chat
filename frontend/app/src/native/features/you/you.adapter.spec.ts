import {
    AuthProvider,
    type DiamondMembershipStatus,
    type LinkedAuthenticationPrincipal,
} from "@client";
import { describe, expect, test } from "vitest";
import {
    diamondAction,
    displayNameNote,
    isDiamond,
    profileUsernameNote,
    signInMethodRows,
    storageFraction,
    youLists,
    type YouListInputs,
} from "./you.adapter";

const t = (key: string) => key;

function inputs(extra: Partial<YouListInputs> = {}): YouListInputs {
    return {
        diamond: { kind: "inactive" },
        chitOn: true,
        theme: "system",
        accent: "pink",
        notifications: { kind: "switch", on: true },
        storage: { bytesUsed: 0, byteLimit: 0 },
        ...extra,
    };
}

function value(lists: ReturnType<typeof youLists>, id: string): string | undefined {
    return [...lists.account, ...lists.settings].find((r) => r.id === id)?.value;
}

describe("the You tab's lists", () => {
    test("are Edit profile and Diamond, then the settings pages in the design's order", () => {
        const lists = youLists(inputs(), t);
        expect(lists.account.map((r) => r.id)).toEqual(["edit_profile", "diamond"]);
        expect(lists.settings.map((r) => r.id)).toEqual([
            "chit",
            "chats",
            "communities",
            "appearance",
            "notifications",
            "storage",
            "bots",
            "account",
        ]);
    });

    test("say what's off: CHIT, and notifications that aren't on", () => {
        const on = youLists(inputs(), t);
        expect(value(on, "chit")).toBe("");
        expect(value(on, "notifications")).toBe("");
        const off = youLists(
            inputs({ chitOn: false, notifications: { kind: "switch", on: false } }),
            t,
        );
        expect(value(off, "chit")).toBe("native.you.off");
        expect(value(off, "notifications")).toBe("native.you.off");
        const blocked = youLists(inputs({ notifications: { kind: "blocked" } }), t);
        expect(value(blocked, "notifications")).toBe("native.you.off");
    });

    test("say nothing about notifications without web push, as in the apps", () => {
        const app = youLists(inputs({ notifications: { kind: "unsupported" } }), t);
        expect(value(app, "notifications")).toBe("");
    });

    test("show the theme and accent, Diamond's kind, and the storage used", () => {
        const lists = youLists(
            inputs({
                theme: "dark",
                accent: "blue",
                diamond: { kind: "lifetime" },
                storage: { bytesUsed: 1536, byteLimit: 0 },
            }),
            t,
        );
        expect(value(lists, "appearance")).toBe(
            "native.start.appearance.dark · native.start.appearance.accents.blue",
        );
        expect(value(lists, "diamond")).toBe("native.you.diamond.lifetime");
        expect(value(lists, "storage")).toBe("1.5 KB");
    });

    // the rows showed nothing without Diamond or anything stored
    test("say there's no Diamond, and show the storage used, of the allowance when there's one", () => {
        expect(value(youLists(inputs(), t), "diamond")).toBe("native.you.diamond.none");
        expect(value(youLists(inputs(), t), "storage")).toBe("0 Bytes");
        const allowance = youLists(
            inputs({ storage: { bytesUsed: 3 * 1024 * 1024, byteLimit: 1024 * 1024 * 1024 } }),
            (key, values) => `${key} ${JSON.stringify(values ?? {})}`,
        );
        expect(value(allowance, "storage")).toBe(
            'native.you.storage.ofLimit {"used":"3.0 MB","limit":"1.0 GB"}',
        );
    });
});

describe("the Diamond screen's button", () => {
    test("upgrades without Diamond, extends a membership that ends", () => {
        expect(diamondAction({ kind: "inactive" }, false)).toBe("upgrade");
        const active: DiamondMembershipStatus = {
            kind: "active",
            payInChat: false,
            subscription: "disabled",
            expiresAt: 1n,
        };
        expect(diamondAction(active, false)).toBe("extend");
    });

    test("isn't there for a lifetime member, or where Diamond can't be paid for", () => {
        expect(diamondAction({ kind: "lifetime" }, false)).toBeUndefined();
        expect(diamondAction({ kind: "inactive" }, true)).toBeUndefined();
    });
});

describe("Diamond and storage", () => {
    test("a member is active or lifetime", () => {
        expect(isDiamond({ kind: "inactive" })).toBe(false);
        expect(isDiamond({ kind: "lifetime" })).toBe(true);
    });

    test("storage used is a fraction of the allowance, none without one", () => {
        expect(storageFraction(25, 100)).toBe(0.25);
        expect(storageFraction(200, 100)).toBe(1);
        expect(storageFraction(25, 0)).toBe(0);
    });
});

describe("Edit profile's notes", () => {
    test("the saved username says what it's for; a change is checked as at sign-up", () => {
        expect(profileUsernameNote("unchanged", "kai", undefined).key).toBe(
            "native.you.editProfile.usernameHint",
        );
        expect(profileUsernameNote("taken", "kai", undefined)).toMatchObject({
            key: "native.start.signUp.taken",
            tone: "warn",
        });
        expect(profileUsernameNote("available", "kai", undefined).tone).toBe("ok");
    });

    test("what the backend turned down shows instead", () => {
        expect(profileUsernameNote("available", "kai", "register.usernameTaken")).toEqual({
            key: "register.usernameTaken",
            tone: "warn",
        });
        expect(displayNameNote(true, "register.displayNameInvalid").tone).toBe("warn");
    });

    test("a display name that can't be saved says the rules", () => {
        expect(displayNameNote(true, undefined).tone).toBe("hint");
        expect(displayNameNote(false, undefined)).toEqual({
            key: "native.you.editProfile.nameRules",
            tone: "warn",
        });
    });
});

describe("the sign-in methods", () => {
    const principal = (
        provider: AuthProvider,
        extra: Partial<LinkedAuthenticationPrincipal> = {},
    ): LinkedAuthenticationPrincipal =>
        ({
            principal: `p-${provider}`,
            provider,
            isCurrentIdentity: false,
            ...extra,
        }) as LinkedAuthenticationPrincipal;

    test("name a passkey by its provider, and say which is this session's", () => {
        const rows = signInMethodRows(
            [
                principal(AuthProvider.PASSKEY, {
                    passkeyProvider: "iCloud Keychain",
                    isCurrentIdentity: true,
                }),
                principal(AuthProvider.II, { lastUsed: 5n }),
                principal(AuthProvider.EMAIL),
            ],
            t,
            (lastUsed) => `used ${lastUsed}`,
        );
        expect(rows.map((r) => [r.label, r.value])).toEqual([
            ["iCloud Keychain", "native.you.account.thisSession"],
            ["native.you.account.ii", "used 5"],
            ["native.you.account.email", ""],
        ]);
    });
});
