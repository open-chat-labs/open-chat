use crate::model::models::ModelStore;
use personhood_verifier_canister::{HeadPose, ModelKind, VerificationFailureReason};
use std::cell::RefCell;
use tract_onnx::prelude::*;

// Real pipeline: JPEG decode -> SCRFD-500M face detection (with 5 facial
// keypoints) -> pose-challenge verification from keypoint geometry ->
// 5-point similarity alignment -> w600k_mbf (MobileFaceNet/ArcFace) 512-dim
// embedding. Models are the insightface buffalo_sc pairing.

const DET_INPUT: usize = 320;
const DET_SCORE_THRESHOLD: f32 = 0.5;
const SECOND_FACE_THRESHOLD: f32 = 0.6;
const NMS_IOU_THRESHOLD: f32 = 0.4;
const EMBED_INPUT: usize = 112;

// Canister-side pose thresholds are looser than the frontend's auto-capture
// thresholds: the challenge check is an anti-replay measure over frames that
// already passed the stricter client-side gate. Same sign convention as the
// frontend (poseDetector.ts): yaw < 0 = subject turning their left,
// pitch > 0 = tilting up.
const CENTER_MAX_DEGREES: f32 = 14.0;
const TURN_MIN_DEGREES: f32 = 12.0;
const TILT_MIN_DEGREES: f32 = 8.0;

// Geometric pose calibration from 5 keypoints - crude but adequate for
// classifying the challenge poses. The nose tip projects roughly 0.5-0.7 of
// the eye distance in front of the eye line, so the raw offset ratio
// understates the true angle; the gains compensate.
const YAW_GAIN: f32 = 90.0;
const PITCH_GAIN: f32 = 120.0;
const PITCH_NEUTRAL_RATIO: f32 = 0.55;

// Standard ArcFace 112x112 alignment template (left eye, right eye, nose,
// left mouth corner, right mouth corner)
const ARCFACE_TEMPLATE: [[f32; 2]; 5] = [
    [38.2946, 51.6963],
    [73.5318, 51.5014],
    [56.0252, 71.7366],
    [41.5493, 92.3655],
    [70.7299, 92.2041],
];

type Model = TypedRunnableModel<TypedModel>;

struct Engines {
    detector: Model,
    embedder: Model,
}

thread_local! {
    // tract models are not serializable; rebuilt lazily after upgrades
    static ENGINES: RefCell<Option<Engines>> = const { RefCell::new(None) };
}

pub struct Rgb {
    pub width: usize,
    pub height: usize,
    pub pixels: Vec<u8>,
}

pub struct DetectedFace {
    // Keypoints in source-image pixels: [left_eye, right_eye, nose,
    // mouth_left, mouth_right]
    pub keypoints: [[f32; 2]; 5],
}

pub fn engines_ready() -> bool {
    ENGINES.with_borrow(|e| e.is_some())
}

pub fn drop_engines() {
    ENGINES.with_borrow_mut(|e| *e = None);
}

// Parses + optimizes both models. ~2B instructions, called from commit_model
// and lazily after upgrades.
pub fn build_engines(models: &ModelStore) -> Result<(), String> {
    let detector = build_model(&models.assemble(ModelKind::Detection), DET_INPUT, DET_INPUT)?;
    if detector.model().outputs.len() != 9 {
        return Err(format!(
            "Detection model must have 9 outputs (SCRFD), found {}",
            detector.model().outputs.len()
        ));
    }
    let embedder = build_model(&models.assemble(ModelKind::Embedding), EMBED_INPUT, EMBED_INPUT)?;
    ENGINES.with_borrow_mut(|e| *e = Some(Engines { detector, embedder }));
    Ok(())
}

pub fn validate_model(bytes: &[u8], kind: ModelKind) -> Result<(), String> {
    match kind {
        ModelKind::Detection => {
            let model = build_model(bytes, DET_INPUT, DET_INPUT)?;
            if model.model().outputs.len() != 9 {
                return Err(format!(
                    "Detection model must have 9 outputs (SCRFD), found {}",
                    model.model().outputs.len()
                ));
            }
        }
        ModelKind::Embedding => {
            build_model(bytes, EMBED_INPUT, EMBED_INPUT)?;
        }
    }
    Ok(())
}

