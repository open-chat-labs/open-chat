//! On-device inference backend (deliverable A6): llama.cpp via the `llama-cpp-2` crate, used on every
//! platform (desktop MSVC, Android NDK, iOS XCFramework). Gated behind the `inference` cargo feature so
//! default/dev builds don't pull the C++/cmake/libclang toolchain.
//!
//! Two entrypoints: [`run_text_inference`] (text only) and [`run_multimodal_inference`] (text + one
//! image, via llama.cpp's `mtmd` and the model's mmproj projector). Both wrap the user message in the
//! model's own chat template — rendered generically from the GGUF's Jinja with minijinja — so any
//! bring-your-own instruction model responds conversationally instead of stopping immediately.

use std::collections::HashMap;
use std::num::NonZeroU32;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, OnceLock};

use llama_cpp_2::context::params::LlamaContextParams;
use llama_cpp_2::context::LlamaContext;
use llama_cpp_2::llama_backend::LlamaBackend;
use llama_cpp_2::llama_batch::LlamaBatch;
use llama_cpp_2::model::params::LlamaModelParams;
use llama_cpp_2::model::{AddBos, LlamaModel, Special};
use llama_cpp_2::mtmd::{
    mtmd_default_marker, MtmdBitmap, MtmdContext, MtmdContextParams, MtmdInputText,
};
use llama_cpp_2::sampling::LlamaSampler;
use llama_cpp_2::token::LlamaToken;

const DEFAULT_N_CTX: u32 = 4096;
const N_BATCH: i32 = 512;

/// The llama.cpp backend is a process-global: `LlamaBackend::init()` flips a global atomic and is
/// NOT re-entrant — a second overlapping `init()` returns `BackendAlreadyInitialized`, and each
/// per-call init/free pays to re-initialise ggml. Initialise it exactly once and keep it for the
/// process lifetime. `LlamaBackend` is a zero-sized RAII guard, so never dropping it costs nothing
/// and simply leaves the backend live (freed by the OS at exit). This removes the re-init hazard
/// that made concurrent inferences collide; the app additionally serialises inference callers.
fn shared_backend() -> Result<&'static LlamaBackend, String> {
    static BACKEND: OnceLock<LlamaBackend> = OnceLock::new();
    if let Some(backend) = BACKEND.get() {
        return Ok(backend);
    }
    // Guard the one-time init so two threads can't both call LlamaBackend::init() (the loser would
    // get BackendAlreadyInitialized). Double-check inside the lock.
    static INIT_LOCK: Mutex<()> = Mutex::new(());
    let _guard = INIT_LOCK.lock().map_err(|_| "backend init lock poisoned".to_string())?;
    if let Some(backend) = BACKEND.get() {
        return Ok(backend);
    }
    let backend = LlamaBackend::init().map_err(|e| format!("init backend: {e}"))?;
    let _ = BACKEND.set(backend);
    Ok(BACKEND.get().expect("backend was just set"))
}

/// A model loaded once and kept for the process lifetime, so repeated inferences skip the multi-GB
/// reload from disk. Keyed by the GGUF path. `LlamaModel` is Send + Sync.
struct CachedModel {
    model: Arc<LlamaModel>,
    /// The mtmd/vision projector, loaded lazily on the first image request. It holds a raw pointer
    /// into `model`'s C data, so `model` MUST outlive it — guaranteed here because both are cached
    /// for the whole process and the `Arc<LlamaModel>` keeps the C model at a stable address.
    mtmd: Mutex<Option<Arc<MtmdContext>>>,
}

/// Return the cached model for `gguf`, loading (and caching) it on first use.
fn cached_model(gguf: &Path) -> Result<Arc<CachedModel>, String> {
    static CACHE: OnceLock<Mutex<HashMap<PathBuf, Arc<CachedModel>>>> = OnceLock::new();
    let cache = CACHE.get_or_init(|| Mutex::new(HashMap::new()));
    let mut guard = cache.lock().map_err(|_| "model cache lock poisoned".to_string())?;
    if let Some(entry) = guard.get(gguf) {
        return Ok(entry.clone());
    }
    let backend = shared_backend()?;
    let model = LlamaModel::load_from_file(backend, gguf, &LlamaModelParams::default())
        .map_err(|e| format!("load model: {e}"))?;
    let entry = Arc::new(CachedModel {
        model: Arc::new(model),
        mtmd: Mutex::new(None),
    });
    guard.insert(gguf.to_owned(), entry.clone());
    Ok(entry)
}

