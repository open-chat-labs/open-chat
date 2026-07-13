use crate::pseudo_random_floats;
use canbench_rs::{BenchResult, bench, bench_fn};
use tract_onnx::prelude::*;

// The production pipeline (issue #9072): UltraFace RFB-320 detection,
// insightface 2d106det landmarks, w600k ArcFace embedding. Each single
// inference must fit the 40B instruction DTS ceiling. Only w600k_mbf is
// benched here - the stronger w600k_r50 (174 MB, selected by calibration)
// exceeds the 100 MB canister wasm limit when include_bytes'd, so it lives in
// stable memory and its cost is measured on the real personhood_verifier
// canister instead.

const RFB320: &[u8] = include_bytes!("../models/version-RFB-320.onnx");
const LANDMARKS_2D106: &[u8] = include_bytes!("../models/2d106det.onnx");
const W600K_MBF: &[u8] = include_bytes!("../models/w600k_mbf.onnx");

fn build(model_bytes: &[u8], shape: [usize; 4]) -> TypedRunnableModel<TypedModel> {
    tract_onnx::onnx()
        .model_for_read(&mut std::io::Cursor::new(model_bytes))
        .unwrap()
        .with_input_fact(0, InferenceFact::dt_shape(f32::datum_type(), shape))
        .unwrap()
        .into_optimized()
        .unwrap()
        .into_runnable()
        .unwrap()
}

fn input(shape: [usize; 4]) -> TValue {
    let len = shape.iter().product();
    Tensor::from_shape(&shape, &pseudo_random_floats(42, len))
        .unwrap()
        .into_tvalue()
}

fn bench_build(model_bytes: &[u8], shape: [usize; 4]) -> BenchResult {
    bench_fn(|| {
        std::hint::black_box(build(model_bytes, shape));
    })
}

fn bench_run(model_bytes: &[u8], shape: [usize; 4]) -> BenchResult {
    let model = build(model_bytes, shape);
    let input = input(shape);
    bench_fn(|| {
        std::hint::black_box(model.run(tvec!(input.clone())).unwrap());
    })
}

const DETECT_SHAPE: [usize; 4] = [1, 3, 240, 320];
const LANDMARK_SHAPE: [usize; 4] = [1, 3, 192, 192];
const EMBED_SHAPE: [usize; 4] = [1, 3, 112, 112];

// One-time cost (init/post_upgrade or lazy first-use): parse + optimize + plan

#[bench(raw)]
fn build_detector_rfb320() -> BenchResult {
    bench_build(RFB320, DETECT_SHAPE)
}

#[bench(raw)]
fn build_landmarks_2d106() -> BenchResult {
    bench_build(LANDMARKS_2D106, LANDMARK_SHAPE)
}

#[bench(raw)]
fn build_embedder_w600k_mbf() -> BenchResult {
    bench_build(W600K_MBF, EMBED_SHAPE)
}

// Per-frame inference costs - each MUST fit the 40B instruction DTS ceiling

#[bench(raw)]
fn detect_rfb320() -> BenchResult {
    bench_run(RFB320, DETECT_SHAPE)
}

#[bench(raw)]
fn landmarks_2d106() -> BenchResult {
    bench_run(LANDMARKS_2D106, LANDMARK_SHAPE)
}

#[bench(raw)]
fn embed_w600k_mbf() -> BenchResult {
    bench_run(W600K_MBF, EMBED_SHAPE)
}

// Full verification with the production lineup: a 5-pose challenge means 5
// frames detected + landmarked, and the 2 Center frames embedded. Models are
// pre-built (production rebuilds them once, lazily). Not how production runs
// it (one inference per timer execution) - this is the total instruction
// budget for one verification.

fn full_verification(embedder_bytes: &[u8]) -> BenchResult {
    let detector = build(RFB320, DETECT_SHAPE);
    let landmarks = build(LANDMARKS_2D106, LANDMARK_SHAPE);
    let embedder = build(embedder_bytes, EMBED_SHAPE);
    let detect_input = input(DETECT_SHAPE);
    let landmark_input = input(LANDMARK_SHAPE);
    let embed_input = input(EMBED_SHAPE);
    bench_fn(|| {
        for _ in 0..5 {
            std::hint::black_box(detector.run(tvec!(detect_input.clone())).unwrap());
            std::hint::black_box(landmarks.run(tvec!(landmark_input.clone())).unwrap());
        }
        for _ in 0..2 {
            std::hint::black_box(embedder.run(tvec!(embed_input.clone())).unwrap());
        }
    })
}

#[bench(raw)]
fn full_verification_w600k_mbf() -> BenchResult {
    full_verification(W600K_MBF)
}
