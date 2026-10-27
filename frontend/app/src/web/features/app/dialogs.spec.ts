import {
    builtDialogScreens,
    dialogs,
    linkedDialog,
    linkedDialogParam,
    openLinkedDialog,
    shareQuery,
    shownLinkedDialog,
} from "./dialogs";

describe("the dialog a URL's query opens", () => {
    test("is the one its param names", () => {
        expect(linkedDialog(new URLSearchParams("profile"))).toEqual({ kind: "profile" });
        expect(linkedDialog(new URLSearchParams("diamond"))).toEqual({ kind: "diamond" });
        expect(linkedDialog(new URLSearchParams("chit"))).toEqual({ kind: "chit" });
        expect(linkedDialog(new URLSearchParams("hof"))).toEqual({ kind: "leaderboard" });
    });

    test("is the profile on a section it names, if it's one a link can open", () => {
        expect(linkedDialog(new URLSearchParams("profile=chit"))).toEqual({
            kind: "profile",
            section: "chit",
        });
        expect(linkedDialog(new URLSearchParams("profile=nope"))).toEqual({ kind: "profile" });
    });

    test("is one of the CHIT dialog's views its value names", () => {
        expect(linkedDialog(new URLSearchParams("chit=earn"))).toEqual({ kind: "achievements" });
        expect(linkedDialog(new URLSearchParams("chit=earn%3Asent_text"))).toEqual({
            kind: "achievements",
            highlight: "sent_text",
        });
        expect(linkedDialog(new URLSearchParams("chit=insurance"))).toEqual({
            kind: "streak_insurance",
        });
        expect(linkedDialog(new URLSearchParams("chit=puzzle"))).toEqual({ kind: "puzzle" });
        expect(linkedDialog(new URLSearchParams("chit=puzzle%3Abridges"))).toEqual({
            kind: "puzzle",
            gameId: "bridges",
        });
        expect(linkedDialog(new URLSearchParams("chit=howto%3Abridges"))).toEqual({
            kind: "puzzle",
            gameId: "bridges",
            how: true,
        });
        expect(linkedDialog(new URLSearchParams("chit=howto"))).toEqual({
            kind: "puzzle",
            how: true,
        });
        expect(linkedDialog(new URLSearchParams("chit=calendar"))).toEqual({
            kind: "claim_history",
        });
        expect(linkedDialog(new URLSearchParams("chit=nope"))).toEqual({ kind: "chit" });
    });

    test("is none for a query without one", () => {
        expect(linkedDialog(new URLSearchParams("threads&open=true"))).toBeUndefined();
    });

    test("is one at a time, the profile first", () => {
        expect(linkedDialog(new URLSearchParams("hof&profile"))).toEqual({ kind: "profile" });
    });

    test("closes by dropping its param", () => {
        expect(linkedDialogParam({ kind: "leaderboard" })).toBe("hof");
        expect(linkedDialogParam({ kind: "profile" })).toBe("profile");
    });
});

describe("the linked dialog shown", () => {
    test("is the one the URL opens, but the CHIT dialog while CHIT is off", () => {
        expect(shownLinkedDialog({ kind: "chit" }, false)).toEqual({ kind: "chit" });
        expect(shownLinkedDialog({ kind: "chit" }, true)).toBeUndefined();
        expect(shownLinkedDialog({ kind: "profile" }, true)).toEqual({ kind: "profile" });
        expect(shownLinkedDialog({ kind: "achievements" }, true)).toBeUndefined();
        expect(shownLinkedDialog({ kind: "streak_insurance" }, true)).toBeUndefined();
        expect(shownLinkedDialog({ kind: "puzzle" }, true)).toBeUndefined();
        expect(shownLinkedDialog({ kind: "claim_history" }, true)).toBeUndefined();
        expect(shownLinkedDialog(undefined, false)).toBeUndefined();
    });
});

