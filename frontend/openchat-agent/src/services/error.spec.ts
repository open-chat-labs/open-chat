import {
    RejectError,
    ReplicaRejectCode,
    UncertifiedRejectErrorCode,
    type Identity,
} from "@icp-sdk/core/agent";
import { DestinationInvalidError, HttpError } from "@shared";
import { toCanisterResponseError } from "./error";

// Only `getPrincipal` and `getDelegation` are ever touched for the errors under test
const identity = {} as Identity;

function reject(rejectCode: ReplicaRejectCode, message: string, errorCode?: string): Error {
    return RejectError.fromCode(
        new UncertifiedRejectErrorCode(
            new Uint8Array([1]),
            rejectCode,
            message,
            errorCode,
            undefined,
        ),
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
});
