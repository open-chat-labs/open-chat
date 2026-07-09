//! Offline threshold calibration for the personhood verifier's uniqueness
//! check. Runs the *exact* production face pipeline (via the shared
//! face_pipeline library) over a labelled dataset, builds the genuine vs
//! impostor similarity distributions, and reports the ROC so the SNS can pick
//! the on-chain `T_dup` / `T_clear` similarity bands with eyes open.
//!
//! Semantics for our uniqueness use case (NOT ordinary face recognition):
//! - A *genuine* pair is two images of the SAME person. When a second
//!   enrolment of an already-verified person is checked, it must be caught as
//!   a duplicate (similarity >= T_dup). A genuine pair below T_dup is a
//!   MISSED DUPLICATE = a sybil slipping through.
//! - An *impostor* pair is two images of DIFFERENT people. A new honest user
//!   must not be flagged as a duplicate of anyone (similarity < T_dup). An
//!   impostor pair at/above T_dup is a FALSE MATCH = an innocent user
//!   rejected as "not unique".
//!
//! So T_dup trades sybil-leak-rate (genuine below) against
//! innocent-rejection-rate (impostor above). Critically, at enrolment scale N
//! every new user is compared against all N stored embeddings, so the
//! per-comparison false-match rate compounds: this tool reports the
//! scale-adjusted probability that an honest user collides with SOMEONE.
//!
//! Similarity is computed with the production i8-quantized cosine (the exact
//! metric the on-chain scan uses), with the f32 cosine reported alongside.
//!
//! Input: a pairs file, one pair per line:
//!   `same  relative/path/a.jpg  relative/path/b.jpg`
//!   `diff  relative/path/c.jpg  relative/path/d.jpg`
//! (LFW's pairs.txt can be converted to this; label = same|diff, paths are
//! relative to --images-dir.)

use clap::Parser;
use face_pipeline::{Engines, cosine_f32, cosine_i8, decode_jpeg, quantize_i8};
use std::collections::HashMap;
use std::path::{Path, PathBuf};

#[derive(clap::Parser)]
struct Opts {
    /// Directory containing version-RFB-320.onnx, 2d106det.onnx, w600k_mbf.onnx
    #[arg(long)]
    models_dir: PathBuf,

    /// Root directory the pair paths are relative to
    #[arg(long)]
    images_dir: PathBuf,

    /// Pairs file: `same|diff  path_a  path_b` per line
    #[arg(long)]
    pairs: PathBuf,

    /// Enrolment scales to report the compounded false-match probability for
    #[arg(long, value_delimiter = ',', default_value = "100000,1000000")]
    scales: Vec<u64>,

    /// Instead of ROC, diagnose why images fail detection (samples the first
    /// N unique images from the pairs file)
    #[arg(long)]
    diagnose: Option<usize>,

    /// Worker threads for embedding (default: available parallelism)
    #[arg(long)]
    threads: Option<usize>,

    /// Use RGB channel order for the embedder (experiment; production is BGR)
    #[arg(long)]
    rgb_embed: bool,

    /// Embedding model filename in --models-dir (default w600k_mbf.onnx; the
    /// stronger w600k_r50.onnx is the same 112x112/512-d interface)
    #[arg(long, default_value = "w600k_mbf.onnx")]
    embedder: String,
}

struct Embedding {
    i8: Vec<i8>,
    f32: Vec<f32>,
}

fn main() {
    let opts = Opts::parse();

    println!("Loading models...");
    let engines = Engines::build(
        &read(&opts.models_dir.join("version-RFB-320.onnx")),
        &read(&opts.models_dir.join("2d106det.onnx")),
        &read(&opts.models_dir.join(&opts.embedder)),
    )
    .expect("failed to build engines");

    let pairs = read_pairs(&opts.pairs);
    println!("{} pairs", pairs.len());

    if let Some(n) = opts.diagnose {
        diagnose(&engines, &opts.images_dir, &pairs, n);
        return;
    }

    // Embed every referenced image once, in parallel across worker threads
    // (each thread builds its own engines, so no shared state)
    let mut unique: Vec<String> = Vec::new();
    let mut seen = std::collections::HashSet::new();
    for (_, a, b) in &pairs {
        for rel in [a, b] {
            if seen.insert(rel.clone()) {
                unique.push(rel.clone());
            }
        }
    }
    let n_threads = opts
        .threads
        .unwrap_or_else(|| std::thread::available_parallelism().map(|n| n.get()).unwrap_or(4));
    println!("Embedding {} unique images across {n_threads} threads...", unique.len());
    let cache = embed_all(
        &opts.models_dir,
        &opts.embedder,
        &opts.images_dir,
        unique,
        n_threads,
        !opts.rgb_embed,
    );

    let mut genuine: Vec<f32> = Vec::new();
    let mut impostor: Vec<f32> = Vec::new();
    let mut failed = 0u64;

    for (same, a, b) in &pairs {
        match (cache.get(a).and_then(|o| o.as_ref()), cache.get(b).and_then(|o| o.as_ref())) {
            (Some(ea), Some(eb)) => {
                let s = cosine_i8(&ea.i8, &eb.i8);
                if *same { genuine.push(s) } else { impostor.push(s) }
            }
            _ => failed += 1,
        }
    }

    println!(
        "\nEmbedded {} images ({} failed to yield a face). Usable pairs: {} genuine, {} impostor. Skipped: {}",
        cache.len(),
        cache.values().filter(|v| v.is_none()).count(),
        genuine.len(),
        impostor.len(),
        failed
    );
    if genuine.is_empty() || impostor.is_empty() {
        eprintln!("Need at least one genuine and one impostor pair to calibrate.");
        std::process::exit(1);
    }

    report_distribution("Genuine (same person)", &genuine);
    report_distribution("Impostor (different people)", &impostor);
    report_roc(&genuine, &impostor, &opts.scales);
    report_f32_reference(&pairs, &cache);
}

