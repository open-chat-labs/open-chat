// Human verification (proof of unique personhood) - see issue #9072.
// These mirror the personhood_verifier canister API. In Phase 0 they are only
// served by the MockVerifierClient.

export type HeadPose = "center" | "left" | "right" | "up" | "down";

export type VerificationChallenge = {
    sessionId: bigint;
    steps: HeadPose[];
    maxFrames: number;
    maxFrameBytes: number;
    maxTotalBytes: number;
    deadline: bigint;
    isRetryRound: boolean;
};

export type StartVerificationResponse =
    | { kind: "success"; challenge: VerificationChallenge }
    | { kind: "already_verified" }
    | { kind: "attempt_limit_reached"; nextAttemptAt: bigint }
    | { kind: "session_already_active"; challenge: VerificationChallenge }
    | { kind: "busy" };

export type UploadVerificationFrameResponse =
    | { kind: "success" }
    | { kind: "session_not_found" }
    | { kind: "session_expired" }
    | { kind: "frame_too_large" }
    | { kind: "too_many_frames" };

export type SubmitVerificationResponse =
    | { kind: "accepted" }
    | { kind: "session_not_found" }
    | { kind: "session_expired" }
    | { kind: "incomplete_challenge"; missingSteps: number[] };

export type VerificationRetryReason = "inconclusive_match" | "poor_quality";

export type VerificationFailureReason =
    | "challenge_failed"
    | "no_face_detected"
    | "not_unique"
    | "session_expired";

export type VerificationStatus =
    | { kind: "queued"; position: number }
    | { kind: "processing" }
    | { kind: "verified"; modelVersion: number }
    | { kind: "retry_required"; reason: VerificationRetryReason }
    | { kind: "verification_failed"; reason: VerificationFailureReason }
    | { kind: "session_not_found" };
