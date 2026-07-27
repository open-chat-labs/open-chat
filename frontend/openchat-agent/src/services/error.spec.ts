import {
    HttpErrorCode,
    ProtocolError,
    RejectError,
    ReplicaRejectCode,
    type RequestId,
    UncertifiedRejectErrorCode,
    type Identity,
} from "@icp-sdk/core/agent";
import { DestinationInvalidError, HttpError, InvalidDelegationError } from "@shared";
import { toCanisterResponseError } from "./error";

// An expired session is the default - only the delegation tests need a live one
const identity = {} as Identity;
const requestId = new Uint8Array([1]) as unknown as RequestId;

function reject(rejectCode: ReplicaRejectCode, message: string, errorCode?: string): Error {
    return RejectError.fromCode(
        new UncertifiedRejectErrorCode(requestId, rejectCode, message, errorCode, undefined),
    );
}

describe("toCanisterResponseError", () => {
    // A query to a deleted group/community canister is rejected with `DestinationInvalid`. It must
    // be mapped to `DestinationInvalidError` so that the retry loop is short-circuited - retrying
    // can never succeed, and 7 retries with exponential backoff blocks the chat from loading.
    test("a rejection from a canister which doesn't exist is not retryable", () => {
        const error = toCanisterResponseError(
            reject(
                ReplicaRejectCode.DestinationInvalid,
                "Canister 4vbct-tqaaa-aaaar-bljfa-cai not found",
                "IC0301",
            ),
            identity,
        );

        expect(error).toBeInstanceOf(DestinationInvalidError);
    });

    test("other rejections remain retryable", () => {
        for (const rejectCode of [
            ReplicaRejectCode.SysFatal,
            ReplicaRejectCode.SysTransient,
            ReplicaRejectCode.CanisterReject,
            ReplicaRejectCode.CanisterError,
        ]) {
            const error = toCanisterResponseError(reject(rejectCode, "rejected"), identity);

            expect(error).toBeInstanceOf(HttpError);
            expect(error).not.toBeInstanceOf(DestinationInvalidError);
        }
    });

    // Downstream code (eg. the dead-ledger check) only sees the mapped error, so the IC error code
    // has to survive the mapping rather than being re-parsed out of the message
    test("the IC error code of a rejection is carried onto the mapped error", () => {
        const error = toCanisterResponseError(
            reject(ReplicaRejectCode.SysTransient, "Canister x is frozen.", "IC0207"),
            identity,
        );

        expect((error as HttpError).rejectErrorCode).toBe("IC0207");
    });

    test("a failure which carries no IC error code leaves it undefined", () => {
        const error = toCanisterResponseError(new Error("something else went wrong"), identity);

        expect((error as HttpError).rejectErrorCode).toBeUndefined();
    });

    describe("invalid delegation", () => {
        // A session which has not expired, so the session-expiry branch doesn't swallow the case
        const liveSession = {
            getDelegation: () => ({
                delegations: [
                    { delegation: { expiration: BigInt(Date.now() + 60_000) * BigInt(1_000_000) } },
                ],
            }),
        } as unknown as Identity;

        function httpFailure(bodyText: string): Error {
            return ProtocolError.fromCode(new HttpErrorCode(400, "Bad Request", [], bodyText));
        }

        test("is recognised from the response body", () => {
            const error = toCanisterResponseError(
                httpFailure("Invalid delegation: signature could not be verified"),
                liveSession,
            );

            expect(error).toBeInstanceOf(InvalidDelegationError);
        });

        test("is not inferred from an unrelated 400", () => {
            const error = toCanisterResponseError(httpFailure("Malformed request"), liveSession);

            expect(error).toBeInstanceOf(HttpError);
            expect(error).not.toBeInstanceOf(InvalidDelegationError);
        });
    });
});
