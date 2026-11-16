import { carriesOutCommand } from "./botCommands";

describe("the built-in commands the new web UI carries out", () => {
    test("those that post on their own, and registering a webhook", () => {
        for (const name of ["diamond", "faq", "register_webhook"]) {
            expect(carriesOutCommand(name, [])).toBe(true);
        }
    });

    test("a poll and a transfer where the + menu offers their builders", () => {
        expect(carriesOutCommand("poll", ["media", "poll"])).toBe(true);
        expect(carriesOutCommand("crypto", ["media", "poll"])).toBe(false);
        expect(carriesOutCommand("crypto", ["crypto"])).toBe(true);
    });

    test("none of those it has no screen for", () => {
        for (const name of [
            "gif",
            "search",
            "register_bot",
            "update_bot",
            "remove_bot",
            "witch",
            "test-msg",
        ]) {
            expect(carriesOutCommand(name, ["poll", "crypto"])).toBe(false);
        }
    });
});
