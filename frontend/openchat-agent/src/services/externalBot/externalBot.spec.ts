import { afterEach, describe, expect, test, vi } from "vitest";
import { getBotDefinition } from "./externalBot";

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("getBotDefinition", () => {
    // Rollbar #3877 / #26389: the endpoint answered 200 with a body that isn't JSON and the
    // request rejected instead of resolving to a failure the bot builder can show
    test("a 200 response whose body is not JSON resolves to a definition failure", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(() => Promise.resolve(new Response("<html></html>", { status: 200 }))),
        );

        const resp = await getBotDefinition("https://bot.example");

        expect(resp.kind).toBe("bot_definition_failure");
    });
});
