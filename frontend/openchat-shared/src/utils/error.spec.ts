import { describe, expect, test } from "vitest";

import {
    CanisterUnavailableError,
    HttpError,
    INVALID_DELEGATION_ERROR_NAME,
    SESSION_EXPIRY_ERROR_NAME,
} from "../domain";
import { requiresLogout, shouldReportMessage, shouldReportWorkerError } from "./error";

// `toCanisterResponseError` copies the IC error code of the rejection onto the mapped error
function rejection(rejectErrorCode: string): HttpError {
    const error = new HttpError(500, new Error("The replica returned a rejection error"));
    error.rejectErrorCode = rejectErrorCode;
    return error;
}

const frozen = rejection("IC0207");
const noWasm = rejection("IC0537");
const deleted = rejection("IC0301");
const boundary = new HttpError(503, new Error("The server returned an error: 503"));

describe("shouldReportWorkerError", () => {
    test("silences dead-ledger errors for a caller-tolerated kind", () => {
        expect(shouldReportWorkerError("refreshAccountBalance", frozen)).toBe(false);
        expect(shouldReportWorkerError("refreshAccountBalance", noWasm)).toBe(false);
        expect(shouldReportWorkerError("refreshAccountBalance", deleted)).toBe(false);
    });

    test("still reports non-dead-ledger failures for a tolerated kind", () => {
        // a replica rejection with an unexpected code is a real signal, not an expected dead ledger
        expect(shouldReportWorkerError("refreshAccountBalance", rejection("IC0503"))).toBe(true);
        expect(shouldReportWorkerError("refreshAccountBalance", new TypeError("boom"))).toBe(true);
    });

    // The IC error code is read from the error, not its text, so an unrelated failure which merely
    // quotes a dead-ledger code (eg. a trap message) is still reported
    test("does not silence an error which only mentions a dead-ledger code in its message", () => {
        const mentionsCode = new HttpError(500, new Error("trapped while handling IC0207"));

        expect(shouldReportWorkerError("refreshAccountBalance", mentionsCode)).toBe(true);
    });

    // A frozen or uninstalled ledger is mapped to `CanisterUnavailableError` so that it stops
    // retrying, which is the form this check actually receives it in
    test("silences an unavailable ledger", () => {
        const unavailable = new CanisterUnavailableError(new Error("Canister x is frozen."));
        unavailable.rejectErrorCode = "IC0207";

        expect(shouldReportWorkerError("refreshAccountBalance", unavailable)).toBe(false);
    });

    test("reports dead-ledger errors for kinds that are not tolerated", () => {
        expect(shouldReportWorkerError("getUpdates", frozen)).toBe(true);
        expect(shouldReportWorkerError("sendMessage", noWasm)).toBe(true);
    });

    // The session ending underneath in-flight requests is expected (logout / delegation expiry):
    // every racing request fails and none of them is a signal. Matched by name, since these
    // often arrive with their prototype stripped.
    test("silences expected session errors for every kind", () => {
        expect(shouldReportWorkerError("chatEvents", { name: "AnonymousOperationError" })).toBe(
            false,
        );
        expect(shouldReportWorkerError("getUsers", { name: SESSION_EXPIRY_ERROR_NAME })).toBe(
            false,
        );
        expect(shouldReportWorkerError("getBots", { name: INVALID_DELEGATION_ERROR_NAME })).toBe(
            false,
        );
    });

    test("silences gateway errors and failed fetches for every kind", () => {
        expect(shouldReportWorkerError("chatEvents", boundary)).toBe(false);
        expect(
            shouldReportWorkerError(
                "getUsers",
                new HttpError(504, new Error("Gateway timeout")),
            ),
        ).toBe(false);
        expect(shouldReportWorkerError("getBots", new TypeError("Failed to fetch"))).toBe(false);
        expect(shouldReportWorkerError("getBots", new TypeError("Load failed"))).toBe(false);
    });

    // A replica rejection maps to HttpError 500 here - canister traps included - and must
    // still be reported: only genuine gateway codes count as network weather
    test("still reports replica-rejection 500s", () => {
        expect(shouldReportWorkerError("sendMessage", rejection("IC0503"))).toBe(true);
        expect(
            shouldReportWorkerError("chatEvents", new HttpError(500, new Error("canister trap"))),
        ).toBe(true);
    });
});

describe("requiresLogout", () => {
    // These arrive from the worker as plain objects - the prototype does not survive serialisation
    test("recognises session errors by name", () => {
        expect(requiresLogout({ name: SESSION_EXPIRY_ERROR_NAME })).toBe(true);
        expect(requiresLogout({ name: INVALID_DELEGATION_ERROR_NAME })).toBe(true);
    });

    test("ignores anything else", () => {
        expect(requiresLogout({ name: "HttpError" })).toBe(false);
        expect(requiresLogout(new TypeError("boom"))).toBe(false);
        expect(requiresLogout(undefined)).toBe(false);
        expect(requiresLogout(null)).toBe(false);
        expect(requiresLogout("SessionExpiryError")).toBe(false);
    });
});

// Rollbar's checkIgnore path only has the exception class and message, so this must agree with
// the object-based filter rule for rule
describe("shouldReportMessage", () => {
    test("silences session teardown and environment noise by name", () => {
        expect(shouldReportMessage(SESSION_EXPIRY_ERROR_NAME, "")).toBe(false);
        expect(shouldReportMessage(INVALID_DELEGATION_ERROR_NAME, "")).toBe(false);
        expect(shouldReportMessage("AnonymousOperationError", "")).toBe(false);
        expect(shouldReportMessage("AbortError", "The operation was aborted")).toBe(false);
        expect(shouldReportMessage("QuotaExceededError", "")).toBe(false);
    });

    test("silences gateway 502-504 but keeps 500 for an HttpError", () => {
        const http = (status: number) =>
            `HTTP request failed:\n  Status: ${status} (Service Unavailable)`;
        expect(shouldReportMessage("HttpError", http(502))).toBe(false);
        expect(shouldReportMessage("HttpError", http(503))).toBe(false);
        expect(shouldReportMessage("HttpError", http(504))).toBe(false);
        expect(shouldReportMessage("HttpError", http(500))).toBe(true);
        // the status is only meaningful on an HttpError
        expect(shouldReportMessage("Error", http(503))).toBe(true);
    });

    test("silences browser network failures only for the browser's own TypeError", () => {
        expect(shouldReportMessage("TypeError", "Failed to fetch")).toBe(false);
        expect(shouldReportMessage("TypeError", "Load failed")).toBe(false);
        expect(shouldReportMessage("Error", "Failed to fetch the thing")).toBe(true);
        // Tauri's reqwest failure is not a TypeError
        expect(shouldReportMessage("Error", "error decoding response body")).toBe(false);
    });

    test("silences environment noise and expected access races by message", () => {
        expect(
            shouldReportMessage("", "ResizeObserver loop completed with undelivered notifications"),
        ).toBe(false);
        expect(
            shouldReportMessage(
                "Error",
                'Events response error: {"kind":"error","code":103,"message":null}',
            ),
        ).toBe(false);
    });

    test("reports everything else", () => {
        expect(shouldReportMessage("TypeError", "Cannot read properties of undefined")).toBe(true);
        expect(shouldReportMessage("", "something unexpected")).toBe(true);
        expect(shouldReportMessage("Error", 'Events response error: {"code":999}')).toBe(true);
    });
});