/// Return the cached vision projector for this model, loading it on first use. Errors if the model's
/// mmproj does not support image input.
fn cached_mtmd(entry: &CachedModel, mmproj: &Path) -> Result<Arc<MtmdContext>, String> {
    let mut guard = entry.mtmd.lock().map_err(|_| "mtmd cache lock poisoned".to_string())?;
    if let Some(ctx) = guard.as_ref() {
        return Ok(ctx.clone());
    }
    let mmproj_str = mmproj.to_str().ok_or("mmproj path not utf-8")?;
    // media_marker stays the default `<__media__>`, which we embed in the prompt.
    let mut params = MtmdContextParams::default();
    params.use_gpu = false;
    let ctx = MtmdContext::init_from_file(mmproj_str, &entry.model, &params)
        .map_err(|e| format!("init mtmd projector: {e}"))?;
    if !ctx.support_vision() {
        return Err("projector does not support image input".to_string());
    }
    let arc = Arc::new(ctx);
    *guard = Some(arc.clone());
    Ok(arc)
}

/// Render a single user turn into a prompt string using the model's own Jinja chat template (read from
/// the GGUF metadata). Deliberately generic: every chat GGUF ships its own template, so rendering it
/// ourselves makes any bring-your-own chat model format correctly — unlike llama.cpp's core
/// `apply_chat_template`, which only knows a fixed set of built-in formats and rejects newer templates
/// (e.g. Gemma 4's, which returns an FFI error). The `minijinja-contrib` pycompat layer supplies the
/// Python str/dict methods (`.get`, `.split`, slicing, `dictsort`, …) that HuggingFace templates assume.
///
/// `user_text` is the full user message; for the vision path it already carries mtmd's media marker.
/// Returns `Err` if the model ships no template or rendering fails — callers fall back to the raw text.
fn render_chat_prompt(model: &LlamaModel, user_text: &str) -> Result<String, String> {
    let template = model
        .chat_template(None)
        .map_err(|e| format!("no built-in chat template: {e}"))?;
    let template_src = template.to_str().map_err(|e| format!("template not utf-8: {e}"))?;

    let mut env = minijinja::Environment::new();
    // Make HF templates' Python-isms (.get/.split/.items/slicing) resolve instead of erroring.
    env.set_unknown_method_callback(minijinja_contrib::pycompat::unknown_method_callback);
    // Some templates call raise_exception(...) to reject unsupported inputs; surface it as an error.
    env.add_function(
        "raise_exception",
        |msg: String| -> Result<minijinja::Value, minijinja::Error> {
            Err(minijinja::Error::new(minijinja::ErrorKind::InvalidOperation, msg))
        },
    );
    env.add_template("chat", template_src)
        .map_err(|e| format!("parse chat template: {e}"))?;
    let tmpl = env
        .get_template("chat")
        .map_err(|e| format!("load chat template: {e}"))?;

    let messages = serde_json::json!([{ "role": "user", "content": user_text }]);
    // bos_token left empty: BOS is added exactly once at tokenization time (see `tokenize_prompt`).
    let ctx = minijinja::context! {
        messages => minijinja::Value::from_serialize(&messages),
        add_generation_prompt => true,
        bos_token => "",
    };
    tmpl.render(ctx)
        .map_err(|e| format!("render chat template: {e}"))
}

/// Wrap `user_text` in the model's chat template (falling back to the raw text for base models that
/// ship none), tokenize with special-token parsing, and guarantee exactly one leading BOS — some
/// templates render a `<bos>` (parsed back to the BOS token here), others don't.
fn tokenize_prompt(model: &LlamaModel, user_text: &str) -> Result<Vec<LlamaToken>, String> {
    let formatted = render_chat_prompt(model, user_text).unwrap_or_else(|_| user_text.to_string());
    let mut tokens = model
        .str_to_token(&formatted, AddBos::Never)
        .map_err(|e| format!("tokenize: {e}"))?;
    let bos = model.token_bos();
    if tokens.first() != Some(&bos) {
        tokens.insert(0, bos);
    }
    Ok(tokens)
}

/// Augment the user message to request a schema-conforming JSON response. This is deliberately
/// prompt-based rather than grammar-constrained: llama.cpp's low-level grammar sampler hard-aborts
/// (`GGML_ASSERT(!stacks.empty())`, a spot llama.cpp itself flags `// REVIEW`) when driven token by
/// token through this crate, which would crash the whole client. So `responseSchema` is best-effort —
/// the model is asked for JSON and the caller validates the result (the contract documents this).
/// Returns the prompt unchanged when no schema is supplied.
fn augment_prompt_for_schema(user_text: &str, response_schema: Option<&str>) -> String {
    match response_schema {
        Some(schema) if !schema.trim().is_empty() => format!(
            "{user_text}\n\nReply with ONLY a single JSON object that conforms to this JSON Schema. \
             Output nothing before or after the JSON.\n\nJSON Schema:\n{schema}"
        ),
        _ => user_text.to_string(),
    }
}