fn build_model(bytes: &[u8], height: usize, width: usize) -> Result<Model, String> {
    tract_onnx::onnx()
        .model_for_read(&mut std::io::Cursor::new(bytes))
        .map_err(|e| format!("parse: {e}"))?
        .with_input_fact(0, InferenceFact::dt_shape(f32::datum_type(), [1, 3, height, width]))
        .map_err(|e| format!("input fact: {e}"))?
        .into_optimized()
        .map_err(|e| format!("optimize: {e}"))?
        .into_runnable()
        .map_err(|e| format!("plan: {e}"))
}

pub fn decode_jpeg(bytes: &[u8]) -> Result<Rgb, VerificationFailureReason> {
    let options = zune_jpeg::zune_core::options::DecoderOptions::default()
        .jpeg_set_out_colorspace(zune_jpeg::zune_core::colorspace::ColorSpace::RGB);
    let mut decoder = zune_jpeg::JpegDecoder::new_with_options(bytes, options);
    let pixels = decoder.decode().map_err(|_| VerificationFailureReason::ChallengeFailed)?;
    let (width, height) = decoder.dimensions().ok_or(VerificationFailureReason::ChallengeFailed)?;
    Ok(Rgb { width, height, pixels })
}

// Detects the single face in the frame; errors if none or more than one
pub fn detect_face(image: &Rgb) -> Result<DetectedFace, VerificationFailureReason> {
    with_engines(|engines| {
        // Letterbox into the square detection input
        let scale = (DET_INPUT as f32 / image.width as f32).min(DET_INPUT as f32 / image.height as f32);
        let scaled_w = (image.width as f32 * scale) as usize;
        let scaled_h = (image.height as f32 * scale) as usize;
        let resized = resize_bilinear(image, scaled_w, scaled_h);

        let mut input = vec![0f32; 3 * DET_INPUT * DET_INPUT];
        for y in 0..scaled_h {
            for x in 0..scaled_w {
                for c in 0..3 {
                    let value = resized.pixels[(y * scaled_w + x) * 3 + c] as f32;
                    input[c * DET_INPUT * DET_INPUT + y * DET_INPUT + x] = (value - 127.5) / 128.0;
                }
            }
        }
        let tensor = Tensor::from_shape(&[1, 3, DET_INPUT, DET_INPUT], &input)
            .map_err(|_| VerificationFailureReason::ChallengeFailed)?;
        let outputs = engines
            .detector
            .run(tvec!(tensor.into_tvalue()))
            .map_err(|_| VerificationFailureReason::ChallengeFailed)?;

        let mut candidates = scrfd_decode(&outputs)?;
        // Rescale from detection-input space back to source-image pixels
        for c in candidates.iter_mut() {
            for p in c.keypoints.iter_mut() {
                p[0] /= scale;
                p[1] /= scale;
            }
            c.bbox = [c.bbox[0] / scale, c.bbox[1] / scale, c.bbox[2] / scale, c.bbox[3] / scale];
        }
        let kept = nms(candidates);
        match kept.len() {
            0 => Err(VerificationFailureReason::NoFaceDetected),
            1 => Ok(DetectedFace {
                keypoints: kept[0].keypoints,
            }),
            _ => {
                // More than one confident face fails the challenge
                if kept.iter().filter(|c| c.score >= SECOND_FACE_THRESHOLD).count() > 1 {
                    Err(VerificationFailureReason::ChallengeFailed)
                } else {
                    Ok(DetectedFace {
                        keypoints: kept[0].keypoints,
                    })
                }
            }
        }
    })
}

struct Candidate {
    score: f32,
    bbox: [f32; 4],
    keypoints: [[f32; 2]; 5],
}

// SCRFD head decode: strides 8/16/32, two anchors per grid position, outputs
// ordered [score x3, bbox x3, kps x3]; bbox/kps regressions are distances in
// stride units
fn scrfd_decode(outputs: &TVec<TValue>) -> Result<Vec<Candidate>, VerificationFailureReason> {
    const STRIDES: [usize; 3] = [8, 16, 32];
    const NUM_ANCHORS: usize = 2;
    let mut candidates = Vec::new();
    for (idx, stride) in STRIDES.iter().enumerate() {
        let scores = as_slice(&outputs[idx])?;
        let bboxes = as_slice(&outputs[idx + 3])?;
        let kps = as_slice(&outputs[idx + 6])?;
        let grid = DET_INPUT / stride;
        for pos in 0..(grid * grid * NUM_ANCHORS) {
            let score = scores[pos];
            if score < DET_SCORE_THRESHOLD {
                continue;
            }
            let cell = pos / NUM_ANCHORS;
            let cx = ((cell % grid) * stride) as f32;
            let cy = ((cell / grid) * stride) as f32;
            let s = *stride as f32;
            let bbox = [
                cx - bboxes[pos * 4] * s,
                cy - bboxes[pos * 4 + 1] * s,
                cx + bboxes[pos * 4 + 2] * s,
                cy + bboxes[pos * 4 + 3] * s,
            ];
            let mut keypoints = [[0f32; 2]; 5];
            for (k, kp) in keypoints.iter_mut().enumerate() {
                kp[0] = cx + kps[pos * 10 + k * 2] * s;
                kp[1] = cy + kps[pos * 10 + k * 2 + 1] * s;
            }
            candidates.push(Candidate { score, bbox, keypoints });
        }
    }
    Ok(candidates)
}

