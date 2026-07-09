use crate::model::models::ModelStore;
use personhood_verifier_canister::{HeadPose, ModelKind, VerificationFailureReason};
use std::cell::RefCell;
use tract_onnx::prelude::*;

// Real pipeline: JPEG decode -> UltraFace RFB-320 face detection ->
// insightface 2d106det facial landmarks on the face crop -> pose-challenge
// verification from landmark geometry -> 5-point similarity alignment ->
// w600k_mbf (MobileFaceNet/ArcFace) 512-dim embedding.
//
// Note: SCRFD was tried for detection+keypoints in one model but tract
// miscompiles its graph (nondeterministic outputs, shape-inference failures
// on Add_109), so detection uses UltraFace - the model proven with tract in
// DFINITY's face-recognition example - with 2d106det supplying landmarks.

const DET_W: usize = 320;
const DET_H: usize = 240;
const DET_SCORE_THRESHOLD: f32 = 0.7;
const SECOND_FACE_THRESHOLD: f32 = 0.85;
const NMS_IOU_THRESHOLD: f32 = 0.4;
const LMK_INPUT: usize = 192;
// Crop a region this many times the detection box's longest side for the
// landmark model (insightface convention)
const LMK_CROP_EXPANSION: f32 = 1.5;
const EMBED_INPUT: usize = 112;

// 5-point extraction from the 106-landmark set: eye centres, nose, mouth
// corners. Indices derived empirically from the model's output on a real
// portrait (validated in the tests below): 33-42 form the left-eye ring with
// 38 at its centre, 87-96 the right-eye ring with 88 at its centre.
const LMK_LEFT_EYE: usize = 38;
const LMK_RIGHT_EYE: usize = 88;
const LMK_NOSE: usize = 86;
const LMK_MOUTH_LEFT: usize = 52;
const LMK_MOUTH_RIGHT: usize = 61;

// The challenge always starts with a Center step, whose measured pose
// becomes the session's neutral baseline; every later step is classified by
// its DELTA from that baseline. Device telemetry showed absolute pitch on
// genuine frontal frames varying +4..+20 degrees with camera elevation, so
// absolute thresholds cannot work; deltas cancel the bias (observed genuine
// deltas: Up +45, Left -52, Right +71, closing Center -4). Same sign
// convention as the frontend (poseDetector.ts): yaw < 0 = subject turning
// their left, pitch > 0 = tilting up.
const NEUTRAL_MAX_YAW: f32 = 25.0;
const NEUTRAL_MIN_PITCH: f32 = -25.0;
const NEUTRAL_MAX_PITCH: f32 = 35.0;
const DELTA_CENTER_MAX: f32 = 12.0;
const DELTA_TURN_MIN: f32 = 12.0;
const DELTA_TILT_MIN: f32 = 12.0;

// Geometric pose calibration from the 5 keypoints - crude but adequate for
// classifying the challenge poses. The nose tip projects roughly 0.5-0.7 of
// the eye distance in front of the eye line, so the raw offset ratio
// understates the true angle; the gains compensate.
const YAW_GAIN: f32 = 90.0;
const PITCH_GAIN: f32 = 120.0;
const PITCH_NEUTRAL_RATIO: f32 = 0.60;

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
    landmarker: Model,
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

// Parses + optimizes the models. ~3B instructions, called from commit_model
// and lazily after upgrades.
pub fn build_engines(models: &ModelStore) -> Result<(), String> {
    let detector = build_detector(&models.assemble(ModelKind::Detection))?;
    let landmarker = build_landmarker(&models.assemble(ModelKind::Landmarks))?;
    let embedder = build_model(&models.assemble(ModelKind::Embedding), EMBED_INPUT, EMBED_INPUT)?;
    ENGINES.with_borrow_mut(|e| {
        *e = Some(Engines {
            detector,
            landmarker,
            embedder,
        })
    });
    Ok(())
}

