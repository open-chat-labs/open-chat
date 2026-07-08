use personhood_verifier_canister::VerificationFailureReason;
use serde_bytes::ByteBuf;

mod stub;

// Similarity bands (indicative values for the stub engine; the real ones come
// from offline threshold calibration in Phase 0/2)
pub const DUPLICATE_THRESHOLD: f32 = 0.85;
pub const CLEAR_THRESHOLD: f32 = 0.55;
// The retry round is stricter: anything at or above this is a duplicate
pub const DUPLICATE_THRESHOLD_RETRY: f32 = 0.65;

// Runs the full pipeline over the uploaded frames and produces the probe
// embedding. The stub engine is deterministic from a marker byte so
// integration tests can exercise every outcome without real ML; the real
// tract-onnx pipeline replaces the body in Phase 2.
pub fn compute_embedding(frames: &[ByteBuf]) -> Result<Vec<i8>, VerificationFailureReason> {
    stub::compute_embedding(frames)
}