fn as_slice(value: &TValue) -> Result<&[f32], VerificationFailureReason> {
    value
        .as_slice::<f32>()
        .map_err(|_| VerificationFailureReason::ChallengeFailed)
}

fn nms(mut candidates: Vec<Candidate>) -> Vec<Candidate> {
    candidates.sort_by(|a, b| b.score.total_cmp(&a.score));
    let mut kept: Vec<Candidate> = Vec::new();
    for c in candidates {
        if kept.iter().all(|k| iou(&k.bbox, &c.bbox) < NMS_IOU_THRESHOLD) {
            kept.push(c);
        }
    }
    kept
}

fn iou(a: &[f32; 4], b: &[f32; 4]) -> f32 {
    let x1 = a[0].max(b[0]);
    let y1 = a[1].max(b[1]);
    let x2 = a[2].min(b[2]);
    let y2 = a[3].min(b[3]);
    let inter = (x2 - x1).max(0.0) * (y2 - y1).max(0.0);
    let area_a = (a[2] - a[0]).max(0.0) * (a[3] - a[1]).max(0.0);
    let area_b = (b[2] - b[0]).max(0.0) * (b[3] - b[1]).max(0.0);
    if area_a + area_b - inter <= 0.0 { 0.0 } else { inter / (area_a + area_b - inter) }
}

pub fn estimate_pose(face: &DetectedFace) -> (f32, f32) {
    let [le, re, nose, ml, mr] = face.keypoints;
    let mid_eye = [(le[0] + re[0]) / 2.0, (le[1] + re[1]) / 2.0];
    let mid_mouth = [(ml[0] + mr[0]) / 2.0, (ml[1] + mr[1]) / 2.0];
    let eye_dist = ((re[0] - le[0]).powi(2) + (re[1] - le[1]).powi(2)).sqrt().max(1.0);

    // Subject turning their left moves the nose towards image-right (the
    // image is unmirrored), which must map to yaw < 0
    let yaw = -YAW_GAIN * (nose[0] - mid_eye[0]) / eye_dist;

    let face_height = (mid_mouth[1] - mid_eye[1]).max(1.0);
    let ratio = (nose[1] - mid_eye[1]) / face_height;
    let pitch = PITCH_GAIN * (PITCH_NEUTRAL_RATIO - ratio);

    (yaw, pitch)
}

pub fn pose_matches(step: HeadPose, yaw: f32, pitch: f32) -> bool {
    match step {
        HeadPose::Center => yaw.abs() < CENTER_MAX_DEGREES && pitch.abs() < CENTER_MAX_DEGREES,
        HeadPose::Left => yaw < -TURN_MIN_DEGREES,
        HeadPose::Right => yaw > TURN_MIN_DEGREES,
        HeadPose::Up => pitch > TILT_MIN_DEGREES,
        HeadPose::Down => pitch < -TILT_MIN_DEGREES,
    }
}

// Aligns via 5-point similarity transform to the ArcFace template and embeds
pub fn embed_face(image: &Rgb, face: &DetectedFace) -> Result<Vec<f32>, VerificationFailureReason> {
    with_engines(|engines| {
        let transform = similarity_transform(&face.keypoints, &ARCFACE_TEMPLATE);
        let aligned = warp_bilinear(image, &transform, EMBED_INPUT, EMBED_INPUT);

        let mut input = vec![0f32; 3 * EMBED_INPUT * EMBED_INPUT];
        for i in 0..(EMBED_INPUT * EMBED_INPUT) {
            for c in 0..3 {
                input[c * EMBED_INPUT * EMBED_INPUT + i] = (aligned[i * 3 + c] as f32 - 127.5) / 127.5;
            }
        }
        let tensor = Tensor::from_shape(&[1, 3, EMBED_INPUT, EMBED_INPUT], &input)
            .map_err(|_| VerificationFailureReason::ChallengeFailed)?;
        let outputs = engines
            .embedder
            .run(tvec!(tensor.into_tvalue()))
            .map_err(|_| VerificationFailureReason::ChallengeFailed)?;
        let embedding = as_slice(&outputs[0])?.to_vec();
        Ok(l2_normalize(embedding))
    })
}

