import {
    DELETE_STEPS,
    emphasised,
    marked,
    neverEarnedChit,
    nextMilestone,
    usernameTyped,
} from "./deleteAccount.adapter";

describe("deleting the account", () => {
    test("says what goes with it before the last step", () => {
        expect(DELETE_STEPS).toEqual(["chats", "wallet", "chit", "final"]);
    });

    test("takes the username typed out, with or without its @, whatever the case", () => {
        expect(usernameTyped("julian", "Julian")).toBe(true);
        expect(usernameTyped("  @JULIAN ", "julian")).toBe(true);
        expect(usernameTyped("julia", "julian")).toBe(false);
        expect(usernameTyped("", "julian")).toBe(false);
        expect(usernameTyped("@@julian", "julian")).toBe(false);
    });

    test("counts the days to the streak's next milestone", () => {
        expect(nextMilestone(0)).toEqual({ kind: "next", days: 14, milestone: 14 });
        expect(nextMilestone(14)).toEqual({ kind: "next", days: 16, milestone: 30 });
        expect(nextMilestone(364)).toEqual({ kind: "next", days: 1, milestone: 365 });
        expect(nextMilestone(365)).toEqual({ kind: "all" });
    });

    test("has nothing to lose in CHIT for someone who's never earned any", () => {
        expect(neverEarnedChit(0, 0)).toBe(true);
        expect(neverEarnedChit(0, 500)).toBe(false);
        expect(neverEarnedChit(20, 20)).toBe(false);
    });
});

describe("emphasis in a translated text", () => {
    test("finds the values put in marked, in order", () => {
        const text = `You'll lose ${marked("2,700 CHIT")} and your ${marked("3-day streak")}.`;
        expect(emphasised(text)).toEqual([
            { text: "You'll lose ", strong: false },
            { text: "2,700 CHIT", strong: true },
            { text: " and your ", strong: false },
            { text: "3-day streak", strong: true },
            { text: ".", strong: false },
        ]);
    });

    test("keeps a text that starts or ends with one, or has none", () => {
        expect(emphasised(`${marked("Gone")} for good`)).toEqual([
            { text: "Gone", strong: true },
            { text: " for good", strong: false },
        ]);
        expect(emphasised("Nothing marked")).toEqual([{ text: "Nothing marked", strong: false }]);
    });
});