/// Greedy-decode up to `max_tokens` continuation tokens. The context must already be prefilled (prompt,
/// or image + prompt) with logits computed for the last position; `n_start` is the next sequence
/// position to write. Stops at the model's end-of-generation token.
fn generate(
    model: &LlamaModel,
    ctx: &mut LlamaContext,
    n_start: i32,
    max_tokens: u32,
) -> Result<String, String> {
    let mut sampler = LlamaSampler::greedy();
    let mut batch = LlamaBatch::new(1, 1);
    let mut output = String::new();
    let mut n_cur = n_start;

    for _ in 0..max_tokens {
        // -1 samples from the most recently computed logits (the last decoded position).
        let token = sampler.sample(ctx, -1);
        sampler.accept(token);

        if model.is_eog_token(token) {
            break;
        }

        let piece = model
            .token_to_str(token, Special::Tokenize)
            .map_err(|e| format!("detokenize: {e}"))?;
        output.push_str(&piece);

        batch.clear();
        batch.add(token, n_cur, &[0], true).map_err(|e| e.to_string())?;
        n_cur += 1;
        ctx.decode(&mut batch).map_err(|e| format!("decode: {e}"))?;
    }

    Ok(output)
}

/// Load a GGUF model and generate up to `max_tokens` tokens for `prompt`. When `response_schema` (a JSON
/// Schema string) is supplied the model is asked (best-effort) to return JSON conforming to it.
/// Synchronous + compute-heavy — callers run it on a blocking thread.
pub fn run_text_inference(
    model_path: &Path,
    prompt: &str,
    max_tokens: u32,
    response_schema: Option<&str>,
) -> Result<String, String> {
    let backend = shared_backend()?;
    let entry = cached_model(model_path)?;
    let model = entry.model.as_ref();

    let ctx_params = LlamaContextParams::default().with_n_ctx(NonZeroU32::new(DEFAULT_N_CTX));
    let mut ctx = model
        .new_context(backend, ctx_params)
        .map_err(|e| format!("create context: {e}"))?;

    let prompt = augment_prompt_for_schema(prompt, response_schema);
    let tokens = tokenize_prompt(model, &prompt)?;

    // Prefill the prompt, computing logits only for the last token.
    let mut batch = LlamaBatch::new(tokens.len().max(1), 1);
    let last = (tokens.len() - 1) as i32;
    for (i, token) in tokens.iter().enumerate() {
        batch
            .add(*token, i as i32, &[0], i as i32 == last)
            .map_err(|e| e.to_string())?;
    }
    ctx.decode(&mut batch).map_err(|e| format!("decode prompt: {e}"))?;

    generate(model, &mut ctx, tokens.len() as i32, max_tokens)
}

/// Load a GGUF model plus its mmproj projector and generate a response for `prompt` grounded in a single
/// image (`image_bytes`: any stb_image-supported encoding — png/jpg/bmp/gif). Synchronous +
/// compute-heavy — callers run it on a blocking thread.
pub fn run_multimodal_inference(
    model_path: &Path,
    mmproj_path: &Path,
    prompt: &str,
    image_bytes: &[u8],
    max_tokens: u32,
    response_schema: Option<&str>,
) -> Result<String, String> {
    let backend = shared_backend()?;
    let entry = cached_model(model_path)?;
    let model = entry.model.as_ref();

    let ctx_params = LlamaContextParams::default().with_n_ctx(NonZeroU32::new(DEFAULT_N_CTX));
    let mut ctx = model
        .new_context(backend, ctx_params)
        .map_err(|e| format!("create context: {e}"))?;

    // The vision projector (like the model) is loaded once and reused across calls.
    let mtmd = cached_mtmd(entry.as_ref(), mmproj_path)?;
    let mtmd_ctx = mtmd.as_ref();

    // Decode the encoded image (png/jpg/…) into an mtmd bitmap.
    let bitmap = MtmdBitmap::from_buffer(mtmd_ctx, image_bytes, false)
        .map_err(|e| format!("decode image: {e}"))?;

    // Put mtmd's media marker where the image belongs, then wrap in the model's chat template. mtmd
    // replaces the marker with the projected image tokens during tokenize().
    let user_content = format!(
        "{}\n{}",
        mtmd_default_marker(),
        augment_prompt_for_schema(prompt, response_schema)
    );
    let formatted = render_chat_prompt(model, &user_content).unwrap_or(user_content);
    let input = MtmdInputText {
        text: formatted,
        add_special: true,
        parse_special: true,
    };
    let chunks = mtmd_ctx
        .tokenize(input, &[&bitmap])
        .map_err(|e| format!("mtmd tokenize: {e}"))?;

    // Prefill image + text (logits on the last position), then generate from there.
    let n_past = chunks
        .eval_chunks(mtmd_ctx, &ctx, 0, 0, N_BATCH, true)
        .map_err(|e| format!("eval chunks: {e}"))?;

    generate(model, &mut ctx, n_past, max_tokens)
}

