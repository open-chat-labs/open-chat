import type { MessageContent } from "@client";
import { translateMessage } from "./translateMessage";

function client(succeeds = true) {
    const calls: { messageId: bigint; text: string; target: string }[] = [];
    return {
        calls,
        translateMessage: async (messageId: bigint, text: string, target: string) => {
            calls.push({ messageId, text, target });
            return succeeds;
        },
    };
}

const message = (content: MessageContent = { kind: "text_content", text: "bonjour" }) => ({
    messageId: 3n,
    content,
});

describe("translating a message", () => {
    test("is for Diamond members: anyone else is offered the upgrade, and nothing is sent", async () => {
        const c = client();
        expect(await translateMessage(c, message(), { diamond: false, locale: "en" })).toBe(
            "upgrade",
        );
        expect(c.calls).toEqual([]);
    });

    test("goes into the app's language", async () => {
        const c = client();
        expect(await translateMessage(c, message(), { diamond: true, locale: "cn" })).toBe("ok");
        expect(c.calls).toEqual([{ messageId: 3n, text: "bonjour", target: "zh-cn" }]);
    });

    test("goes into English for a locale with no translation code", async () => {
        const c = client();
        await translateMessage(c, message(), { diamond: true, locale: undefined });
        await translateMessage(c, message(), { diamond: true, locale: "xx" });
        expect(c.calls.map((call) => call.target)).toEqual(["en", "en"]);
    });

    test("fails when it can't be translated", async () => {
        expect(
            await translateMessage(client(false), message(), { diamond: true, locale: "en" }),
        ).toBe("failed");
    });
});
