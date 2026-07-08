use crate::model::embeddings::EMBEDDING_DIM;
use personhood_verifier_canister::VerificationFailureReason;
use serde_bytes::ByteBuf;

// Deterministic stand-in for the ML pipeline, driven by a marker byte (the
// first byte of each uploaded frame):
//
// - 0xFE                  -> NoFaceDetected
// - 0xFF                  -> ChallengeFailed
// - frames with differing markers -> ChallengeFailed (same-face check)
// - otherwise the marker fabricates an embedding: markers sharing a group
//   (marker / 4) produce correlated vectors whose cosine similarity lands in
//   a chosen band relative to the group's variant-0 vector:
//     variant 0 (m % 4 == 0)  base vector
//     variant 1               ~0.999 similarity (clear duplicate)
//     variant 2               ~0.71 similarity (gray zone -> retry)
//     variant 3               independent (clear unique)
//   Markers from different groups are effectively orthogonal.
pub fn compute_embedding(frames: &[ByteBuf]) -> Result<Vec<i8>, VerificationFailureReason> {
    let Some(first) = frames.first().filter(|f| !f.is_empty()) else {
        return Err(VerificationFailureReason::NoFaceDetected);
    };
    let marker = first[0];
    if marker == 0xFE {
        return Err(VerificationFailureReason::NoFaceDetected);
    }
    if marker == 0xFF {
        return Err(VerificationFailureReason::ChallengeFailed);
    }
    if frames.iter().any(|f| f.first() != Some(&marker)) {
        return Err(VerificationFailureReason::ChallengeFailed);
    }

    let group = marker / 4;
    let variant = marker % 4;
    let base = pseudo_random_unit(group as u64 + 1_000);
    let noise = pseudo_random_unit(marker as u64 + 2_000);
    let vector: Vec<f32> = match variant {
        0 => base,
        1 => mix(&base, &noise, 0.95),
        2 => mix(&base, &noise, 0.5),
        _ => noise,
    };
    Ok(quantize(&vector))
}

fn mix(a: &[f32], b: &[f32], weight_a: f32) -> Vec<f32> {
    a.iter().zip(b).map(|(x, y)| weight_a * x + (1.0 - weight_a) * y).collect()
}

fn pseudo_random_unit(seed: u64) -> Vec<f32> {
    let mut state = seed | 1;
    let mut out = Vec::with_capacity(EMBEDDING_DIM);
    for _ in 0..EMBEDDING_DIM {
        state ^= state << 13;
        state ^= state >> 7;
        state ^= state << 17;
        out.push(((state & 0xFFFF) as f32 / 32_768.0) - 1.0);
    }
    let norm = out.iter().map(|x| x * x).sum::<f32>().sqrt();
    out.iter().map(|x| x / norm).collect()
}

fn quantize(vector: &[f32]) -> Vec<i8> {
    let max = vector.iter().fold(0f32, |acc, x| acc.max(x.abs()));
    if max == 0.0 {
        return vec![0; vector.len()];
    }
    vector.iter().map(|x| ((x / max) * 127.0) as i8).collect()
}
