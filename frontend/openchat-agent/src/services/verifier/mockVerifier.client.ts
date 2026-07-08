import type {
    HeadPose,
    StartVerificationResponse,
    SubmitVerificationResponse,
    UploadVerificationFrameResponse,
    VerificationChallenge,
    VerificationStatus,
} from "openchat-shared";

const POSES: HeadPose[] = ["center", "left", "right", "up", "down"];
const SESSION_TTL = 120_000;
const MAX_ATTEMPTS = 5;

type MockSession = {
    challenge: VerificationChallenge;
    framesUploaded: Set<number>;
    submitted: boolean;
    pollCount: number;
};

// Scripted stand-in for the personhood_verifier canister, used when no verifier
// canister is configured (Phase 0 of #9072). Drives every state the UI must
// handle: attempt 1 ends in retry_required, the retry round ends verified,
// subsequent attempts alternate failed / verified, and attempts beyond the
// rate limit return attempt_limit_reached.
export class MockVerifierClient {
    private session: MockSession | undefined = undefined;
    private attempts = 0;
    private verified = false;

    private randomChallenge(isRetryRound: boolean): VerificationChallenge {
        const steps: HeadPose[] = ["center"];
        const others = POSES.slice(1).sort(() => Math.random() - 0.5);
        steps.push(...others.slice(0, isRetryRound ? 4 : 3));
        steps.push("center");
        return {
            sessionId: BigInt(Date.now()),
            steps,
            maxFrames: 10,
            maxFrameBytes: 500 * 1024,
            maxTotalBytes: 3 * 1024 * 1024,
            deadline: BigInt(Date.now() + SESSION_TTL),
            isRetryRound,
        };
    }

    startVerification(): Promise<StartVerificationResponse> {
        if (this.verified) {
            return Promise.resolve({ kind: "already_verified" });
        }
        if (this.session !== undefined && !this.session.submitted) {
            return Promise.resolve({
                kind: "session_already_active",
                challenge: this.session.challenge,
            });
        }
        if (this.attempts >= MAX_ATTEMPTS) {
            return Promise.resolve({
                kind: "attempt_limit_reached",
                nextAttemptAt: BigInt(Date.now() + 48 * 60 * 60 * 1000),
            });
        }
        this.attempts += 1;
        this.session = {
            challenge: this.randomChallenge(this.attempts === 2),
            framesUploaded: new Set(),
            submitted: false,
            pollCount: 0,
        };
        return this.delayed({ kind: "success", challenge: this.session.challenge });
    }

    uploadVerificationFrame(
        sessionId: bigint,
        challengeIndex: number,
        image: Uint8Array,
    ): Promise<UploadVerificationFrameResponse> {
        const session = this.session;
        if (session === undefined || session.challenge.sessionId !== sessionId) {
            return Promise.resolve({ kind: "session_not_found" });
        }
        if (BigInt(Date.now()) > session.challenge.deadline) {
            return Promise.resolve({ kind: "session_expired" });
        }
        if (image.length > session.challenge.maxFrameBytes) {
            return Promise.resolve({ kind: "frame_too_large" });
        }
        if (challengeIndex >= session.challenge.steps.length) {
            return Promise.resolve({ kind: "invalid_challenge_index" });
        }
        session.framesUploaded.add(challengeIndex);
        return this.delayed({ kind: "success" }, 300);
    }

    submitVerification(sessionId: bigint): Promise<SubmitVerificationResponse> {
        const session = this.session;
        if (session === undefined || session.challenge.sessionId !== sessionId) {
            return Promise.resolve({ kind: "session_not_found" });
        }
        if (BigInt(Date.now()) > session.challenge.deadline) {
            this.session = undefined;
            return Promise.resolve({ kind: "session_expired" });
        }
        const missing = session.challenge.steps
            .map((_, i) => i)
            .filter((i) => !session.framesUploaded.has(i));
        if (missing.length > 0) {
            return Promise.resolve({ kind: "incomplete_challenge", missingSteps: missing });
        }
        session.submitted = true;
        return this.delayed({ kind: "accepted" });
    }

    verificationStatus(sessionId: bigint): Promise<VerificationStatus> {
        const session = this.session;
        if (session === undefined || session.challenge.sessionId !== sessionId) {
            return Promise.resolve({ kind: "session_not_found" });
        }
        if (!session.submitted) {
            return Promise.resolve({ kind: "session_not_found" });
        }
        session.pollCount += 1;
        if (session.pollCount === 1) {
            return this.delayed({ kind: "queued", position: 2 });
        }
        if (session.pollCount === 2) {
            return this.delayed({ kind: "queued", position: 1 });
        }
        if (session.pollCount <= 4) {
            return this.delayed({ kind: "processing" });
        }
        this.session = undefined;
        if (this.attempts === 1) {
            return this.delayed({ kind: "retry_required", reason: "inconclusive_match" });
        }
        if (this.attempts % 2 === 1) {
            return this.delayed({ kind: "verification_failed", reason: "not_unique" });
        }
        this.verified = true;
        return this.delayed({ kind: "verified", modelVersion: 1 });
    }

    private delayed<T>(value: T, ms = 500): Promise<T> {
        return new Promise((resolve) => setTimeout(() => resolve(value), ms));
    }
}
