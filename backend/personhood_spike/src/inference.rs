use crate::pseudo_random_floats;
use canbench_rs::{BenchResult, bench, bench_fn};
use tract_onnx::prelude::*;

const RFB320: &[u8] = include_bytes!("../models/version-RFB-320.onnx");
const SCRFD500M: &[u8] = include_bytes!("../models/det_500m.onnx");
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
    Tensor::from_shape(&shape, &pseudo_random_floats(42, len)).unwrap().into_tvalue()
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

// One-time cost (init/post_upgrade or lazy first-use): parse + optimize + plan

#[bench(raw)]
fn build_detector_rfb320() -> BenchResult {
    bench_build(RFB320, [1, 3, 240, 320])
}

#[bench(raw)]
fn build_detector_scrfd500m() -> BenchResult {
    bench_build(SCRFD500M, [1, 3, 640, 640])
}

#[bench(raw)]
fn build_landmarks_2d106() -> BenchResult {
    bench_build(LANDMARKS_2D106, [1, 3, 192, 192])
}

#[bench(raw)]
fn build_embedder_w600k_mbf() -> BenchResult {
    bench_build(W600K_MBF, [1, 3, 112, 112])
}

// Per-frame inference costs - each MUST fit the 40B instruction DTS ceiling

#[bench(raw)]
fn detect_rfb320() -> BenchResult {
    bench_run(RFB320, [1, 3, 240, 320])
}

#[bench(raw)]
fn detect_scrfd500m() -> BenchResult {
    bench_run(SCRFD500M, [1, 3, 640, 640])
}

#[bench(raw)]
fn landmarks_2d106() -> BenchResult {
    bench_run(LANDMARKS_2D106, [1, 3, 192, 192])
}

#[bench(raw)]
fn embed_w600k_mbf() -> BenchResult {
    bench_run(W600K_MBF, [1, 3, 112, 112])
}

// Full verification: 8 frames detected + posed, 4 embedded (models pre-built).
// Not how production runs it (one inference per timer execution) - this measures
// the total instruction budget for one verification.

#[bench(raw)]
fn full_verification_8_frames() -> BenchResult {
    let detector = build(RFB320, [1, 3, 240, 320]);
    let landmarks = build(LANDMARKS_2D106, [1, 3, 192, 192]);
    let embedder = build(W600K_MBF, [1, 3, 112, 112]);
    let detect_input = input([1, 3, 240, 320]);
    let landmarks_input = input([1, 3, 192, 192]);
    let embed_input = input([1, 3, 112, 112]);
    bench_fn(|| {
        for _ in 0..8 {
            std::hint::black_box(detector.run(tvec!(detect_input.clone())).unwrap());
            std::hint::black_box(landmarks.run(tvec!(landmarks_input.clone())).unwrap());
        }
        for _ in 0..4 {
            std::hint::black_box(embedder.run(tvec!(embed_input.clone())).unwrap());
        }
    })
}