pub fn validate_model(bytes: &[u8], kind: ModelKind) -> Result<(), String> {
    match kind {
        ModelKind::Detection => build_detector(bytes).map(|_| ()),
        ModelKind::Landmarks => build_landmarker(bytes).map(|_| ()),
        ModelKind::Embedding => build_model(bytes, EMBED_INPUT, EMBED_INPUT).map(|_| ()),
    }
}

fn build_detector(bytes: &[u8]) -> Result<Model, String> {
    let model = build_model(bytes, DET_H, DET_W)?;
    if model.model().outputs.len() != 2 {
        return Err(format!(
            "Detection model must have 2 outputs (UltraFace scores + boxes), found {}",
            model.model().outputs.len()
        ));
    }
    Ok(model)
}

fn build_landmarker(bytes: &[u8]) -> Result<Model, String> {
    let model = build_model(bytes, LMK_INPUT, LMK_INPUT)?;
    if model.model().outputs.len() != 1 {
        return Err(format!(
            "Landmark model must have 1 output (2d106det), found {}",
            model.model().outputs.len()
        ));
    }
    Ok(model)
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

// Detects the single face in the frame (UltraFace), then locates its
// landmarks (2d106det); errors if no face or more than one confident face
pub fn detect_face(image: &Rgb) -> Result<DetectedFace, VerificationFailureReason> {
    let bbox = with_engines(|engines| {
        // UltraFace stretches the frame to 320x240 without preserving aspect
        // ratio; boxes come back in normalized [0,1] coordinates
        let resized = resize_bilinear(image, DET_W, DET_H);
        let mut input = vec![0f32; 3 * DET_H * DET_W];
        for i in 0..(DET_H * DET_W) {
            for c in 0..3 {
                input[c * DET_H * DET_W + i] = (resized.pixels[i * 3 + c] as f32 - 127.0) / 128.0;
            }
        }
        let tensor =
            Tensor::from_shape(&[1, 3, DET_H, DET_W], &input).map_err(|_| VerificationFailureReason::ChallengeFailed)?;
        let outputs = engines
            .detector
            .run(tvec!(tensor.into_tvalue()))
            .map_err(|_| VerificationFailureReason::ChallengeFailed)?;

        let scores = as_slice(&outputs[0])?;
        let boxes = as_slice(&outputs[1])?;
        let candidates = ultraface_decode(scores, boxes, image.width as f32, image.height as f32);
        let kept = drop_containing_duplicates(nms(candidates));
        match kept.len() {
            0 => Err(VerificationFailureReason::NoFaceDetected),
            1 => Ok(kept[0].bbox),
            _ => {
                // More than one confident face fails the challenge
                if kept.iter().filter(|c| c.score >= SECOND_FACE_THRESHOLD).count() > 1 {
                    Err(VerificationFailureReason::ChallengeFailed)
                } else {
                    Ok(kept[0].bbox)
                }
            }
        }
    })?;

    let keypoints = locate_keypoints(image, &bbox)?;
    Ok(DetectedFace { keypoints })
}

struct Candidate {
    score: f32,
    bbox: [f32; 4],
}

// UltraFace RFB-320 decode: 4420 SSD priors over feature maps
// [40x30, 20x15, 10x8, 5x4], centre-form regression with variances 0.1/0.2;
// scores are already softmaxed (column 1 = face)
fn ultraface_decode(scores: &[f32], boxes: &[f32], src_w: f32, src_h: f32) -> Vec<Candidate> {
    const SHRINKAGES: [usize; 4] = [8, 16, 32, 64];
    const MIN_BOXES: [&[f32]; 4] = [&[10.0, 16.0, 24.0], &[32.0, 48.0], &[64.0, 96.0], &[128.0, 192.0, 256.0]];
    const CENTER_VARIANCE: f32 = 0.1;
    const SIZE_VARIANCE: f32 = 0.2;

    let mut candidates = Vec::new();
    let mut index = 0;
    for (level, shrink) in SHRINKAGES.iter().enumerate() {
        let fm_w = DET_W.div_ceil(*shrink);
        let fm_h = DET_H.div_ceil(*shrink);
        for j in 0..fm_h {
            for i in 0..fm_w {
                for min_box in MIN_BOXES[level] {
                    let score = scores[index * 2 + 1];
                    if score >= DET_SCORE_THRESHOLD {
                        let prior_cx = (i as f32 + 0.5) / fm_w as f32;
                        let prior_cy = (j as f32 + 0.5) / fm_h as f32;
                        let prior_w = min_box / DET_W as f32;
                        let prior_h = min_box / DET_H as f32;
                        let cx = boxes[index * 4] * CENTER_VARIANCE * prior_w + prior_cx;
                        let cy = boxes[index * 4 + 1] * CENTER_VARIANCE * prior_h + prior_cy;
                        let w = (boxes[index * 4 + 2] * SIZE_VARIANCE).exp() * prior_w;
                        let h = (boxes[index * 4 + 3] * SIZE_VARIANCE).exp() * prior_h;
                        candidates.push(Candidate {
                            score,
                            bbox: [
                                (cx - w / 2.0) * src_w,
                                (cy - h / 2.0) * src_h,
                                (cx + w / 2.0) * src_w,
                                (cy + h / 2.0) * src_h,
                            ],
                        });
                    }
                    index += 1;
                }
            }
        }
    }
    candidates
}

// Runs 2d106det over an expanded crop of the detection box and extracts the
// 5 alignment keypoints in source-image pixels
fn locate_keypoints(image: &Rgb, bbox: &[f32; 4]) -> Result<[[f32; 2]; 5], VerificationFailureReason> {
    with_engines(|engines| {
        let center_x = (bbox[0] + bbox[2]) / 2.0;
        let center_y = (bbox[1] + bbox[3]) / 2.0;
        let size = (bbox[2] - bbox[0]).max(bbox[3] - bbox[1]) * LMK_CROP_EXPANSION;
        if size <= 1.0 {
            return Err(VerificationFailureReason::NoFaceDetected);
        }
        let scale = LMK_INPUT as f32 / size;
        // Maps source -> crop: crop = scale * src + t
        let transform = Similarity {
            a: scale,
            b: 0.0,
            tx: LMK_INPUT as f32 / 2.0 - scale * center_x,
            ty: LMK_INPUT as f32 / 2.0 - scale * center_y,
        };
        let crop = warp_bilinear(image, &transform, LMK_INPUT, LMK_INPUT);

        // 2d106det takes raw 0-255 pixel values (input_mean 0, input_std 1)
        let mut input = vec![0f32; 3 * LMK_INPUT * LMK_INPUT];
        for i in 0..(LMK_INPUT * LMK_INPUT) {
            for c in 0..3 {
                input[c * LMK_INPUT * LMK_INPUT + i] = crop[i * 3 + c] as f32;
            }
        }
        let tensor = Tensor::from_shape(&[1, 3, LMK_INPUT, LMK_INPUT], &input)
            .map_err(|_| VerificationFailureReason::ChallengeFailed)?;
        let outputs = engines
            .landmarker
            .run(tvec!(tensor.into_tvalue()))
            .map_err(|_| VerificationFailureReason::ChallengeFailed)?;
        let landmarks = as_slice(&outputs[0])?;
        if landmarks.len() < 212 {
            return Err(VerificationFailureReason::ChallengeFailed);
        }

        // Output is 106 (x, y) pairs in [-1, 1] crop space
        let point = |idx: usize| -> [f32; 2] {
            let cx = (landmarks[idx * 2] + 1.0) * (LMK_INPUT as f32 / 2.0);
            let cy = (landmarks[idx * 2 + 1] + 1.0) * (LMK_INPUT as f32 / 2.0);
            // crop -> source
            [(cx - transform.tx) / scale, (cy - transform.ty) / scale]
        };
        Ok([
            point(LMK_LEFT_EYE),
            point(LMK_RIGHT_EYE),
            point(LMK_NOSE),
            point(LMK_MOUTH_LEFT),
            point(LMK_MOUTH_RIGHT),
        ])
    })
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

// UltraFace's coarse prior level often fires a second, much larger box
// around the same face which union-IoU NMS does not suppress. When one box
// essentially contains another, keep the tighter one (the coarse duplicate
// carries no extra information); genuinely separate faces remain untouched.
fn drop_containing_duplicates(kept: Vec<Candidate>) -> Vec<Candidate> {
    const CONTAINMENT_THRESHOLD: f32 = 0.7;
    let mut result: Vec<Candidate> = Vec::new();
    'outer: for c in kept.into_iter() {
        let area_c = area(&c.bbox);
        for r in result.iter_mut() {
            let inter = intersection(&r.bbox, &c.bbox);
            let containment = inter / area(&r.bbox).min(area_c).max(1.0);
            if containment > CONTAINMENT_THRESHOLD {
                // Same face: keep whichever box is tighter
                if area_c < area(&r.bbox) {
                    *r = c;
                }
                continue 'outer;
            }
        }
        result.push(c);
    }
    result
}

fn area(b: &[f32; 4]) -> f32 {
    (b[2] - b[0]).max(0.0) * (b[3] - b[1]).max(0.0)
}

fn intersection(a: &[f32; 4], b: &[f32; 4]) -> f32 {
    let x1 = a[0].max(b[0]);
    let y1 = a[1].max(b[1]);
    let x2 = a[2].min(b[2]);
    let y2 = a[3].min(b[3]);
    (x2 - x1).max(0.0) * (y2 - y1).max(0.0)
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
        for (s, d) in moved.iter().zip(ARCFACE_TEMPLATE.iter()) {
            let x = t.a * s[0] - t.b * s[1] + t.tx;
            let y = t.b * s[0] + t.a * s[1] + t.ty;
            assert!((x - d[0]).abs() < 1e-3, "{x} vs {}", d[0]);
            assert!((y - d[1]).abs() < 1e-3, "{y} vs {}", d[1]);
        }
    }

    #[test]
    fn pose_signs_match_frontend_convention() {
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

        // Returning to centre is a small delta; a big tilt is not "centre"
        assert!(pose_delta_matches(HeadPose::Center, 0.5, -1.0));
        assert!(!pose_delta_matches(HeadPose::Center, 0.5, 20.0));
    }

    #[test]
    fn containing_duplicate_boxes_collapse_to_the_tighter_one() {
        let giant = Candidate {
            score: 1.0,
            bbox: [70.0, -45.0, 384.0, 506.0],
        };
        let tight = Candidate {
            score: 0.93,
            bbox: [125.0, 128.0, 280.0, 403.0],
        };
        let kept = drop_containing_duplicates(vec![giant, tight]);
        assert_eq!(kept.len(), 1);
        assert_eq!(kept[0].bbox[0], 125.0);

        // Genuinely separate faces stay separate
        let a = Candidate {
            score: 0.9,
            bbox: [0.0, 0.0, 100.0, 100.0],
        };
        let b = Candidate {
            score: 0.9,
            bbox: [200.0, 0.0, 300.0, 100.0],
        };
        assert_eq!(drop_containing_duplicates(vec![a, b]).len(), 2);
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

#[cfg(test)]
mod pipeline_tests {
    use super::*;
    use personhood_verifier_canister::HeadPose;
    use std::path::PathBuf;

    fn load_engines() -> Option<Vec<u8>> {
        let dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../../personhood_spike/models");
        let det = std::fs::read(dir.join("version-RFB-320.onnx")).ok()?;
        let lmk = std::fs::read(dir.join("2d106det.onnx")).ok()?;
        let emb = std::fs::read(dir.join("w600k_mbf.onnx")).ok()?;
        let img = std::fs::read(dir.join("test_face.jpg")).ok()?;
        let detector = build_detector(&det).unwrap();
        let landmarker = build_landmarker(&lmk).unwrap();
        let embedder = build_model(&emb, EMBED_INPUT, EMBED_INPUT).unwrap();
        ENGINES.with_borrow_mut(|e| {
            *e = Some(Engines {
                detector,
                landmarker,
                embedder,
            })
        });
        Some(img)
    }

    // End-to-end over a real frontal portrait. Skips when the model fixtures
    // (gitignored, ~20MB) are absent - run
    // scripts/download-personhood-spike-models.sh and place a frontal
    // portrait at models/test_face.jpg to enable.
    #[test]
    fn real_pipeline_detects_and_embeds_test_photo() {
        let Some(img) = load_engines() else {
            eprintln!("skipping: model fixtures not present");
            return;
        };
        let image = decode_jpeg(&img).expect("decode failed");

        let face = detect_face(&image).expect("no face detected in a frontal portrait");
        println!("keypoints: {:?}", face.keypoints);
        let [le, re, nose, ml, mr] = face.keypoints;
        // Sanity-check the 106-point index mapping via geometry
        assert!(le[0] < re[0], "eyes swapped: {le:?} {re:?}");
        assert!(ml[0] < mr[0], "mouth corners swapped: {ml:?} {mr:?}");
        assert!(le[1] < nose[1] && re[1] < nose[1], "eyes should be above the nose");
        assert!(ml[1] > nose[1] && mr[1] > nose[1], "mouth should be below the nose");

        let (yaw, pitch) = estimate_pose(&face);
        println!("yaw: {yaw} pitch: {pitch}");
        assert!(
            neutral_plausible(yaw, pitch),
            "frontal portrait should be a plausible neutral pose (yaw {yaw}, pitch {pitch})"
        );

        let embedding = embed_face(&image, &face).expect("embed failed");
        assert_eq!(embedding.len(), 512);
        let norm: f32 = embedding.iter().map(|x| x * x).sum::<f32>().sqrt();
        assert!((norm - 1.0).abs() < 0.01, "embedding should be L2-normalized, norm {norm}");

        // Determinism across repeated runs (the SCRFD failure mode)
        let embedding2 = embed_face(&image, &face).expect("embed rerun failed");
        assert_eq!(embedding, embedding2, "pipeline must be deterministic");
    }
}

#[cfg(test)]
mod model_sanity_tests {
    use super::*;
    use std::path::PathBuf;

    fn check(file: &str, shape: [usize; 4]) {
        let dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../../personhood_spike/models");
        let Ok(bytes) = std::fs::read(dir.join(file)) else {
            eprintln!("skipping {file}");
            return;
        };
        let model = build_model(&bytes, shape[2], shape[3]).unwrap();
        let len = shape.iter().product();
        let input: Vec<f32> = (0..len).map(|i| ((i * 37) % 256) as f32 / 255.0 - 0.5).collect();
        let t1 = Tensor::from_shape(&shape, &input).unwrap();
        let t2 = Tensor::from_shape(&shape, &input).unwrap();
        let o1 = model.run(tvec!(t1.into_tvalue())).unwrap();
        let o2 = model.run(tvec!(t2.into_tvalue())).unwrap();
        for (i, (a, b)) in o1.iter().zip(o2.iter()).enumerate() {
            let a = a.as_slice::<f32>().unwrap();
            let b = b.as_slice::<f32>().unwrap();
            let diff = a.iter().zip(b).map(|(x, y)| (x - y).abs()).fold(0f32, f32::max);
            assert_eq!(diff, 0.0, "{file} output {i} nondeterministic");
        }
    }

    #[test]
    fn ultraface_deterministic() {
        check("version-RFB-320.onnx", [1, 3, 240, 320]);
    }

    #[test]
    fn landmarks_2d106_deterministic() {
        check("2d106det.onnx", [1, 3, 192, 192]);
    }

    #[test]
    fn embedder_deterministic() {
        check("w600k_mbf.onnx", [1, 3, 112, 112]);
    }
}
