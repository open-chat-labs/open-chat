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
//     variant 2               ~0.51 similarity (gray zone -> retry)
//     variant 3               independent (clear unique)
//   Markers from different groups are effectively orthogonal.
//
// Real JPEGs (from the actual capture flow running against a test-mode
// canister) all start 0xFF, so instead of the marker protocol they get an
// embedding seeded by a hash of the first frame: every capture session
// becomes a distinct "face" that verifies as unique, which is what a local
// demo needs. The same-face check is skipped since each frame hashes
// differently.
pub fn compute_embedding(frames: &[ByteBuf]) -> Result<Vec<i8>, VerificationFailureReason> {
    let Some(first) = frames.first().filter(|f| !f.is_empty()) else {
        return Err(VerificationFailureReason::NoFaceDetected);
    };
    if first.starts_with(&[0xFF, 0xD8]) {
        return Ok(quantize(&pseudo_random_unit(fnv1a(first))));
    }
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
    // Orthonormalize against base so mixed cosine is exactly
    // w / sqrt(w^2 + (1-w)^2) for every group - the gray band is narrow, so
    // the group-dependent drift of a merely-random noise vector is too coarse.
    let noise = orthonormal_to(pseudo_random_unit(marker as u64 + 2_000), &base);
    let vector: Vec<f32> = match variant {
        0 => base,
        1 => mix(&base, &noise, 0.95),
        // ~0.506 cosine: lands in the [clear, duplicate) gray band
        2 => mix(&base, &noise, 0.37),
        _ => noise,
    };
    Ok(quantize(&vector))
}

fn mix(a: &[f32], b: &[f32], weight_a: f32) -> Vec<f32> {
    a.iter().zip(b).map(|(x, y)| weight_a * x + (1.0 - weight_a) * y).collect()
}

// Component of `v` orthogonal to unit vector `u`, re-normalized
fn orthonormal_to(v: Vec<f32>, u: &[f32]) -> Vec<f32> {
    let dot = v.iter().zip(u).map(|(x, y)| x * y).sum::<f32>();
    let mut out: Vec<f32> = v.iter().zip(u).map(|(x, y)| x - dot * y).collect();
    let norm = out.iter().map(|x| x * x).sum::<f32>().sqrt();
    if norm > 0.0 {
        for x in &mut out {
            *x /= norm;
        }
    }
    out
}

fn fnv1a(bytes: &[u8]) -> u64 {
    let mut hash = 0xCBF29CE484222325u64;
    for b in bytes {
        hash ^= *b as u64;
        hash = hash.wrapping_mul(0x100000001B3);
    }
    hash
}

fn pseudo_random_unit(seed: u64) -> Vec<f32> {
    // splitmix64 per element: plain xorshift from nearby seeds produces
    // correlated sequences, which made unrelated markers falsely similar
    let mut out = Vec::with_capacity(EMBEDDING_DIM);
    for i in 0..EMBEDDING_DIM {
        let mut x = seed.wrapping_mul(0x100000001B3).wrapping_add(i as u64);
        x = x.wrapping_add(0x9E3779B97F4A7C15);
        x = (x ^ (x >> 30)).wrapping_mul(0xBF58476D1CE4E5B9);
        x = (x ^ (x >> 27)).wrapping_mul(0x94D049BB133111EB);
        x ^= x >> 31;
        out.push(((x & 0xFFFF) as f32 / 32_768.0) - 1.0);
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::engine::{DEFAULT_CLEAR_THRESHOLD as CLEAR_THRESHOLD, DEFAULT_DUPLICATE_THRESHOLD as DUPLICATE_THRESHOLD};
    use crate::model::embeddings::cosine_similarity;

    fn embed(marker: u8) -> Vec<i8> {
        compute_embedding(&[ByteBuf::from(vec![marker, 1, 2])]).unwrap()
    }

    #[test]
    fn similarity_bands() {
        // Check every group - the gray band is narrow, so a group-dependent
        // stub cosine would slip out of it (regression: integration group 25)
        for group in [10u8, 15, 25, 30] {
            let m = group * 4;
            let base = embed(m);
            assert!(cosine_similarity(&base, &embed(m + 1)) >= DUPLICATE_THRESHOLD, "group {group} variant 1");
            let gray = cosine_similarity(&base, &embed(m + 2));
            assert!(gray >= CLEAR_THRESHOLD && gray < DUPLICATE_THRESHOLD, "group {group} gray {gray}");
            assert!(cosine_similarity(&base, &embed(m + 3)).abs() < CLEAR_THRESHOLD, "group {group} variant 3");
        }
        // Different groups are orthogonal
        assert!(cosine_similarity(&embed(40), &embed(80)).abs() < CLEAR_THRESHOLD);
    }
}
