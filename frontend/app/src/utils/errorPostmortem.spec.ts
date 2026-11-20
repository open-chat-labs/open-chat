import { describe, expect, test } from "vitest";
import { describeError } from "./errorPostmortem";

describe("describeError", () => {
    // the rejection's stack points into the worker, so the request kind is all that says which call failed
    test("a failed worker request's crash-log line names the request", () => {
        expect(
            describeError({
                name: "UnknownError",
                message: "Attempt to check index constraints without an in-progress transaction",
                requestKind: "getUser",
            }),
        ).toBe(
            "UnknownError: Attempt to check index constraints without an in-progress transaction (worker request: getUser)",
        );
    });
});
