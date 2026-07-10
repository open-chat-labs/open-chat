use personhood_verifier_canister::VerificationFailureReason;
use serde::{Deserialize, Serialize};
use serde_bytes::ByteBuf;

pub mod real;
mod stub;

// Uniqueness similarity bands, calibrated on w600k_r50 (LFW, 6000 pairs, i8
// production metric). These are the launch DEFAULTS; the live values are
// SNS-governable at runtime (set_uniqueness_thresholds).
//
// Operating point deliberately leans to low false-reject over maximal sybil
// resistance: T_dup 0.55 => ~1% innocent rejection at ~100k enrolled, ~12% of
// genuine duplicates slip. Face embeddings cannot do stronger 1:N uniqueness
// at scale (information-theoretic wall); this is a probabilistic sybil
// speed-bump, not a guarantee. Raise the bands by proposal as N grows.
pub const DEFAULT_DUPLICATE_THRESHOLD: f32 = 0.55;
pub const DEFAULT_CLEAR_THRESHOLD: f32 = 0.45;
// The single retry round is mildly stricter
pub const DEFAULT_DUPLICATE_THRESHOLD_RETRY: f32 = 0.50;

// Minimum pairwise similarity between a session's own frame embeddings. Not a
// sybil lever - this is session self-consistency (all the challenge frames are
// the same face), so it stays a compile-time constant.
pub const SAME_FACE_THRESHOLD: f32 = 0.5;

// SNS-governable uniqueness bands. Invariant enforced on update:
// 0 <= clear <= duplicate_retry <= duplicate <= 1.
#[derive(Serialize, Deserialize, Clone, Copy, Debug)]
pub struct UniquenessThresholds {
    pub duplicate: f32,
    pub clear: f32,
    pub duplicate_retry: f32,
}

impl Default for UniquenessThresholds {
    fn default() -> Self {
        Self {
            duplicate: DEFAULT_DUPLICATE_THRESHOLD,
            clear: DEFAULT_CLEAR_THRESHOLD,
            duplicate_retry: DEFAULT_DUPLICATE_THRESHOLD_RETRY,
        }
    }
}

// Stub path: deterministic from a marker byte so integration tests can
// exercise every outcome without model weights. Used whenever the real
// models have not been committed.
pub fn compute_embedding(frames: &[ByteBuf]) -> Result<Vec<i8>, VerificationFailureReason> {
    stub::compute_embedding(frames)
}
