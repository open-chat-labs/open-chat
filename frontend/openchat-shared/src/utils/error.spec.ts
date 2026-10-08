import { describe, expect, test } from "vitest";

import {
    CanisterUnavailableError,
    HttpError,
    INVALID_DELEGATION_ERROR_NAME,
    SESSION_EXPIRY_ERROR_NAME,
} from "../domain";
import {
    requiresLogout,
    shouldReportError,
    shouldReportMessage,
    shouldReportWorkerError,
} from "./error";

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
            shouldReportWorkerError("getUsers", new HttpError(504, new Error("Gateway timeout"))),
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

describe("shouldReportError", () => {
    test("silences IndexedDB backing-store failures", () => {
        const noTx = new Error(
            "Attempt to get a record from database without an in-progress transaction",
        );
        noTx.name = "UnknownError";
        const lost = new Error(
            "Connection to Indexed Database server lost. Refresh the page to try again",
        );
        lost.name = "UnknownError";

        expect(shouldReportError(noTx)).toBe(false);
        expect(shouldReportError(lost)).toBe(false);
    });

    // Invariant: agent-side network weather is never reported. Each message below was a live
    // Rollbar item (#31014 certificate in the past, #31131/#31934 polling timeout, #31936
    // backoff exhausted, #31918 a stale tab's IndexedDB schema).
    test("silences polling timeouts, stale certificates and a stale IDB schema", () => {
        for (const message of [
            "Certificate is signed more than 5 minutes in the past. Certificate time: " +
                "2026-09-15T06:29:39.289Z Current time: 2026-09-15T07:11:21.800Z Clock drift: 0ms",
            "Request timed out after 300000 msec\n  Request ID: d975f6\n  Request status: unknown",
            "Backoff strategy exhausted after 1 attempts.\n  Request ID: c6fc51",
            "Failed to execute 'transaction' on 'IDBDatabase': One of the specified object " +
                "stores was not found.",
        ]) {
            expect(shouldReportError(new HttpError(500, new Error(message)))).toBe(false);
            expect(shouldReportError(new Error(message))).toBe(false);
        }
    });

    test("silences a wrong client clock in both directions", () => {
        // the client's clock is ahead, so the certificate the replica signed looks like the future
        expect(
            shouldReportError(
                new Error("Certificate is signed more than 5 minutes in the future."),
            ),
        ).toBe(false);
        // the client's clock is behind, so the expiry it computed is outside the replica's window
        expect(
            shouldReportError(
                new HttpError(
                    400,
                    new Error(
                        "Invalid request expiry: Minimum allowed expiry: 2026-09-08 01:43:31 UTC, " +
                            "Maximum allowed expiry: 2026-09-08 01:49:01 UTC, " +
                            "Provided expiry: 2026-08-26 04:23:00 UTC.",
                    ),
                ),
            ),
        ).toBe(false);
    });

    test("silences the IC agent giving up after its fetch retries", () => {
        expect(
            shouldReportError(
                new HttpError(500, new Error("Retry strategy exhausted after 1 attempts.")),
            ),
        ).toBe(false);
        // the same words from anything other than the agent's HttpError are still a signal
        expect(shouldReportError(new Error("Retry strategy exhausted after 1 attempts."))).toBe(
            true,
        );
    });

    test("silences errors thrown from browser-extension code", () => {
        const v8 = new Error("func sseError not found");
        v8.stack =
            "Error: func sseError not found\n" +
            "    at Object.<anonymous> (chrome-extension://cadiboklkpojfamcoggejbbdjcoiljjk/inpage.js:252:19758)\n" +
            "    at S (chrome-extension://cadiboklkpojfamcoggejbbdjcoiljjk/inpage.js:219:37976)";
        const gecko = new Error("boom");
        gecko.stack = "inject@moz-extension://abc/inject.js:25:10\nrun@https://oc.app/main.js:1:2";
        // an extension frame further up the stack does not make it the extension's error
        const ours = new Error("boom");
        ours.stack =
            "Error: boom\n" +
            "    at fn (https://oc.app/main.js:1:2)\n" +
            "    at hook (chrome-extension://abc/inject.js:1:2)";
        // a builtin threw on the extension's behalf: the first frame with a script is theirs
        const viaBuiltin = new TypeError("Cannot redefine property: ethereum");
        viaBuiltin.stack =
            "TypeError: Cannot redefine property: ethereum\n" +
            "    at Function.defineProperty (<anonymous>)\n" +
            "    at r.inject (chrome-extension://bfnaelmomeimhlpmgjnjophhpkkoljpa/evmAsk.js:15:5093)";
        const viaNative = new TypeError("boom");
        viaNative.stack =
            "parse@[native code]\n" +
            "inject@safari-web-extension://abc/inject.js:25:10\n" +
            "run@https://oc.app/main.js:1:2";
        const oursViaBuiltin = new TypeError("boom");
        oursViaBuiltin.stack =
            "TypeError: boom\n" +
            "    at JSON.parse (<anonymous>)\n" +
            "    at fn (https://oc.app/main.js:1:2)\n" +
            "    at hook (chrome-extension://abc/inject.js:1:2)";

        expect(shouldReportError(v8)).toBe(false);
        expect(shouldReportError(gecko)).toBe(false);
        expect(shouldReportError(viaBuiltin)).toBe(false);
        expect(shouldReportError(viaNative)).toBe(false);
        expect(shouldReportError(ours)).toBe(true);
        expect(shouldReportError(oursViaBuiltin)).toBe(true);
    });

    test("silences the agent's own wrapper around a fetch that threw", () => {
        expect(
            shouldReportError(
                new HttpError(0, new Error("Failed to fetch HTTP request: Failed to fetch")),
            ),
        ).toBe(false);
        expect(
            shouldReportError(new HttpError(0, new Error("Failed to fetch HTTP request: Load failed"))),
        ).toBe(false);
        // the same words from a plain Error are still a signal
        expect(shouldReportError(new Error("Failed to fetch HTTP request: Failed to fetch"))).toBe(
            true,
        );
    });

    // Invariant: client-environment and IC-side failures seen on 2.0.2054 are not reported, and
    // the rules stay narrow enough that a nearby failure of ours still is. Each message was a live
    // Rollbar item: #27293 and #10401 IndexedDB without a transaction, #28921 a lost IndexedDB
    // blob, #31128 and #30432 the platform passkey service, #31771 the IC's Bitcoin API switched
    // off.
    test("silences the 2026-09-29 environment noise", () => {
        for (const [name, message] of [
            [
                "UnknownError",
                "Attempt to open a cursor in database without an in-progress transaction",
            ],
            [
                "UnknownError",
                "Attempt to get an index record from database without an in-progress transaction",
            ],
            [
                "NotReadableError",
                "Data lost due to missing file. Affected record should be considered irrecoverable",
            ],
            ["NotSupportedError", "Error connecting to Web Authentication service."],
            [
                "NotReadableError",
                "An unknown error occurred while talking to the credential manager.",
            ],
        ]) {
            const error = new Error(message);
            error.name = name;
            expect(shouldReportError(error)).toBe(false);
            expect(shouldReportMessage(name, message)).toBe(false);
        }
        expect(
            shouldReportError(
                new HttpError(
                    500,
                    new Error(
                        "The replica returned a rejection error:\n  Reject code: 5\n  Reject text: " +
                            "Error from Canister <id>: Canister called `ic0.trap` with message: " +
                            "'Panicked at 'Bitcoin API is disabled', canister/src/lib.rs",
                    ),
                ),
            ),
        ).toBe(false);

        // Nearby failures that are ours: a different IndexedDB failure, a passkey the user has
        // no pubkey for, and some other canister trap
        const quota = new Error("Attempt to open a cursor in database failed");
        quota.name = "UnknownError";
        expect(shouldReportError(quota)).toBe(true);
        expect(shouldReportError(new Error("Failed to lookup WebAuthn PubKey"))).toBe(true);
        expect(
            shouldReportError(
                new HttpError(
                    500,
                    new Error("Canister called `ic0.trap`: Bitcoin address invalid"),
                ),
            ),
        ).toBe(true);
    });

    // Invariant: the network, clock, canister-upgrade and CDN failures seen on 2.0.2054 are not
    // reported, and a nearby failure of ours still is. Each message was a live Rollbar item.
    test("silences the 2026-10-01 environment noise", () => {
        // #31999: the agent's catch-all wrapping a fetch that threw
        expect(
            shouldReportError(new HttpError(500, new Error("Unexpected error: Load failed"))),
        ).toBe(false);
        expect(
            shouldReportError(
                new HttpError(500, new Error("Unexpected error: Cannot read properties of null")),
            ),
        ).toBe(true);
        expect(shouldReportError(new Error("Unexpected error: Load failed"))).toBe(true);

        // #31681, and the same text as a bare uncaught rejection under #2195
        const clock =
            '"System time has been synced with the IC network, but certificate is still too ' +
            'far in the future."';
        expect(shouldReportError(new HttpError(500, new Error(`Unexpected error: ${clock}`)))).toBe(
            false,
        );
        expect(shouldReportMessage("", clock)).toBe(false);
        expect(
            shouldReportError(
                new HttpError(500, new Error('Unexpected error: "Invalid certificate signature"')),
            ),
        ).toBe(true);

        // #31692 and #31764: a stopped canister, but not the other rejections from the same items
        const rejected = (text: string, code: string) =>
            new HttpError(
                500,
                new Error(
                    "The replica returned a rejection error:\n  Reject code: 5\n  Reject text: " +
                        `${text}\n  Error code: ${code}\n\nCall context:\n  Canister ID: <id>`,
                ),
            );
        expect(
            shouldReportError(
                rejected(
                    "Canister <id> is stopped and therefore does not have a CallContextManager",
                    "IC0508",
                ),
            ),
        ).toBe(false);
        expect(shouldReportError(rejected("Canister <id> is stopped", "IC0508"))).toBe(false);
        expect(
            shouldReportError(
                rejected("Error from Canister <id>: Canister rejected the message", "IC0406"),
            ),
        ).toBe(true);
        // a canister trap stays a signal, even when its text has a network phrase in it
        expect(
            shouldReportError(
                rejected("Canister <id> trapped: failed to fetch the exchange rate", "IC0503"),
            ),
        ).toBe(true);

        // #31998: the emoji data CDN failing, as reported and as Rollbar strips it on the
        // uncaught path; our own "Failed to fetch: ..." errors still report
        const emojiData =
            "https://cdn.jsdelivr.net/npm/emoji-picker-element-data@^1/en/emojibase/data.json:  500";
        expect(shouldReportError(new Error(`Failed to fetch: ${emojiData}`))).toBe(false);
        expect(shouldReportMessage("Error", emojiData)).toBe(false);
        expect(
            shouldReportError(new Error(`Failed to fetch: ${emojiData.replace("500", "404")}`)),
        ).toBe(true);
        expect(shouldReportError(new Error("Failed to fetch: https://oc.app/version: 500"))).toBe(
            true,
        );
    });

    // Invariant (#9757): a request the worker had no agent for is not reported from the caller,
    // whatever the request kind; it arrives as the plain object the worker serialised
    test("silences a request the worker had no agent for", () => {
        const rejection = {
            stack: "Error: Worker has no agent to handle request: syncSince\n    at worker.js:1:1",
            message: "Worker has no agent to handle request: syncSince",
        };
        expect(shouldReportError(rejection)).toBe(false);
        expect(
            shouldReportError({
                ...rejection,
                message: "Worker has no agent to handle request: getUsers",
            }),
        ).toBe(false);
        expect(shouldReportError({ ...rejection, message: "Worker not initialised" })).toBe(true);
    });

    test("silences Safari storage and in-app browser bridge failures", () => {
        for (const message of [
            "Database deleted by request of the user",
            "An internal error was encountered in the Indexed Database server",
            "WKWebView API client did not respond to this postMessage",
        ]) {
            expect(shouldReportError(new Error(message))).toBe(false);
            expect(shouldReportMessage("Error", message)).toBe(false);
        }
    });

    // Rollbar files it under the message after "because of: ", so both forms
    test("silences Chrome's IndexedDB closing as site data is cleared (#29538)", () => {
        const message = "Connection is closing because of: Force close delete origin";
        expect(shouldReportError({ name: "UnknownError", message })).toBe(false);
        expect(shouldReportMessage("UnknownError", message)).toBe(false);
        expect(shouldReportMessage("UnknownError", "Force close delete origin")).toBe(false);
        expect(
            shouldReportError({
                name: "UnknownError",
                message: "Connection is closing because of: Internal error",
            }),
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
        expect(
            shouldReportMessage("Error", 'Events response error: {"kind":"error","code":203}'),
        ).toBe(false);
    });

    test("reports everything else", () => {
        expect(shouldReportMessage("TypeError", "Cannot read properties of undefined")).toBe(true);
        expect(shouldReportMessage("", "something unexpected")).toBe(true);
        expect(shouldReportMessage("Error", 'Events response error: {"code":999}')).toBe(true);
    });
});