describe("opening a linked dialog", () => {
    test("adds its param to the query", () => {
        expect(openLinkedDialog(new URLSearchParams("threads"), { kind: "leaderboard" })).toBe(
            "?threads=&hof",
        );
        expect(openLinkedDialog(new URLSearchParams(""), { kind: "profile" })).toBe("?profile");
    });

    test("keeps the other params' values as they were written", () => {
        expect(openLinkedDialog(new URLSearchParams("?code=a%26b%3Dc"), { kind: "profile" })).toBe(
            "?code=a%26b%3Dc&profile",
        );
    });

    test("takes the place of the one showing", () => {
        expect(openLinkedDialog(new URLSearchParams("profile"), { kind: "diamond" })).toBe(
            "?diamond",
        );
        expect(openLinkedDialog(new URLSearchParams("hof&chit"), { kind: "profile" })).toBe(
            "?profile",
        );
    });

    test("opens the profile on a section with its value", () => {
        expect(
            openLinkedDialog(new URLSearchParams("chit"), { kind: "profile", section: "chit" }),
        ).toBe("?profile=chit");
        expect(
            openLinkedDialog(new URLSearchParams("profile"), { kind: "profile", section: "chit" }),
        ).toBe("?profile=chit");
    });

    test("opens a CHIT view in the CHIT dialog's place, and back again", () => {
        expect(openLinkedDialog(new URLSearchParams("chit"), { kind: "achievements" })).toBe(
            "?chit=earn",
        );
        expect(
            openLinkedDialog(new URLSearchParams(""), {
                kind: "achievements",
                highlight: "Partner quest",
            }),
        ).toBe("?chit=earn%3APartner%20quest");
        expect(openLinkedDialog(new URLSearchParams("chit=earn"), { kind: "chit" })).toBe("?chit");
        expect(
            openLinkedDialog(new URLSearchParams("chit=insurance"), { kind: "streak_insurance" }),
        ).toBeUndefined();
        expect(
            openLinkedDialog(new URLSearchParams("chit"), {
                kind: "puzzle",
                gameId: "tents",
                how: true,
            }),
        ).toBe("?chit=howto%3Atents");
        expect(openLinkedDialog(new URLSearchParams("chit"), { kind: "claim_history" })).toBe(
            "?chit=calendar",
        );
        // how to play is another view of the same puzzle
        expect(
            openLinkedDialog(new URLSearchParams("chit=puzzle%3Atents"), {
                kind: "puzzle",
                gameId: "tents",
                how: true,
            }),
        ).toBe("?chit=howto%3Atents");
        // the same param, so closing any of them drops it
        expect(linkedDialogParam({ kind: "streak_insurance" })).toBe("chit");
    });

    test("is nothing when it's the one showing", () => {
        expect(
            openLinkedDialog(new URLSearchParams("profile"), { kind: "profile" }),
        ).toBeUndefined();
        expect(
            openLinkedDialog(new URLSearchParams("profile&diamond"), { kind: "profile" }),
        ).toBeUndefined();
    });
});

describe("the dialogs loaded ahead", () => {
    test("are the ones built so far", () => {
        const built = Object.values(dialogs).filter((load) => load !== undefined);
        expect(builtDialogScreens()).toEqual(built);
        expect(builtDialogScreens().length).toBeGreaterThan(0);
    });
});

describe("the share picker's link", () => {
    test("carries what another app shared, and nothing from a value that isn't it", () => {
        const query = shareQuery({ title: "T", text: "Look at this", url: "https://x.y" });
        expect(linkedDialog(new URLSearchParams(query.slice(1)))).toEqual({
            kind: "share",
            title: "T",
            text: "Look at this",
            url: "https://x.y",
        });
        expect(linkedDialog(new URLSearchParams("share=not-json"))).toEqual({
            kind: "share",
            title: undefined,
            text: undefined,
            url: undefined,
        });
        // from the /share route itself, whose own kind isn't the dialog's
        const route = { kind: "share_route" as const, title: "T", text: "", url: "u" };
        expect(shareQuery(route)).toContain("?share=");
        // empty fields are left out, as the draft adds no blank line for them
        const empty = shareQuery({ title: "", text: "", url: "https://x.y" });
        expect(linkedDialog(new URLSearchParams(empty.slice(1)))).toMatchObject({
            kind: "share",
            text: undefined,
            url: "https://x.y",
        });
    });
});
