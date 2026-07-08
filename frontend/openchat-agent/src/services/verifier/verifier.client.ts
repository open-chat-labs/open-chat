import type {
    StartVerificationResponse,
    SubmitVerificationResponse,
    UploadVerificationFrameResponse,
    VerificationStatus,
} from "openchat-shared";

// Interface onto the personhood_verifier canister (issue #9072).
// Phase 0 ships only the MockVerifierClient; the real msgpack client
// arrives with the canister in a later phase.
export interface VerifierClient {
    startVerification(): Promise<StartVerificationResponse>;
    uploadVerificationFrame(
        sessionId: bigint,
        challengeIndex: number,
        image: Uint8Array,
    ): Promise<UploadVerificationFrameResponse>;
    submitVerification(sessionId: bigint): Promise<SubmitVerificationResponse>;
    verificationStatus(sessionId: bigint): Promise<VerificationStatus>;
}
