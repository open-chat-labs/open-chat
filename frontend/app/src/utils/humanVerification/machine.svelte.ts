import type {
    HeadPose,
    OpenChat,
    VerificationChallenge,
    VerificationFailureReason,
    VerificationRetryReason,
    VerificationStatus,
} from "openchat-client";
import { captureJpegFrame } from "./capture";
import { loadPoseDetector, type PoseDetector, type PoseEstimate } from "./poseDetector";

export type VerificationFlowState =
    | { kind: "consent" }
    | { kind: "requesting_camera" }
    | { kind: "loading_detector" }
    | { kind: "starting_session" }
    | { kind: "framing" }
    | { kind: "challenge"; stepIndex: number; step: HeadPose }
    | { kind: "uploading" }
    | { kind: "processing"; queuePosition?: number }
    | { kind: "success" }
    | { kind: "retry_offered"; reason: VerificationRetryReason }
    | { kind: "failed"; reason: VerificationFailureReason }
    | { kind: "rate_limited"; nextAttemptAt: bigint }
    | { kind: "already_verified" }
    | { kind: "busy" }
    | { kind: "camera_denied" }
    | { kind: "unsupported" }
    | { kind: "expired" }
    | { kind: "error" };

// How long a pose must be continuously held before we auto-capture
const HOLD_MS = 600;
const FRAMING = {
    minWidthFraction: 0.3,
    maxCenterOffset: 0.18,
};
// Pose thresholds in degrees - tune on real devices with the debug overlay
const POSE_THRESHOLDS = {
    center: 10,
    left: -20,
    right: 20,
    up: 15,
    down: -15,
};
const UPLOAD_RETRIES = 3;

// Headless driver for the human verification capture flow (#9072). Owns the
// MediaStream, pose detection loop, frame capture/upload and status polling;
// the desktop and mobile component trees just render its state.
export class HumanVerificationMachine {
    #state = $state<VerificationFlowState>({ kind: "consent" });
    #pose = $state<PoseEstimate | undefined>(undefined);
    #remainingMs = $state<number | undefined>(undefined);
    #degraded = $state(false);
    #challenge: VerificationChallenge | undefined = undefined;
    #stream: MediaStream | undefined = undefined;
    #video: HTMLVideoElement | undefined = undefined;
    #detector: PoseDetector | undefined = undefined;
    #uploads: Promise<boolean>[] = [];
    #holdStart: number | undefined = undefined;
    #loopHandle: number | undefined = undefined;
    #capturing = false;
    #destroyed = false;

    constructor(private client: OpenChat) {}

    get state(): VerificationFlowState {
        return this.#state;
    }

    // Latest pose estimate - consumed by the debug overlay
    get pose(): PoseEstimate | undefined {
        return this.#pose;
    }

    get degraded(): boolean {
        return this.#degraded;
    }

    get remainingMs(): number | undefined {
        return this.#remainingMs;
    }

    get challenge(): VerificationChallenge | undefined {
        return this.#challenge;
    }

    attachVideo(video: HTMLVideoElement) {
        this.#video = video;
        if (this.#stream !== undefined) {
            video.srcObject = this.#stream;
            video.play().catch(() => undefined);
        }
    }