// Non-reflective 2D similarity transform [a -b tx; b a ty] mapping src -> dst
// by least squares (the standard ArcFace alignment estimator)
pub struct Similarity {
    a: f32,
    b: f32,
    tx: f32,
    ty: f32,
}

pub fn similarity_transform(src: &[[f32; 2]; 5], dst: &[[f32; 2]; 5]) -> Similarity {
    let n = src.len() as f32;
    let mean = |pts: &[[f32; 2]; 5]| {
        let (mut mx, mut my) = (0f32, 0f32);
        for p in pts {
            mx += p[0];
            my += p[1];
        }
        [mx / n, my / n]
    };
    let ms = mean(src);
    let md = mean(dst);
    let (mut num_a, mut num_b, mut den) = (0f32, 0f32, 0f32);
    for (s, d) in src.iter().zip(dst.iter()) {
        let sx = s[0] - ms[0];
        let sy = s[1] - ms[1];
        let dx = d[0] - md[0];
        let dy = d[1] - md[1];
        num_a += sx * dx + sy * dy;
        num_b += sx * dy - sy * dx;
        den += sx * sx + sy * sy;
    }
    let a = if den > 0.0 { num_a / den } else { 1.0 };
    let b = if den > 0.0 { num_b / den } else { 0.0 };
    let tx = md[0] - (a * ms[0] - b * ms[1]);
    let ty = md[1] - (b * ms[0] + a * ms[1]);
    Similarity { a, b, tx, ty }
}

fn warp_bilinear(image: &Rgb, t: &Similarity, out_w: usize, out_h: usize) -> Vec<u8> {
    // Invert the similarity: src = R^-1 (dst - t)
    let det = t.a * t.a + t.b * t.b;
    let (ia, ib) = if det > 0.0 { (t.a / det, -t.b / det) } else { (1.0, 0.0) };
    let mut out = vec![0u8; out_w * out_h * 3];
    for y in 0..out_h {
        for x in 0..out_w {
            let dx = x as f32 - t.tx;
            let dy = y as f32 - t.ty;
            let sx = ia * dx - ib * dy;
            let sy = ib * dx + ia * dy;
            let sample = sample_bilinear(image, sx, sy);
            let o = (y * out_w + x) * 3;
            out[o..o + 3].copy_from_slice(&sample);
        }
    }
    out
}

fn sample_bilinear(image: &Rgb, x: f32, y: f32) -> [u8; 3] {
    if x < 0.0 || y < 0.0 || x >= (image.width - 1) as f32 || y >= (image.height - 1) as f32 {
        return [0, 0, 0];
    }
    let x0 = x as usize;
    let y0 = y as usize;
    let fx = x - x0 as f32;
    let fy = y - y0 as f32;
    let mut out = [0u8; 3];
    for c in 0..3 {
        let p00 = image.pixels[(y0 * image.width + x0) * 3 + c] as f32;
        let p10 = image.pixels[(y0 * image.width + x0 + 1) * 3 + c] as f32;
        let p01 = image.pixels[((y0 + 1) * image.width + x0) * 3 + c] as f32;
        let p11 = image.pixels[((y0 + 1) * image.width + x0 + 1) * 3 + c] as f32;
        let value = p00 * (1.0 - fx) * (1.0 - fy) + p10 * fx * (1.0 - fy) + p01 * (1.0 - fx) * fy + p11 * fx * fy;
        out[c] = value.round().clamp(0.0, 255.0) as u8;
    }
    out
}

fn resize_bilinear(image: &Rgb, out_w: usize, out_h: usize) -> Rgb {
    let mut pixels = vec![0u8; out_w * out_h * 3];
    for y in 0..out_h {
        for x in 0..out_w {
            let sx = x as f32 * image.width as f32 / out_w as f32;
            let sy = y as f32 * image.height as f32 / out_h as f32;
            let sample = sample_bilinear(image, sx, sy);
            let o = (y * out_w + x) * 3;
            pixels[o..o + 3].copy_from_slice(&sample);
        }
    }
    Rgb {
        width: out_w,
        height: out_h,
        pixels,
    }
}

