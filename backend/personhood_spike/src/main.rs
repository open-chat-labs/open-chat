//! Phase 0 feasibility spike for on-chain personhood verification (issue #9072).
//!
//! Measures wasm instruction counts for each stage of the proposed pipeline
//! (JPEG decode -> face detect -> landmarks/pose -> face embedding -> uniqueness scan)
//! running under tract-onnx on wasm32-unknown-unknown.
//!
//! Exit criteria: every single inference < 40B instructions (DTS per-message ceiling),
//! full verification < ~120B.
//!
//! Model files are not committed - run `./scripts/download-personhood-spike-models.sh`
//! first, then `cd backend/personhood_spike && canbench`.
//! SIMD variant: `PERSONHOOD_SPIKE_RUSTFLAGS="-C target-feature=+simd128" canbench`.

mod inference;
mod jpeg;
mod scan;

fn main() {}

pub(crate) fn pseudo_random_bytes(seed: u64, len: usize) -> Vec<u8> {
    let mut state = seed | 1;
    let mut out = Vec::with_capacity(len + 8);
    while out.len() < len {
        state ^= state << 13;
        state ^= state >> 7;
        state ^= state << 17;
        out.extend_from_slice(&state.to_le_bytes());
    }
    out.truncate(len);
    out
}

pub(crate) fn pseudo_random_floats(seed: u64, len: usize) -> Vec<f32> {
    pseudo_random_bytes(seed, len)
        .into_iter()
        .map(|b| (b as f32 - 127.5) / 128.0)
        .collect()
}