    // consent given - acquire the camera, then the detector, then a session.
    // Session comes last: attempts are rate limited so we don't burn one
    // until the local prerequisites have succeeded.
    async start(): Promise<void> {
        if (this.#state.kind !== "consent") return;
        if (navigator.mediaDevices?.getUserMedia === undefined) {
            this.#state = { kind: "unsupported" };
            return;
        }
        this.#state = { kind: "requesting_camera" };
        try {
            this.#stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: "user",
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                },
            });
        } catch {
            this.#state = { kind: "camera_denied" };
            return;
        }
        if (this.#video !== undefined) {
            this.attachVideo(this.#video);
        }
        this.#state = { kind: "loading_detector" };
        this.#detector = await loadPoseDetector();
        this.#degraded = this.#detector === undefined;
        if (this.#destroyed) return;
        await this.#startSession();
    }

    async #startSession(): Promise<void> {
        this.#state = { kind: "starting_session" };
        try {
            const resp = await this.client.startHumanVerification();
            if (this.#destroyed) return;
            switch (resp.kind) {
                case "success":
                case "session_already_active":
                    this.#challenge = resp.challenge;
                    this.#uploads = [];
                    this.#state = { kind: "framing" };
                    this.#startLoop();
                    break;
                case "already_verified":
                    this.#state = { kind: "already_verified" };
                    break;
                case "attempt_limit_reached":
                    this.#state = { kind: "rate_limited", nextAttemptAt: resp.nextAttemptAt };
                    break;
                case "busy":
                    this.#state = { kind: "busy" };
                    break;
                case "user_not_found":
                case "internal_error":
                    this.#state = { kind: "error" };
                    break;
            }
        } catch {
            this.#state = { kind: "error" };
        }
    }

    // Degraded mode: the user confirms they are framed, then works through the
    // steps with the manual shutter.
    manualReady(): void {
        if (this.#state.kind === "framing" && this.#degraded) {
            this.#beginStep(0);
        }
    }

    async manualCapture(): Promise<void> {
        if (this.#state.kind === "challenge" && this.#degraded) {
            await this.#captureCurrentStep(this.#state.stepIndex);
        }
    }

    // After a retry_required verdict the user opts in to the second round
    retry(): void {
        if (this.#state.kind === "retry_offered") {
            void this.#startSession();
        }
    }

    // After expiry (or wanting another go from a failure that allows it)
    restart(): void {
        if (this.#state.kind === "expired" || this.#state.kind === "error") {
            void this.#startSession();
        }
    }

    destroy(): void {
        this.#destroyed = true;
        this.#stopLoop();
        this.#stream?.getTracks().forEach((t) => t.stop());
        this.#stream = undefined;
        this.#detector?.close();
        this.#detector = undefined;
    }

    #beginStep(index: number): void {
        const challenge = this.#challenge;
        if (challenge === undefined) return;
        this.#holdStart = undefined;
        this.#state = { kind: "challenge", stepIndex: index, step: challenge.steps[index] };
    }

    #startLoop(): void {
        this.#stopLoop();
        const video = this.#video;
        if (video === undefined) return;
        const tick = () => {
            if (this.#destroyed) return;
            this.#onFrame();
            this.#loopHandle =
                "requestVideoFrameCallback" in video
                    ? video.requestVideoFrameCallback(tick)
                    : requestAnimationFrame(tick);
        };
        tick();
    }

    #stopLoop(): void {
        const video = this.#video;
        if (this.#loopHandle !== undefined && video !== undefined) {
            if ("cancelVideoFrameCallback" in video) {
                video.cancelVideoFrameCallback(this.#loopHandle);
            } else {
                cancelAnimationFrame(this.#loopHandle);
            }
            this.#loopHandle = undefined;
        }
    }

    #onFrame(): void {
        const challenge = this.#challenge;
        if (challenge !== undefined) {
            const remaining = Number(challenge.deadline) - Date.now();
            this.#remainingMs = Math.max(0, remaining);
            if (
                remaining <= 0 &&
                (this.#state.kind === "framing" || this.#state.kind === "challenge")
            ) {
                this.#state = { kind: "expired" };
                this.#stopLoop();
                return;
            }
        }
        if (this.#detector === undefined || this.#video === undefined || this.#capturing) return;

        let pose: PoseEstimate | undefined;
        try {
            pose = this.#detector.estimate(this.#video, performance.now());
        } catch {
            return;
        }
        if (pose === undefined) return;
        this.#pose = pose;

        if (this.#state.kind === "framing") {
            if (this.#framingOk(pose)) {
                if (this.#held()) {
                    this.#beginStep(0);
                }
            } else {
                this.#holdStart = undefined;
            }
        } else if (this.#state.kind === "challenge") {
            if (pose.faceCount === 1 && this.#poseMatches(this.#state.step, pose)) {
                if (this.#held()) {
                    const index = this.#state.stepIndex;
                    this.#holdStart = undefined;
                    void this.#captureCurrentStep(index);
                }
            } else {
                this.#holdStart = undefined;
            }
        }
    }

    #held(): boolean {
        const now = performance.now();
        if (this.#holdStart === undefined) {
            this.#holdStart = now;
            return false;
        }
        return now - this.#holdStart >= HOLD_MS;
    }

    #framingOk(pose: PoseEstimate): boolean {
        return (
            pose.faceCount === 1 &&
            pose.widthFraction >= FRAMING.minWidthFraction &&
            Math.abs(pose.centerX - 0.5) <= FRAMING.maxCenterOffset &&
            Math.abs(pose.centerY - 0.5) <= FRAMING.maxCenterOffset &&
            this.#poseMatches("center", pose)
        );
    }

    #poseMatches(step: HeadPose, pose: PoseEstimate): boolean {
        switch (step) {
            case "center":
                return (
                    Math.abs(pose.yaw) < POSE_THRESHOLDS.center &&
                    Math.abs(pose.pitch) < POSE_THRESHOLDS.center
                );
            case "left":
                return pose.yaw < POSE_THRESHOLDS.left;
            case "right":
                return pose.yaw > POSE_THRESHOLDS.right;
            case "up":
                return pose.pitch > POSE_THRESHOLDS.up;
            case "down":
                return pose.pitch < POSE_THRESHOLDS.down;
        }
    }

    async #captureCurrentStep(index: number): Promise<void> {
        const challenge = this.#challenge;
        const video = this.#video;
        if (challenge === undefined || video === undefined || this.#capturing) return;
        this.#capturing = true;
        try {
            const bytes = await captureJpegFrame(video, challenge.maxFrameBytes);
            if (this.#destroyed) return;
            if (bytes !== undefined) {
                // Eager upload while the user moves on to the next pose
                this.#uploads.push(this.#uploadWithRetries(challenge.sessionId, index, bytes));
            }
            if (index + 1 < challenge.steps.length) {
                this.#beginStep(index + 1);
            } else {
                await this.#finish(challenge);
            }
        } finally {
            this.#capturing = false;
        }
    }

    async #uploadWithRetries(
        sessionId: bigint,
        index: number,
        bytes: Uint8Array,
    ): Promise<boolean> {
        for (let attempt = 0; attempt < UPLOAD_RETRIES; attempt++) {
            try {
                const resp = await this.client.uploadVerificationFrame(sessionId, index, bytes);
                if (resp.kind === "success") return true;
                if (resp.kind === "session_expired" || resp.kind === "session_not_found") {
                    return false;
                }
            } catch {
                // fall through and retry
            }
        }
        return false;
    }

    async #finish(challenge: VerificationChallenge): Promise<void> {
        this.#state = { kind: "uploading" };
        this.#stopLoop();
        try {
            const uploaded = await Promise.all(this.#uploads);
            if (this.#destroyed) return;
            if (uploaded.some((ok) => !ok)) {
                this.#state = { kind: "error" };
                return;
            }
            const submitted = await this.client.submitHumanVerification(challenge.sessionId);
            if (this.#destroyed) return;
            if (submitted.kind !== "accepted") {
                this.#state =
                    submitted.kind === "session_expired" ? { kind: "expired" } : { kind: "error" };
                return;
            }
            this.#state = { kind: "processing" };
            const status = await this.client.pollHumanVerification(
                challenge.sessionId,
                challenge.deadline,
                (update: VerificationStatus) => {
                    if (!this.#destroyed && update.kind === "queued") {
                        this.#state = { kind: "processing", queuePosition: update.position };
                    }
                },
            );
            if (this.#destroyed) return;
            switch (status.kind) {
                case "verified":
                    this.#state = { kind: "success" };
                    break;
                case "retry_required":
                    this.#state = { kind: "retry_offered", reason: status.reason };
                    break;
                case "verification_failed":
                    this.#state =
                        status.reason === "session_expired"
                            ? { kind: "expired" }
                            : { kind: "failed", reason: status.reason };
                    break;
                default:
                    this.#state = { kind: "error" };
            }
        } catch {
            if (!this.#destroyed) {
                this.#state = { kind: "error" };
            }
        }
    }
}