#[cfg(test)]
mod tests {
    use super::*;

    // Text smoke test. Skipped unless OC_TEST_MODEL_GGUF points at a real GGUF. Run with:
    //   set CMAKE_GENERATOR="Visual Studio 17 2022"
    //   set OC_TEST_MODEL_GGUF=C:\path\to\gemma-4-E2B-it-Q4_K_M.gguf
    //   cargo test --features inference -- --nocapture text_inference_smoke
    #[test]
    fn text_inference_smoke() {
        let Ok(path) = std::env::var("OC_TEST_MODEL_GGUF") else {
            eprintln!("OC_TEST_MODEL_GGUF not set — skipping text inference smoke test");
            return;
        };
        let output = run_text_inference(
            Path::new(&path),
            "In one short sentence, what is a bicycle?",
            64,
            None,
        )
        .expect("text inference failed");
        // Also write to a file — stderr gets mangled under PowerShell's native-command capture.
        std::fs::write(std::env::temp_dir().join("oc_inference_smoke.txt"), &output).ok();
        eprintln!("=== text output ===\n{output}\n===================");
        assert!(!output.trim().is_empty(), "expected non-empty generated text");
    }

    // Extract the first balanced-ish JSON object from possibly prose/fence-wrapped text.
    fn extract_json_object(s: &str) -> Option<String> {
        let start = s.find('{')?;
        let end = s.rfind('}')?;
        (end > start).then(|| s[start..=end].to_string())
    }

    // Structured-output smoke test (best-effort): with a JSON Schema the model is asked to return matching
    // JSON. Skipped unless OC_TEST_MODEL_GGUF is set.
    #[test]
    fn structured_output_smoke() {
        let Ok(path) = std::env::var("OC_TEST_MODEL_GGUF") else {
            eprintln!("OC_TEST_MODEL_GGUF not set — skipping structured output smoke test");
            return;
        };
        let schema = r#"{
            "type": "object",
            "properties": {
                "animal": { "type": "string" },
                "legs": { "type": "integer" }
            },
            "required": ["animal", "legs"]
        }"#;
        let output = run_text_inference(
            Path::new(&path),
            "Describe a dog with its number of legs.",
            128,
            Some(schema),
        )
        .expect("structured inference failed");
        std::fs::write(std::env::temp_dir().join("oc_structured_smoke.txt"), &output).ok();
        eprintln!("=== structured output ===\n{output}\n=========================");
        // Best-effort: pull the JSON object out of the (possibly prose-wrapped) output and parse it.
        let json = extract_json_object(&output).expect("expected a JSON object in the output");
        let value: serde_json::Value =
            serde_json::from_str(&json).expect("extracted JSON should parse");
        assert!(value.get("animal").is_some(), "missing 'animal' key");
        assert!(value.get("legs").is_some(), "missing 'legs' key");
    }

    // Vision smoke test. Skipped unless OC_TEST_MODEL_GGUF, OC_TEST_MMPROJ_GGUF and OC_TEST_IMAGE are
    // all set. Run with the three env vars plus CMAKE_GENERATOR, then:
    //   cargo test --features inference -- --nocapture vision_inference_smoke
    #[test]
    fn vision_inference_smoke() {
        let (Ok(model), Ok(mmproj), Ok(image)) = (
            std::env::var("OC_TEST_MODEL_GGUF"),
            std::env::var("OC_TEST_MMPROJ_GGUF"),
            std::env::var("OC_TEST_IMAGE"),
        ) else {
            eprintln!("vision env vars not all set — skipping vision inference smoke test");
            return;
        };
        let bytes = std::fs::read(&image).expect("read test image");
        let output = run_multimodal_inference(
            Path::new(&model),
            Path::new(&mmproj),
            "What is in this image? Answer in one short sentence.",
            &bytes,
            64,
            None,
        )
        .expect("multimodal inference failed");
        std::fs::write(std::env::temp_dir().join("oc_vision_smoke.txt"), &output).ok();
        eprintln!("=== vision output ===\n{output}\n=====================");
        assert!(!output.trim().is_empty(), "expected non-empty generated text");
    }
}