// Similarity below which a genuine pair is a missed duplicate (FNMR), and
// impostor above which it is a false match (FMR), swept across the range
fn report_roc(genuine: &[f32], impostor: &[f32], scales: &[u64]) {
    println!("\n=== ROC (i8 cosine, the production scan metric) ===");
    println!("threshold  FMR(impostor>=T)  FNMR(genuine<T)");
    let g = genuine.len() as f64;
    let i = impostor.len() as f64;
    let mut eer = (1.0f64, 0.0f32);
    for step in 30..=95 {
        let t = step as f32 / 100.0;
        let fmr = impostor.iter().filter(|&&s| s >= t).count() as f64 / i;
        let fnmr = genuine.iter().filter(|&&s| s < t).count() as f64 / g;
        if step % 5 == 0 {
            println!("   {t:.2}        {:>8.4}%        {:>8.4}%", fmr * 100.0, fnmr * 100.0);
        }
        if (fmr - fnmr).abs() < (eer.0 - eer_fnmr(genuine, eer.1)).abs() {
            eer = (fmr, t);
        }
    }

    // Recommend bands at conservative operating points
    let t_clear = quantile(impostor, 0.999); // above nearly all impostors
    let t_dup = pick_t_dup(genuine, impostor);
    println!("\nEqual error rate near threshold {:.2}", eer.1);
    println!("\nRecommended bands:");
    println!("  T_clear ~ {t_clear:.3}  (99.9th percentile of impostor sims; below = confidently unique)");
    println!("  T_dup   ~ {t_dup:.3}  (lowest threshold with impostor FMR <= 0.1%)");
    let leak = genuine.iter().filter(|&&s| s < t_dup).count() as f64 / g;
    println!(
        "  At T_dup: genuine below (missed-duplicate / sybil-leak rate) = {:.3}%",
        leak * 100.0
    );

    // Scale-adjusted innocent-rejection probability
    let fmr_at_dup = impostor.iter().filter(|&&s| s >= t_dup).count() as f64 / i;
    println!(
        "\n=== Scale-adjusted innocent rejection at T_dup (per-comparison FMR {:.5}%) ===",
        fmr_at_dup * 100.0
    );
    println!("A new honest user is scanned against every stored embedding; P(collide with someone):");
    for &n in scales {
        let p = 1.0 - (1.0 - fmr_at_dup).powi(n.min(i32::MAX as u64) as i32);
        println!("  N = {n:>10}: {:.2}%", p * 100.0);
    }
    if fmr_at_dup > 0.0 {
        println!(
            "\nNote: for P(collision) < 1% at N=1M the per-comparison FMR must be < {:.2e}.\n\
             If the impostor sample is too small to measure an FMR that low, a larger\n\
             distractor set is needed before enforcement (see PRD Phase 0 exit criteria).",
            0.01 / 1_000_000.0
        );
    }
}

fn pick_t_dup(_genuine: &[f32], impostor: &[f32]) -> f32 {
    // Lowest 0.01-step threshold whose impostor FMR <= 0.1%
    let i = impostor.len() as f64;
    for step in 30..=99 {
        let t = step as f32 / 100.0;
        let fmr = impostor.iter().filter(|&&s| s >= t).count() as f64 / i;
        if fmr <= 0.001 {
            return t;
        }
    }
    0.99
}

fn eer_fnmr(genuine: &[f32], t: f32) -> f64 {
    genuine.iter().filter(|&&s| s < t).count() as f64 / genuine.len() as f64
}

fn report_distribution(label: &str, sims: &[f32]) {
    let mut v = sims.to_vec();
    v.sort_by(f32::total_cmp);
    let mean = v.iter().sum::<f32>() / v.len() as f32;
    println!(
        "\n{label}: n={} min={:.3} p05={:.3} median={:.3} mean={:.3} p95={:.3} max={:.3}",
        v.len(),
        v[0],
        quantile(&v, 0.05),
        quantile(&v, 0.50),
        mean,
        quantile(&v, 0.95),
        v[v.len() - 1],
    );
}

