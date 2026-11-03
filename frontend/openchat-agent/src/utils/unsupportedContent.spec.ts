import { describe, expect, test, vi } from "vitest";
import { TypeboxValidationError } from "@shared";
import { CommunityEventsResponse } from "../typebox";
import { typeboxValidate } from "./typebox";
import { UNSUPPORTED_CUSTOM_CONTENT_KIND } from "./unsupportedContent";

function message(i: number, content: unknown) {
    return {
        index: i,
        timestamp: String(1_700_000_000_000 + i),
        event: {
            Message: {
                message_index: i,
                message_id: 1_000_000 + i,
                sender: new Uint8Array([1, 2, 3]),
                content,
                reactions: [],
                tips: [],
                edited: false,
                forwarded: false,
            },
        },
    };
}

function eventsResponse(contents: unknown[]) {
    return {
        Success: {
            events: contents.map((content, i) => message(i, content)),
            expired_event_ranges: [],
            latest_event_index: contents.length,
            chat_last_updated: 1_700_000_000_000,
        },
    };
}

type Validated = {
    Success: { events: { event: { Message: { content: Record<string, unknown> } } }[] };
};

function contents(value: Validated) {
    return value.Success.events.map((e) => e.event.Message.content);
}

describe("message content of an unknown type", () => {
    test("is replaced, rather than failing the whole response", () => {
        vi.spyOn(console, "warn").mockImplementation(() => undefined);
        const response = eventsResponse([
            { Text: { text: "before" } },
            { SomethingNew: { players: [], status: "Open" } },
            { Text: { text: "after" } },
        ]);

        const result = contents(typeboxValidate(response, CommunityEventsResponse) as Validated);

        expect(result[0]).toEqual({ Text: { text: "before" } });
        expect(result[1]).toEqual({
            Custom: { kind: UNSUPPORTED_CUSTOM_CONTENT_KIND, data: new Uint8Array() },
        });
        expect(result[2]).toEqual({ Text: { text: "after" } });
    });

    test("leaves known content alone", () => {
        const response = eventsResponse([{ Text: { text: "hello" } }]);
        const result = contents(typeboxValidate(response, CommunityEventsResponse) as Validated);
        expect(result[0]).toEqual({ Text: { text: "hello" } });
    });

    test("doesn't hide a response that is invalid for another reason", () => {
        vi.spyOn(console, "error").mockImplementation(() => undefined);
        const response = eventsResponse([{ SomethingNew: {} }]);
        (response.Success as Record<string, unknown>).latest_event_index = "not a number";
        expect(() => typeboxValidate(response, CommunityEventsResponse)).toThrow(
            TypeboxValidationError,
        );
    });

    test("doesn't hide known content that is malformed", () => {
        vi.spyOn(console, "error").mockImplementation(() => undefined);
        const response = eventsResponse([{ Text: { wrong: 1 } }]);
        expect(() => typeboxValidate(response, CommunityEventsResponse)).toThrow(
            TypeboxValidationError,
        );
    });
});
