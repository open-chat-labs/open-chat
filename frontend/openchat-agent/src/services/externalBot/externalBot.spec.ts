import { afterEach, describe, expect, test, vi } from "vitest";
import { callBotActionEndpoint, getBotDefinition } from "./externalBot";

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

describe("callBotActionEndpoint", () => {
    function answer(body: string, status: number) {
        const fetch = vi.fn((_url: string, _init: RequestInit) =>
            Promise.resolve(new Response(body, { status })),
        );
        vi.stubGlobal("fetch", fetch);
        return fetch;
    }

    test("posts the button's id with the session token", async () => {
        const fetch = answer("{}", 200);

        expect(await callBotActionEndpoint("https://bot.example", "jwt", "join")).toEqual({
            kind: "success",
            reply: undefined,
        });
        const [url, init] = fetch.mock.calls[0];
        expect(url).toBe("https://bot.example/execute_action");
        expect(init.body).toBe(JSON.stringify({ button_id: "join" }));
        expect((init.headers as Record<string, string>)["x-oc-jwt"]).toBe("jwt");
    });

    test("a reply is shown to the presser", async () => {
        answer(JSON.stringify({ message: { content: { Text: { text: "You're in" } } } }), 200);

        expect(await callBotActionEndpoint("https://bot.example", "jwt", "join")).toEqual({
            kind: "success",
            reply: {
                messageContent: { kind: "text_content", text: "You're in" },
                blockLevelMarkdown: false,
            },
        });
    });

    test("a reply which can't be shown still counts as the press succeeding", async () => {
        answer("not json", 200);

        expect(await callBotActionEndpoint("https://bot.example", "jwt", "join")).toEqual({
            kind: "success",
        });
    });

    test("each failure status maps to its own outcome", async () => {
        answer("Not your turn", 400);
        expect(await callBotActionEndpoint("https://bot.example", "jwt", "cell-4")).toEqual({
            kind: "bad_request",
            reason: "Not your turn",
        });

        answer("", 401);
        expect(await callBotActionEndpoint("https://bot.example", "jwt", "cell-4")).toBe(
            "token_rejected",
        );

        answer("", 429);
        expect(await callBotActionEndpoint("https://bot.example", "jwt", "cell-4")).toEqual({
            kind: "too_many_requests",
        });

        answer("boom", 500);
        expect(await callBotActionEndpoint("https://bot.example", "jwt", "cell-4")).toEqual({
            kind: "internal_error",
            error: "boom",
        });
    });
});