fn report_f32_reference(pairs: &[(bool, String, String)], cache: &HashMap<String, Option<Embedding>>) {
    let (mut g, mut i) = (Vec::new(), Vec::new());
    for (same, a, b) in pairs {
        if let (Some(Some(ea)), Some(Some(eb))) = (cache.get(a), cache.get(b)) {
            let s = cosine_f32(&ea.f32, &eb.f32);
            if *same { g.push(s) } else { i.push(s) }
        }
    }
    if !g.is_empty() && !i.is_empty() {
        println!("\n(f32 cosine reference - quantization gap is the difference vs the i8 numbers above)");
        report_distribution("  Genuine f32", &g);
        report_distribution("  Impostor f32", &i);
    }
}

fn quantile(sorted_or_not: &[f32], q: f32) -> f32 {
    let mut v = sorted_or_not.to_vec();
    v.sort_by(f32::total_cmp);
    let idx = ((v.len() as f32 - 1.0) * q).round() as usize;
    v[idx]
}

fn diagnose(engines: &Engines, images_dir: &Path, pairs: &[(bool, String, String)], n: usize) {
    let mut seen = std::collections::HashSet::new();
    let mut order = Vec::new();
    for (_, a, b) in pairs {
        for rel in [a, b] {
            if seen.insert(rel.clone()) {
                order.push(rel.clone());
            }
        }
    }
    // Sample evenly across the whole set, not just the front
    let stride = (order.len() / n).max(1);
    let order: Vec<String> = order.iter().step_by(stride).take(n).cloned().collect();

    let mut outcomes: HashMap<&str, u32> = HashMap::new();
    let mut decode_failed = 0u32;
    let mut examples = 0;
    for rel in &order {
        match std::fs::read(images_dir.join(rel)).ok().and_then(|b| decode_jpeg(&b).ok()) {
            Some(image) => {
                let outcome = engines.detect_debug(&image);
                let _ = examples;
                *outcomes.entry(outcome).or_default() += 1;
            }
            None => decode_failed += 1,
        }
    }
    println!("\n=== Detection diagnosis over {} images ===", order.len());
    println!("decode_failed: {decode_failed}");
    for outcome in ["ok", "no_face", "multi_face", "inference_failed", "decode_failed"] {
        println!("  {outcome:<18} {}", outcomes.get(outcome).copied().unwrap_or(0));
    }
}

fn embed_all(
    models_dir: &Path,
    embedder: &str,
    images_dir: &Path,
    unique: Vec<String>,
    n_threads: usize,
    bgr: bool,
) -> HashMap<String, Option<Embedding>> {
    let det = read(&models_dir.join("version-RFB-320.onnx"));
    let lmk = read(&models_dir.join("2d106det.onnx"));
    let emb = read(&models_dir.join(embedder));

    let chunks: Vec<Vec<String>> = {
        let mut cs: Vec<Vec<String>> = (0..n_threads).map(|_| Vec::new()).collect();
        for (i, rel) in unique.into_iter().enumerate() {
            cs[i % n_threads].push(rel);
        }
        cs
    };

    std::thread::scope(|scope| {
        let handles: Vec<_> = chunks
            .into_iter()
            .map(|chunk| {
                let (det, lmk, emb) = (&det, &lmk, &emb);
                scope.spawn(move || {
                    let engines = Engines::build(det, lmk, emb).expect("engines");
                    let mut out = HashMap::new();
                    for rel in chunk {
                        let e = embed_image(&engines, &images_dir.join(&rel), bgr);
                        out.insert(rel, e);
                    }
                    out
                })
            })
            .collect();
        handles.into_iter().flat_map(|h| h.join().unwrap()).collect()
    })
}

fn embed_image(engines: &Engines, path: &Path, bgr: bool) -> Option<Embedding> {
    let bytes = std::fs::read(path).ok()?;
    let image = decode_jpeg(&bytes).ok()?;
    let face = engines.detect_face(&image).ok()?;
    let f32 = engines.embed_face_variant(&image, &face, bgr).ok()?;
    Some(Embedding {
        i8: quantize_i8(&f32),
        f32,
    })
}

fn read(path: &Path) -> Vec<u8> {
    std::fs::read(path).unwrap_or_else(|e| panic!("failed to read {path:?}: {e}"))
}

fn read_pairs(path: &Path) -> Vec<(bool, String, String)> {
    let text = std::fs::read_to_string(path).unwrap_or_else(|e| panic!("failed to read {path:?}: {e}"));
    text.lines()
        .filter(|l| !l.trim().is_empty() && !l.starts_with('#'))
        .filter_map(|l| {
            let mut parts = l.split_whitespace();
            let label = parts.next()?;
            let a = parts.next()?;
            let b = parts.next()?;
            let same = match label {
                "same" | "genuine" | "1" => true,
                "diff" | "impostor" | "0" => false,
                _ => return None,
            };
            Some((same, a.to_string(), b.to_string()))
        })
        .collect()
}
