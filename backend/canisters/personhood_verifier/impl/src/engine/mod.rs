use personhood_verifier_canister::VerificationFailureReason;
use serde_bytes::ByteBuf;

pub mod real;
mod stub;

// Similarity bands (indicative values pending offline threshold calibration)
pub const DUPLICATE_THRESHOLD: f32 = 0.85;
pub const CLEAR_THRESHOLD: f32 = 0.55;
// The retry round is stricter: anything at or above this is a duplicate
pub const DUPLICATE_THRESHOLD_RETRY: f32 = 0.65;
// Minimum pairwise similarity between a session's own frame embeddings
pub const SAME_FACE_THRESHOLD: f32 = 0.5;

// Stub path: deterministic from a marker byte so integration tests can
// exercise every outcome without model weights. Used whenever the real
// models have not been committed.
pub fn compute_embedding(frames: &[ByteBuf]) -> Result<Vec<i8>, VerificationFailureReason> {
    stub::compute_embedding(frames)
}
