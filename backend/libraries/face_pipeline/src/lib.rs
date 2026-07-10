//! Face verification ML pipeline, shared by the personhood_verifier canister
//! and the offline threshold-calibration tool so both run byte-identical code.
//!
//! JPEG decode -> UltraFace RFB-320 face detection -> insightface 2d106det
//! facial landmarks on the face crop -> pose estimation from landmark
//! geometry -> 5-point similarity alignment to the ArcFace template ->
//! w600k_mbf (MobileFaceNet/ArcFace) 512-dim embedding.
//!
//! Note: SCRFD was tried for detection+keypoints in one model but tract
//! miscompiles its graph (nondeterministic outputs, shape-inference failures
//! on Add_109), so detection uses UltraFace - the model proven with tract in
//! DFINITY's face-recognition example - with 2d106det supplying landmarks.

use tract_onnx::prelude::*;

const DET_W: usize = 320;
const DET_H: usize = 240;
const DET_SCORE_THRESHOLD: f32 = 0.7;
const SECOND_FACE_THRESHOLD: f32 = 0.85;
const LMK_INPUT: usize = 192;
// Crop a region this many times the detection box's longest side for the
// landmark model (insightface convention)
const LMK_CROP_EXPANSION: f32 = 1.5;
const EMBED_INPUT: usize = 112;

// 5-point extraction from the 106-landmark set: eye centres, nose, mouth
// corners. Indices derived empirically from the model's output on a real
// portrait (validated in the tests): 33-42 form the left-eye ring with 38 at
// its centre, 87-96 the right-eye ring with 88 at its centre.
const LMK_LEFT_EYE: usize = 38;
const LMK_RIGHT_EYE: usize = 88;
const LMK_NOSE: usize = 86;
const LMK_MOUTH_LEFT: usize = 52;
const LMK_MOUTH_RIGHT: usize = 61;

