import { describe, expect, test } from "vitest";

import { HttpError } from "../domain";
import { shouldReportWorkerError } from "./error";

// Real agent (icp-sdk) reject messages - the IC error code appears on its own line.
const frozen = new HttpError(
    500,
    new Error(
        "The replica returned a rejection error:\n  Reject code: 2\n  Reject text: Canister x is frozen.\n  Error code: IC0207",
    ),
);
const noWasm = new HttpError(
    500,
    new Error(
        "The replica returned a rejection error:\n  Reject code: 5\n  Reject text: ...contains no Wasm module.\n  Error code: IC0537",
    ),
);
const deleted = new HttpError(
    500,
    new Error(
        "The replica returned a rejection error:\n  Reject code: 3\n  Reject text: Canister x not found\n  Error code: IC0301",
    ),
);
const boundary = new HttpError(503, new Error("The server returned an error: 503"));

describe("shouldReportWorkerError", () => {
    test("silences dead-ledger errors for a caller-tolerated kind", () => {
        expect(shouldReportWorkerError("refreshAccountBalance", frozen)).toBe(false);
        expect(shouldReportWorkerError("refreshAccountBalance", noWasm)).toBe(false);
        expect(shouldReportWorkerError("refreshAccountBalance", deleted)).toBe(false);
    });

    test("still reports non-dead-ledger failures for a tolerated kind", () => {
        // a boundary/other error on balance refresh is a real signal, not an expected dead ledger
        expect(shouldReportWorkerError("refreshAccountBalance", boundary)).toBe(true);
        expect(shouldReportWorkerError("refreshAccountBalance", new TypeError("boom"))).toBe(true);
    });

    test("reports everything for kinds that are not tolerated", () => {
        expect(shouldReportWorkerError("getUpdates", frozen)).toBe(true);
        expect(shouldReportWorkerError("sendMessage", noWasm)).toBe(true);
    });
});