pub fn l2_normalize(mut v: Vec<f32>) -> Vec<f32> {
    let norm = v.iter().map(|x| x * x).sum::<f32>().sqrt();
    if norm > 0.0 {
        for x in v.iter_mut() {
            *x /= norm;
        }
    }
    v
}

pub fn cosine_f32(a: &[f32], b: &[f32]) -> f32 {
    a.iter().zip(b).map(|(x, y)| x * y).sum()
}

pub fn quantize_i8(v: &[f32]) -> Vec<i8> {
    let max = v.iter().fold(0f32, |acc, x| acc.max(x.abs()));
    if max == 0.0 {
        return vec![0; v.len()];
    }
    v.iter()
        .map(|x| ((x / max) * 127.0).round().clamp(-127.0, 127.0) as i8)
        .collect()
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

    #[test]
    fn similarity_transform_maps_template_onto_itself() {
        let t = similarity_transform(&ARCFACE_TEMPLATE, &ARCFACE_TEMPLATE);
        assert!((t.a - 1.0).abs() < 1e-4 && t.b.abs() < 1e-4);
        assert!(t.tx.abs() < 1e-3 && t.ty.abs() < 1e-3);
    }

    #[test]
    fn similarity_transform_recovers_translation_and_scale() {
        let mut moved = ARCFACE_TEMPLATE;
        for p in moved.iter_mut() {
            p[0] = p[0] * 2.0 + 10.0;
            p[1] = p[1] * 2.0 + 20.0;
        }
        let t = similarity_transform(&moved, &ARCFACE_TEMPLATE);
        // maps moved -> template: scale 0.5, translation -5/-10
        for (s, d) in moved.iter().zip(ARCFACE_TEMPLATE.iter()) {
            let x = t.a * s[0] - t.b * s[1] + t.tx;
            let y = t.b * s[0] + t.a * s[1] + t.ty;
            assert!((x - d[0]).abs() < 1e-3, "{x} vs {}", d[0]);
            assert!((y - d[1]).abs() < 1e-3, "{y} vs {}", d[1]);
        }
    }

    #[test]
    fn pose_signs_match_frontend_convention() {
        // Frontal reference face
        let frontal = DetectedFace {
            keypoints: [[40.0, 50.0], [72.0, 50.0], [56.0, 70.0], [44.0, 90.0], [68.0, 90.0]],
        };
        let (yaw, pitch) = estimate_pose(&frontal);
        assert!(
            yaw.abs() < CENTER_MAX_DEGREES && pitch.abs() < CENTER_MAX_DEGREES,
            "{yaw} {pitch}"
        );
        assert!(pose_matches(HeadPose::Center, yaw, pitch));

        // Subject turns their left: nose moves towards image-right
        let turned_left = DetectedFace {
            keypoints: [[40.0, 50.0], [72.0, 50.0], [68.0, 70.0], [44.0, 90.0], [68.0, 90.0]],
        };
        let (yaw, _) = estimate_pose(&turned_left);
        assert!(yaw < -TURN_MIN_DEGREES, "{yaw}");
        assert!(pose_matches(HeadPose::Left, yaw, 0.0));

        // Tilting up raises the nose relative to eyes/mouth
        let tilted_up = DetectedFace {
            keypoints: [[40.0, 50.0], [72.0, 50.0], [56.0, 62.0], [44.0, 90.0], [68.0, 90.0]],
        };
        let (_, pitch) = estimate_pose(&tilted_up);
        assert!(pitch > TILT_MIN_DEGREES, "{pitch}");
        assert!(pose_matches(HeadPose::Up, 0.0, pitch));
    }

    #[test]
    fn quantized_cosine_tracks_f32_cosine() {
        let a = l2_normalize((0..512).map(|i| ((i * 37) % 101) as f32 - 50.0).collect());
        let b = l2_normalize((0..512).map(|i| ((i * 53) % 97) as f32 - 48.0).collect());
        let qa = quantize_i8(&a);
        let qb = quantize_i8(&b);
        let f32_cos = cosine_f32(&a, &b);
        let q_cos = crate::model::embeddings::cosine_similarity(&qa, &qb);
        assert!((f32_cos - q_cos).abs() < 0.02, "{f32_cos} vs {q_cos}");
    }
}
