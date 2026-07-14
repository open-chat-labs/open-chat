// Lazy wrapper around MediaPipe FaceLandmarker, used purely for UX (live pose
// guidance + auto-capture). Security never depends on this: the canister
// re-verifies everything on-chain. Returning undefined from load() puts the
// flow into degraded mode (manual capture).

export type PoseEstimate = {
    faceCount: number;
    // Degrees; yaw < 0 = subject turning to their left, pitch > 0 = tilting up
    yaw: number;
    pitch: number;
    // Face bounding box as a fraction of frame width, and normalized centre
    widthFraction: number;
    centerX: number;
    centerY: number;
};

export interface PoseDetector {
    estimate(video: HTMLVideoElement, timestampMs: number): PoseEstimate | undefined;
    close(): void;
}

const ASSETS_PATH = "/assets/verification";

export async function loadPoseDetector(): Promise<PoseDetector | undefined> {
    try {
        const vision = await import("@mediapipe/tasks-vision");
        const fileset = await vision.FilesetResolver.forVisionTasks(ASSETS_PATH);
        const landmarker = await vision.FaceLandmarker.createFromOptions(fileset, {
            baseOptions: {
                modelAssetPath: `${ASSETS_PATH}/face_landmarker.task`,
            },
            runningMode: "VIDEO",
            numFaces: 2,
            outputFacialTransformationMatrixes: true,
        });
        return {
            estimate: (video: HTMLVideoElement, timestampMs: number) => {
                const result = landmarker.detectForVideo(video, timestampMs);
                const faceCount = result.faceLandmarks.length;
                if (faceCount === 0) {
                    return {
                        faceCount,
                        yaw: 0,
                        pitch: 0,
                        widthFraction: 0,
                        centerX: 0.5,
                        centerY: 0.5,
                    };
                }
                const landmarks = result.faceLandmarks[0];
                let minX = 1,
                    maxX = 0,
                    minY = 1,
                    maxY = 0;
                for (const p of landmarks) {
                    if (p.x < minX) minX = p.x;
                    if (p.x > maxX) maxX = p.x;
                    if (p.y < minY) minY = p.y;
                    if (p.y > maxY) maxY = p.y;
                }
                const { yaw, pitch } = eulerFromMatrix(
                    result.facialTransformationMatrixes[0]?.data,
                );
                return {
                    faceCount,
                    yaw,
                    pitch,
                    widthFraction: maxX - minX,
                    centerX: (minX + maxX) / 2,
                    centerY: (minY + maxY) / 2,
                };
            },
            close: () => landmarker.close(),
        };
    } catch (err) {
        console.warn("Failed to load face landmarker, falling back to manual capture", err);
        return undefined;
    }
}

// The transformation matrix is column-major; its rotation block gives us
// head yaw/pitch. Signs are chosen so that the machine's thresholds match
// the on-screen instructions (device-tested): the subject turning their head
// to THEIR left gives yaw < 0, tilting up gives pitch > 0. The on-chain
// challenge verification must adopt the same convention.
function eulerFromMatrix(m: Float32Array | number[] | undefined): { yaw: number; pitch: number } {
    if (m === undefined || m.length < 16) return { yaw: 0, pitch: 0 };
    const yaw = -Math.atan2(m[8], m[10]) * (180 / Math.PI);
    const pitch = Math.asin(Math.max(-1, Math.min(1, m[9]))) * (180 / Math.PI);
    return { yaw, pitch };
}
