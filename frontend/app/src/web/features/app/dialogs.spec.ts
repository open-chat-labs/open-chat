import {
    builtDialogScreens,
    dialogs,
    linkedDialog,
    linkedDialogParam,
    openLinkedDialog,
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