// Geometric pose calibration from the 5 keypoints - crude but adequate for
// classifying the challenge poses. The nose tip projects roughly 0.5-0.7 of
// the eye distance in front of the eye line, so the raw offset ratio
// understates the true angle; the gains compensate. Sign convention matches
// the frontend (poseDetector.ts): yaw < 0 = subject turning their left,
// pitch > 0 = tilting up.
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

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PipelineError {
    DecodeFailed,
    NoFace,
    MultipleFaces,
    InferenceFailed,
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

pub struct Engines {
    detector: Model,
    landmarker: Model,
    embedder: Model,
}

impl Engines {
    pub fn build(detector: &[u8], landmarker: &[u8], embedder: &[u8]) -> Result<Engines, String> {
        Ok(Engines {
            detector: build_detector(detector)?,
            landmarker: build_landmarker(landmarker)?,
            embedder: build_model(embedder, EMBED_INPUT, EMBED_INPUT)?,
        })
    }

    // Runs the detector and returns one representative box per distinct
    // face scoring at least `min_score` (highest score first)
    fn run_detector(&self, image: &Rgb, min_score: f32) -> Result<Vec<Candidate>, PipelineError> {
        // UltraFace stretches the frame to 320x240 without preserving aspect
        // ratio; boxes come back in normalized [0,1] coordinates
        let resized = resize_bilinear(image, DET_W, DET_H);
        let mut input = vec![0f32; 3 * DET_H * DET_W];
        for i in 0..(DET_H * DET_W) {
            for c in 0..3 {
                input[c * DET_H * DET_W + i] = (resized.pixels[i * 3 + c] as f32 - 127.0) / 128.0;
            }
        }
        let tensor = Tensor::from_shape(&[1, 3, DET_H, DET_W], &input).map_err(|_| PipelineError::InferenceFailed)?;
        let outputs = self
            .detector
            .run(tvec!(tensor.into_tvalue()))
            .map_err(|_| PipelineError::InferenceFailed)?;

        let scores = as_slice(&outputs[0])?;
        let boxes = as_slice(&outputs[1])?;
        let candidates = ultraface_decode(scores, boxes, image.width as f32, image.height as f32, min_score);
        Ok(cluster_faces(candidates, image.width as f32, image.height as f32))
    }

    // Detects the single face in the frame (UltraFace), then locates its
    // landmarks (2d106det); errors if no face or more than one *separate* face
    pub fn detect_face(&self, image: &Rgb) -> Result<DetectedFace, PipelineError> {
        let faces = self.run_detector(image, DET_SCORE_THRESHOLD)?;
        let Some(primary) = faces.first() else {
            return Err(PipelineError::NoFace);
        };
        // cluster_faces already collapses one face's overlapping boxes to a
        // single representative, so a second entry is a genuinely separate
        // face - reject only if it too is confident
        if faces[1..].iter().any(|f| f.score >= SECOND_FACE_THRESHOLD) {
            return Err(PipelineError::MultipleFaces);
        }

        let keypoints = self.locate_keypoints(image, &primary.bbox)?;
        Ok(DetectedFace { keypoints })
    }

    // Runs 2d106det over an expanded crop of the detection box and extracts
    // the 5 alignment keypoints in source-image pixels
    fn locate_keypoints(&self, image: &Rgb, bbox: &[f32; 4]) -> Result<[[f32; 2]; 5], PipelineError> {
        let center_x = (bbox[0] + bbox[2]) / 2.0;
        let center_y = (bbox[1] + bbox[3]) / 2.0;
        let size = (bbox[2] - bbox[0]).max(bbox[3] - bbox[1]) * LMK_CROP_EXPANSION;
        if size <= 1.0 {
            return Err(PipelineError::NoFace);
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
        let tensor = Tensor::from_shape(&[1, 3, LMK_INPUT, LMK_INPUT], &input).map_err(|_| PipelineError::InferenceFailed)?;
        let outputs = self
            .landmarker
            .run(tvec!(tensor.into_tvalue()))
            .map_err(|_| PipelineError::InferenceFailed)?;
        let landmarks = as_slice(&outputs[0])?;
        if landmarks.len() < 212 {
            return Err(PipelineError::InferenceFailed);
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
    }

    // Diagnostic: the clustered face boxes, highest score first
    pub fn debug_candidates(&self, image: &Rgb) -> Vec<(f32, [f32; 4])> {
        let resized = resize_bilinear(image, DET_W, DET_H);
        let mut input = vec![0f32; 3 * DET_H * DET_W];
        for i in 0..(DET_H * DET_W) {
            for c in 0..3 {
                input[c * DET_H * DET_W + i] = (resized.pixels[i * 3 + c] as f32 - 127.0) / 128.0;
            }
        }
        let Ok(tensor) = Tensor::from_shape(&[1, 3, DET_H, DET_W], &input) else {
            return vec![];
        };
        let Ok(outputs) = self.detector.run(tvec!(tensor.into_tvalue())) else {
            return vec![];
        };
        let (Ok(scores), Ok(boxes)) = (as_slice(&outputs[0]), as_slice(&outputs[1])) else {
            return vec![];
        };
        let cands = ultraface_decode(scores, boxes, image.width as f32, image.height as f32, DET_SCORE_THRESHOLD);
        cluster_faces(cands, image.width as f32, image.height as f32)
            .iter()
            .map(|c| (c.score, c.bbox))
            .collect()
    }

    // Diagnostic: the real detect_face outcome for this frame
    pub fn detect_debug(&self, image: &Rgb) -> &'static str {
        match self.detect_face(image) {
            Ok(_) => "ok",
            Err(PipelineError::NoFace) => "no_face",
            Err(PipelineError::MultipleFaces) => "multi_face",
            Err(PipelineError::InferenceFailed) => "inference_failed",
            Err(PipelineError::DecodeFailed) => "decode_failed",
        }
    }

    // Aligns via 5-point similarity transform to the ArcFace template and
    // returns the L2-normalized 512-dim embedding. This w600k_mbf ONNX export
    // takes RGB - calibration measured BGR as consistently worse (genuine
    // median 0.580 vs 0.607).
    pub fn embed_face(&self, image: &Rgb, face: &DetectedFace) -> Result<Vec<f32>, PipelineError> {
        self.embed_face_variant(image, face, false)
    }

    pub fn embed_face_variant(&self, image: &Rgb, face: &DetectedFace, bgr: bool) -> Result<Vec<f32>, PipelineError> {
        let transform = similarity_transform(&face.keypoints, &ARCFACE_TEMPLATE);
        let aligned = warp_bilinear(image, &transform, EMBED_INPUT, EMBED_INPUT);

        let mut input = vec![0f32; 3 * EMBED_INPUT * EMBED_INPUT];
        for i in 0..(EMBED_INPUT * EMBED_INPUT) {
            for c in 0..3 {
                let src_c = if bgr { 2 - c } else { c };
                input[c * EMBED_INPUT * EMBED_INPUT + i] = (aligned[i * 3 + src_c] as f32 - 127.5) / 127.5;
            }
        }
        let tensor =
            Tensor::from_shape(&[1, 3, EMBED_INPUT, EMBED_INPUT], &input).map_err(|_| PipelineError::InferenceFailed)?;
        let outputs = self
            .embedder
            .run(tvec!(tensor.into_tvalue()))
            .map_err(|_| PipelineError::InferenceFailed)?;
        let embedding = as_slice(&outputs[0])?.to_vec();
        Ok(l2_normalize(embedding))
    }
}

pub fn build_detector(bytes: &[u8]) -> Result<Model, String> {
    let model = build_model(bytes, DET_H, DET_W)?;
    if model.model().outputs.len() != 2 {
        return Err(format!(
            "Detection model must have 2 outputs (UltraFace scores + boxes), found {}",
            model.model().outputs.len()
        ));
    }
    Ok(model)
}

pub fn build_landmarker(bytes: &[u8]) -> Result<Model, String> {
    let model = build_model(bytes, LMK_INPUT, LMK_INPUT)?;
    if model.model().outputs.len() != 1 {
        return Err(format!(
            "Landmark model must have 1 output (2d106det), found {}",
            model.model().outputs.len()
        ));
    }
    Ok(model)
}

pub fn build_embedder(bytes: &[u8]) -> Result<Model, String> {
    build_model(bytes, EMBED_INPUT, EMBED_INPUT)
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

// Hard ceiling on decoded dimensions. Selfie-capture frames are far smaller;
// this bounds decode cost so a crafted, highly-compressible large image (which
// can fit inside the frame byte cap yet expand to hundreds of megapixels)
// cannot blow the per-message instruction budget. zune checks this against the
// SOF header and bails before decoding, so the rejection is cheap.
pub const MAX_DECODE_DIM: usize = 2048;

pub fn decode_jpeg(bytes: &[u8]) -> Result<Rgb, PipelineError> {
    let options = zune_jpeg::zune_core::options::DecoderOptions::default()
        .jpeg_set_out_colorspace(zune_jpeg::zune_core::colorspace::ColorSpace::RGB)
        .set_max_width(MAX_DECODE_DIM)
        .set_max_height(MAX_DECODE_DIM);
    let mut decoder = zune_jpeg::JpegDecoder::new_with_options(bytes, options);
    let pixels = decoder.decode().map_err(|_| PipelineError::DecodeFailed)?;
    let (width, height) = decoder.dimensions().ok_or(PipelineError::DecodeFailed)?;
    // Degenerate dimensions would underflow the width-1/height-1 bounds in
    // sample_bilinear; reject rather than risk an out-of-bounds index
    if width < 2 || height < 2 {
        return Err(PipelineError::DecodeFailed);
    }
    Ok(Rgb { width, height, pixels })
}

// Reads (width, height) from the first Start-Of-Frame marker without decoding
// the image, so an oversized frame can be rejected at the untrusted boundary
// before it ever reaches the decoder. Returns None if no SOF is found.
pub fn jpeg_dimensions(bytes: &[u8]) -> Option<(u16, u16)> {
    let mut i = 2; // skip SOI (FF D8)
    while i + 9 < bytes.len() {
        if bytes[i] != 0xFF {
            i += 1;
            continue;
        }
        let marker = bytes[i + 1];
        // SOF0..SOF15 carry the frame dimensions, except the non-frame markers
        // DHT (C4), JPG (C8) and DAC (CC)
        if (0xC0..=0xCF).contains(&marker) && marker != 0xC4 && marker != 0xC8 && marker != 0xCC {
            let height = u16::from_be_bytes([bytes[i + 5], bytes[i + 6]]);
            let width = u16::from_be_bytes([bytes[i + 7], bytes[i + 8]]);
            return Some((width, height));
        }
        // Standalone markers (RSTn, SOI, EOI, TEM) have no length field
        if marker == 0xD8 || marker == 0xD9 || (0xD0..=0xD7).contains(&marker) || marker == 0x01 {
            i += 2;
            continue;
        }
        // Every other marker is followed by a big-endian segment length
        let len = u16::from_be_bytes([bytes[i + 2], bytes[i + 3]]) as usize;
        i += 2 + len;
    }
    None
}

// Estimated (yaw, pitch) in degrees. The HeadPose classification (thresholds,
// baseline deltas) lives in the canister; this is the shared geometry.
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

#[derive(Clone, Default)]
struct Candidate {
    score: f32,
    bbox: [f32; 4],
}

// UltraFace RFB-320 decode: 4420 SSD priors over feature maps
// [40x30, 20x15, 10x8, 5x4], centre-form regression with variances 0.1/0.2;
// scores are already softmaxed (column 1 = face)
fn ultraface_decode(scores: &[f32], boxes: &[f32], src_w: f32, src_h: f32, min_score: f32) -> Vec<Candidate> {
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
                    if score >= min_score {
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

fn as_slice(value: &TValue) -> Result<&[f32], PipelineError> {
    value.as_slice::<f32>().map_err(|_| PipelineError::InferenceFailed)
}

// Collapses UltraFace's many overlapping/nested boxes into one representative
// per distinct face. UltraFace fires several confident boxes on a single face
// (coarse + fine priors, partial and nested) whose mutual IoU is low, so plain
// IoU-NMS leaves them all - which then trips the multi-face guard and also
// picks arbitrary crops. Here boxes that overlap at all (IoU or containment)
// are treated as the same face and the highest-scoring one is kept; only a
// spatially disjoint box is a separate face. Boxes lying largely outside the
// frame (UltraFace's coarse localization artifacts) are dropped first.
fn cluster_faces(mut candidates: Vec<Candidate>, img_w: f32, img_h: f32) -> Vec<Candidate> {
    candidates.retain(|c| inside_fraction(&c.bbox, img_w, img_h) >= 0.6);
    candidates.sort_by(|a, b| b.score.total_cmp(&a.score));
    let mut faces: Vec<Candidate> = Vec::new();
    for c in candidates {
        // Same face as an already-kept (higher-scoring) box?
        if faces.iter().any(|f| same_face(&f.bbox, &c.bbox)) {
            continue;
        }
        faces.push(c);
    }
    faces
}

fn same_face(a: &[f32; 4], b: &[f32; 4]) -> bool {
    if iou(a, b) > 0.1 {
        return true;
    }
    // Nested boxes have low IoU but high containment of the smaller in the larger
    let inter = intersection(a, b);
    inter / area(a).min(area(b)).max(1.0) > 0.5
}

// Fraction of the box's area that lies within the image
fn inside_fraction(b: &[f32; 4], img_w: f32, img_h: f32) -> f32 {
    let a = area(b);
    if a <= 0.0 {
        return 0.0;
    }
    let clipped = [b[0].max(0.0), b[1].max(0.0), b[2].min(img_w), b[3].min(img_h)];
    area(&clipped) / a
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
    let inter = intersection(a, b);
    let union = area(a) + area(b) - inter;
    if union <= 0.0 { 0.0 } else { inter / union }
}

// Non-reflective 2D similarity transform [a -b tx; b a ty] mapping src -> dst
// by least squares (the standard ArcFace alignment estimator)
pub struct Similarity {
    pub a: f32,
    pub b: f32,
    pub tx: f32,
    pub ty: f32,
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

// Quantized cosine similarity - the production uniqueness-scan metric
pub fn cosine_i8(a: &[i8], b: &[i8]) -> f32 {
    let mut dot = 0i32;
    let mut norm_a = 0i32;
    let mut norm_b = 0i32;
    for i in 0..a.len().min(b.len()) {
        let (x, y) = (a[i] as i32, b[i] as i32);
        dot += x * y;
        norm_a += x * x;
        norm_b += y * y;
    }
    if norm_a == 0 || norm_b == 0 {
        return 0.0;
    }
    dot as f32 / ((norm_a as f32).sqrt() * (norm_b as f32).sqrt())
}

#[cfg(test)]
mod tests {
    use super::*;

    // Minimal JPEG: SOI, then a SOF0 segment declaring width x height
    fn jpeg_with_dims(width: u16, height: u16) -> Vec<u8> {
        let [wh, wl] = width.to_be_bytes();
        let [hh, hl] = height.to_be_bytes();
        vec![
            0xFF, 0xD8, // SOI
            0xFF, 0xC0, // SOF0
            0x00, 0x11, // segment length (17)
            0x08, // precision
            hh, hl, // height
            wh, wl, // width
            0x03, // components... (rest unused by the parser)
        ]
    }

    #[test]
    fn jpeg_dimensions_reads_sof() {
        assert_eq!(jpeg_dimensions(&jpeg_with_dims(640, 480)), Some((640, 480)));
        // The DoS frame: tiny file declaring a huge canvas
        assert_eq!(jpeg_dimensions(&jpeg_with_dims(16384, 16384)), Some((16384, 16384)));
        // Rejected by the upload guard's MAX_DECODE_DIM comparison
        assert!(16384 > MAX_DECODE_DIM);
        assert_eq!(jpeg_dimensions(&[0xFF, 0xD8]), None);
    }

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
    fn quantized_cosine_tracks_f32_cosine() {
        let a = l2_normalize((0..512).map(|i| ((i * 37) % 101) as f32 - 50.0).collect());
        let b = l2_normalize((0..512).map(|i| ((i * 53) % 97) as f32 - 48.0).collect());
        let f32_cos = cosine_f32(&a, &b);
        let q_cos = cosine_i8(&quantize_i8(&a), &quantize_i8(&b));
        assert!((f32_cos - q_cos).abs() < 0.02, "{f32_cos} vs {q_cos}");
    }

    // End-to-end over a real portrait, gated on the fixtures being present
    // (run scripts/download-personhood-spike-models.sh). Also pins pipeline
    // determinism - the SCRFD failure mode.
    #[test]
    fn real_pipeline_detects_and_embeds() {
        use std::path::PathBuf;
        let dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../personhood_spike/models");
        let (Ok(det), Ok(lmk), Ok(emb), Ok(img)) = (
            std::fs::read(dir.join("version-RFB-320.onnx")),
            std::fs::read(dir.join("2d106det.onnx")),
            std::fs::read(dir.join("w600k_mbf.onnx")),
            std::fs::read(dir.join("test_face.jpg")),
        ) else {
            eprintln!("skipping: model fixtures not present");
            return;
        };
        let engines = Engines::build(&det, &lmk, &emb).unwrap();
        let image = decode_jpeg(&img).unwrap();
        let face = engines.detect_face(&image).unwrap();

        let [le, re, nose, ml, mr] = face.keypoints;
        assert!(le[0] < re[0], "eyes swapped");
        assert!(ml[0] < mr[0], "mouth corners swapped");
        assert!(le[1] < nose[1] && re[1] < nose[1], "eyes above nose");
        assert!(ml[1] > nose[1] && mr[1] > nose[1], "mouth below nose");

        let embedding = engines.embed_face(&image, &face).unwrap();
        assert_eq!(embedding.len(), 512);
        let norm: f32 = embedding.iter().map(|x| x * x).sum::<f32>().sqrt();
        assert!((norm - 1.0).abs() < 0.01);

        // Determinism
        assert_eq!(embedding, engines.embed_face(&image, &face).unwrap());
    }
}
