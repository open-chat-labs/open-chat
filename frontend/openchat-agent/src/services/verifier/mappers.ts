import type {
    HeadPose,
    StartVerificationResponse,
    SubmitVerificationResponse,
    UploadVerificationFrameResponse,
    VerificationChallenge,
    VerificationFailureReason,
    VerificationRetryReason,
    VerificationStatus,
} from "openchat-shared";
import { UnsupportedValueError } from "openchat-shared";
import type {
    PersonhoodVerifierHeadPose,
    PersonhoodVerifierStartVerificationResponse,
    PersonhoodVerifierSubmitVerificationResponse,
    PersonhoodVerifierUploadFrameResponse,
    PersonhoodVerifierVerificationChallenge,
    PersonhoodVerifierVerificationFailureReason,
    PersonhoodVerifierVerificationRetryReason,
    PersonhoodVerifierVerificationStatusResponse,
} from "../../typebox";

function headPose(value: PersonhoodVerifierHeadPose): HeadPose {
    switch (value) {
        case "Center":
            return "center";
        case "Left":
            return "left";
        case "Right":
            return "right";
        case "Up":
            return "up";
        case "Down":
            return "down";
        default:
            throw new UnsupportedValueError("Unexpected HeadPose received", value);
    }
}

function challenge(value: PersonhoodVerifierVerificationChallenge): VerificationChallenge {
    return {
        sessionId: value.session_id,
        steps: value.challenge.map(headPose),
        maxFrames: value.max_frames,
        maxFrameBytes: value.max_frame_bytes,
        maxTotalBytes: value.max_total_bytes,
        deadline: value.deadline,
        isRetryRound: value.is_retry_round,
    };
}

function retryReason(value: PersonhoodVerifierVerificationRetryReason): VerificationRetryReason {
    switch (value) {
        case "InconclusiveMatch":
            return "inconclusive_match";
        case "PoorQuality":
            return "poor_quality";
        default:
            throw new UnsupportedValueError("Unexpected VerificationRetryReason received", value);
    }
}

function failureReason(
    value: PersonhoodVerifierVerificationFailureReason,
): VerificationFailureReason {
    switch (value) {
        case "ChallengeFailed":
            return "challenge_failed";
        case "NoFaceDetected":
            return "no_face_detected";
        case "NotUnique":
            return "not_unique";
        case "SessionExpired":
            return "session_expired";
        default:
            throw new UnsupportedValueError("Unexpected VerificationFailureReason received", value);
    }
}

export function startVerificationResponse(
    value: PersonhoodVerifierStartVerificationResponse,
): StartVerificationResponse {
    if (value === "AlreadyVerified") {
        return { kind: "already_verified" };
    }
    if (value === "Busy") {
        return { kind: "busy" };
    }
    if (value === "UserNotFound") {
        return { kind: "user_not_found" };
    }
    if ("Success" in value) {
        return { kind: "success", challenge: challenge(value.Success) };
    }
    if ("SessionAlreadyActive" in value) {
        return {
            kind: "session_already_active",
            challenge: challenge(value.SessionAlreadyActive),
        };
    }
    if ("AttemptLimitReached" in value) {
        return {
            kind: "attempt_limit_reached",
            nextAttemptAt: value.AttemptLimitReached.next_attempt_at,
        };
    }
    if ("InternalError" in value) {
        return { kind: "internal_error", error: value.InternalError };
    }
    throw new UnsupportedValueError("Unexpected StartVerificationResponse received", value);
}

export function uploadFrameResponse(
    value: PersonhoodVerifierUploadFrameResponse,
): UploadVerificationFrameResponse {
    switch (value) {
        case "Success":
            return { kind: "success" };
        case "SessionNotFound":
            return { kind: "session_not_found" };
        case "SessionExpired":
            return { kind: "session_expired" };
        case "InvalidChallengeIndex":
            return { kind: "invalid_challenge_index" };
        case "FrameTooLarge":
            return { kind: "frame_too_large" };
        case "TotalBytesExceeded":
            return { kind: "total_bytes_exceeded" };
        case "InvalidImage":
            return { kind: "invalid_image" };
        default:
            throw new UnsupportedValueError("Unexpected UploadFrameResponse received", value);
    }
}

export function submitVerificationResponse(
    value: PersonhoodVerifierSubmitVerificationResponse,
): SubmitVerificationResponse {
    if (value === "Accepted") {
        return { kind: "accepted" };
    }
    if (value === "SessionNotFound") {
        return { kind: "session_not_found" };
    }
    if (value === "SessionExpired") {
        return { kind: "session_expired" };
    }
    if ("IncompleteChallenge" in value) {
        return {
            kind: "incomplete_challenge",
            missingSteps: value.IncompleteChallenge.missing_steps,
        };
    }
    throw new UnsupportedValueError("Unexpected SubmitVerificationResponse received", value);
}

export function verificationStatusResponse(
    value: PersonhoodVerifierVerificationStatusResponse,
): VerificationStatus {
    if (value === "NotSubmitted") {
        return { kind: "not_submitted" };
    }
    if (value === "Processing") {
        return { kind: "processing" };
    }
    if (value === "SessionNotFound") {
        return { kind: "session_not_found" };
    }
    if ("Queued" in value) {
        return { kind: "queued", position: value.Queued.position };
    }
    if ("Verified" in value) {
        return { kind: "verified", modelVersion: value.Verified.model_version };
    }
    if ("RetryRequired" in value) {
        return { kind: "retry_required", reason: retryReason(value.RetryRequired.reason) };
    }
    if ("Failed" in value) {
        return { kind: "verification_failed", reason: failureReason(value.Failed.reason) };
    }
    throw new UnsupportedValueError("Unexpected VerificationStatusResponse received", value);
}
