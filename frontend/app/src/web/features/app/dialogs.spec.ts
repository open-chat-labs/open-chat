import { linkedDialog, linkedDialogParam } from "./dialogs";

describe("the dialog a URL's query opens", () => {
    test("is the one its param names", () => {
        expect(linkedDialog(new URLSearchParams("profile"))).toEqual({ kind: "profile" });
        expect(linkedDialog(new URLSearchParams("diamond"))).toEqual({ kind: "diamond" });
        expect(linkedDialog(new URLSearchParams("chit"))).toEqual({ kind: "chit" });
        expect(linkedDialog(new URLSearchParams("hof"))).toEqual({ kind: "leaderboard" });
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
