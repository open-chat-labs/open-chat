use crate::model::models::ModelStore;
use face_pipeline::{Engines, PipelineError};
use personhood_verifier_canister::{HeadPose, ModelKind, VerificationFailureReason};
use std::cell::RefCell;

// Thin canister-side wrapper over the shared face_pipeline library (so the
// offline calibration tool runs byte-identical inference). This layer owns
// the tract engines as canister state, maps model bytes from the ModelStore,
// and holds the challenge-pose classification (which the calibration tool
// does not need).

pub use face_pipeline::{DetectedFace, Rgb, cosine_f32, estimate_pose, l2_normalize, quantize_i8};

// Absolute plausibility window for the first (Center) frame, which anchors
// the session's neutral baseline; later steps are classified by their delta
// from that baseline. Device telemetry showed absolute pitch on genuine
// frontal frames varying +4..+20 degrees with camera elevation, so absolute
// thresholds cannot work; deltas cancel the bias (observed genuine deltas:
// Up +45, Left -52, Right +71, closing Center -4).
const NEUTRAL_MAX_YAW: f32 = 25.0;
const NEUTRAL_MIN_PITCH: f32 = -25.0;
const NEUTRAL_MAX_PITCH: f32 = 35.0;
// Return-to-neutral tolerance: looser than the turn/tilt trigger because
// natural head drift plus the webcam-below-eye pitch bias put a genuine
// closing Center up to ~12-13 degrees off the anchor (a real run missed by
// 0.26 at 12.0). The 4 direction steps still demand a real >=12 excursion.
const DELTA_CENTER_MAX: f32 = 15.0;
const DELTA_TURN_MIN: f32 = 12.0;
const DELTA_TILT_MIN: f32 = 12.0;

thread_local! {
    // tract models are not serializable; rebuilt lazily after upgrades
    static ENGINES: RefCell<Option<Engines>> = const { RefCell::new(None) };
}

pub fn engines_ready() -> bool {
    ENGINES.with_borrow(|e| e.is_some())
}

pub fn drop_engines() {
    ENGINES.with_borrow_mut(|e| *e = None);
}

// Parses + optimizes the models. ~3B instructions, called from commit_model
// and lazily after upgrades.
pub fn build_engines(models: &ModelStore) -> Result<(), String> {
    let engines = Engines::build(
        &models.assemble(ModelKind::Detection),
        &models.assemble(ModelKind::Landmarks),
        &models.assemble(ModelKind::Embedding),
    )?;
    ENGINES.with_borrow_mut(|e| *e = Some(engines));
    Ok(())
}

pub fn validate_model(bytes: &[u8], kind: ModelKind) -> Result<(), String> {
    match kind {
        ModelKind::Detection => face_pipeline::build_detector(bytes).map(|_| ()),
        ModelKind::Landmarks => face_pipeline::build_landmarker(bytes).map(|_| ()),
        ModelKind::Embedding => face_pipeline::build_embedder(bytes).map(|_| ()),
    }
}

pub fn decode_jpeg(bytes: &[u8]) -> Result<Rgb, VerificationFailureReason> {
    face_pipeline::decode_jpeg(bytes).map_err(map_error)
}

pub fn detect_face(image: &Rgb) -> Result<DetectedFace, VerificationFailureReason> {
    with_engines(|engines| engines.detect_face(image).map_err(map_error))
}

pub fn embed_face(image: &Rgb, face: &DetectedFace) -> Result<Vec<f32>, VerificationFailureReason> {
    with_engines(|engines| engines.embed_face(image, face).map_err(map_error))
}

// Is this measurement a believable neutral (Center) pose in absolute terms?
// Applied to the first frame only, which then anchors the baseline.
pub fn neutral_plausible(yaw: f32, pitch: f32) -> bool {
    yaw.abs() < NEUTRAL_MAX_YAW && pitch > NEUTRAL_MIN_PITCH && pitch < NEUTRAL_MAX_PITCH
}

// Classifies a step by its delta from the session's neutral baseline
pub fn pose_delta_matches(step: HeadPose, delta_yaw: f32, delta_pitch: f32) -> bool {
    match step {
        HeadPose::Center => delta_yaw.abs() < DELTA_CENTER_MAX && delta_pitch.abs() < DELTA_CENTER_MAX,
        HeadPose::Left => delta_yaw < -DELTA_TURN_MIN,
        HeadPose::Right => delta_yaw > DELTA_TURN_MIN,
        HeadPose::Up => delta_pitch > DELTA_TILT_MIN,
        HeadPose::Down => delta_pitch < -DELTA_TILT_MIN,
    }
}

fn map_error(error: PipelineError) -> VerificationFailureReason {
    match error {
        PipelineError::NoFace => VerificationFailureReason::NoFaceDetected,
        PipelineError::DecodeFailed | PipelineError::MultipleFaces | PipelineError::InferenceFailed => {
            VerificationFailureReason::ChallengeFailed
        }
    }
}

fn with_engines<T>(f: impl FnOnce(&Engines) -> Result<T, VerificationFailureReason>) -> Result<T, VerificationFailureReason> {
    ENGINES.with_borrow(|engines| {
        let engines = engines.as_ref().ok_or(VerificationFailureReason::ChallengeFailed)?;
        f(engines)
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use face_pipeline::DetectedFace;

    #[test]
    fn pose_signs_and_baseline_classification() {
        let frontal = DetectedFace {
            keypoints: [[40.0, 50.0], [72.0, 50.0], [56.0, 70.0], [44.0, 90.0], [68.0, 90.0]],
        };
        let (base_yaw, base_pitch) = estimate_pose(&frontal);
        assert!(neutral_plausible(base_yaw, base_pitch), "{base_yaw} {base_pitch}");

        // Subject turns their left: nose towards image-right => delta yaw < 0
        let turned_left = DetectedFace {
            keypoints: [[40.0, 50.0], [72.0, 50.0], [68.0, 70.0], [44.0, 90.0], [68.0, 90.0]],
        };
        let (yaw, pitch) = estimate_pose(&turned_left);
        assert!(pose_delta_matches(HeadPose::Left, yaw - base_yaw, pitch - base_pitch));

        // Tilting up raises the nose => delta pitch > 0
        let tilted_up = DetectedFace {
            keypoints: [[40.0, 50.0], [72.0, 50.0], [56.0, 62.0], [44.0, 90.0], [68.0, 90.0]],
        };
        let (yaw, pitch) = estimate_pose(&tilted_up);
        assert!(pose_delta_matches(HeadPose::Up, yaw - base_yaw, pitch - base_pitch));

        assert!(pose_delta_matches(HeadPose::Center, 0.5, -1.0));
        assert!(!pose_delta_matches(HeadPose::Center, 0.5, 20.0));
    }
}
