import { describe, expect, test } from "vitest";
import { failedCopy, resendsRefusedMessage, resendTakesCopy } from "./resendCopy";

describe("failedCopy", () => {
    test("a message in the failed store is failed, or queued when marked so", () => {
        expect(failedCopy(true, false)).toBe("failed");
        expect(failedCopy(true, true)).toBe("queued");
    });

    test("one not in it isn't kept anywhere", () => {
        expect(failedCopy(false, false)).toBe("none");
    });
});

describe("resendTakesCopy", () => {
    test("takes the copy still where it was: a retry, or the queue sending its own", () => {
        expect(resendTakesCopy("failed", "failed")).toBe(true);
        expect(resendTakesCopy("queued", "queued")).toBe(true);
    });

    test("not one another send has taken meanwhile", () => {
        expect(resendTakesCopy("failed", "none")).toBe(false);
        expect(resendTakesCopy("queued", "none")).toBe(false);
    });

    test("not a failed one queued since, which the offline queue owns", () => {
        expect(resendTakesCopy("failed", "queued")).toBe(false);
    });

    test("a message that wasn't kept anywhere is sent as before", () => {
        expect(resendTakesCopy("none", "none")).toBe(true);
        expect(resendTakesCopy("none", "failed")).toBe(true);
    });
});

describe("resendsRefusedMessage", () => {
    test("only a message still shown failed", () => {
        expect(resendsRefusedMessage("failed")).toBe(true);
        expect(resendsRefusedMessage("queued")).toBe(false);
        expect(resendsRefusedMessage("none")).toBe(false);
    });
});
