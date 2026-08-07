//! On-device inference backend (deliverable A6): llama.cpp via the `llama-cpp-2` crate, used on every
//! platform (desktop MSVC, Android NDK, iOS XCFramework). Gated behind the `inference` cargo feature so
//! default/dev builds don't pull the C++/cmake/libclang toolchain.
//!
//! Two entrypoints: [`run_text_inference`] (text only) and [`run_multimodal_inference`] (text + one
//! image, via llama.cpp's `mtmd` and the model's mmproj projector). Both wrap the user message in the
//! model's own chat template — rendered generically from the GGUF's Jinja with minijinja — so any
//! bring-your-own instruction model responds conversationally instead of stopping immediately.

use std::collections::VecDeque;
use std::num::NonZeroU32;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, OnceLock};

use llama_cpp_2::context::LlamaContext;
use llama_cpp_2::context::params::LlamaContextParams;
use llama_cpp_2::llama_backend::LlamaBackend;
use llama_cpp_2::llama_batch::LlamaBatch;
use llama_cpp_2::model::params::LlamaModelParams;
use llama_cpp_2::model::{AddBos, LlamaModel, Special};
use llama_cpp_2::mtmd::{
    MtmdBitmap, MtmdContext, MtmdContextParams, MtmdInputText, mtmd_default_marker,
};
use llama_cpp_2::sampling::LlamaSampler;
use llama_cpp_2::token::LlamaToken;

const DEFAULT_N_CTX: u32 = 4096;
const N_BATCH: i32 = 512;
// A loaded model can occupy several GiB. Keep exactly one process-wide entry so switching models
// releases the previous allocation deterministically instead of retaining every model ever used.
const MODEL_CACHE_CAPACITY: usize = 1;
// Each model has at most one active vision projector. Its key still includes path + verified digest
// so replacing or relocating a projector cannot silently reuse an older in-memory context.
const PROJECTOR_CACHE_CAPACITY: usize = 1;

/// A path paired with the SHA-256 that the model manager has just verified against the manifest.
/// Paths are retained for lifecycle invalidation; the digest prevents same-path replacements from
/// reusing stale in-memory content.
#[derive(Clone, Debug, Eq, Hash, PartialEq)]
pub(crate) struct VerifiedFileIdentity {
    path: PathBuf,
    sha256: [u8; 32],
}

impl VerifiedFileIdentity {
    pub(crate) fn from_verified_sha256(path: PathBuf, sha256: &str) -> Result<Self, String> {
        let digest = hex::decode(sha256).map_err(|_| "verified SHA-256 is invalid".to_string())?;
        let sha256 = digest
            .try_into()
            .map_err(|_| "verified SHA-256 is invalid".to_string())?;
        Ok(Self { path, sha256 })
    }

    pub(crate) fn path(&self) -> &Path {
        &self.path
    }

    fn belongs_to(&self, directory: &Path) -> bool {
        self.path.starts_with(directory)
    }
}

/// Minimal deterministic LRU. Values are loaded before eviction, so a failed replacement never
/// discards a known-good entry. The most recently used entry is at the back.
struct BoundedLruCache<K, V> {
    capacity: usize,
    entries: VecDeque<(K, V)>,
}

impl<K: Eq, V: Clone> BoundedLruCache<K, V> {
    fn new(capacity: usize) -> Self {
        assert!(capacity > 0, "cache capacity must be non-zero");
        Self {
            capacity,
            entries: VecDeque::with_capacity(capacity),
        }
    }

    fn get_or_try_insert_with<E>(
        &mut self,
        key: K,
        load: impl FnOnce() -> Result<V, E>,
    ) -> Result<V, E> {
        if let Some(position) = self
            .entries
            .iter()
            .position(|(existing, _)| existing == &key)
        {
            let entry = self
                .entries
                .remove(position)
                .expect("cache position came from this deque");
            let value = entry.1.clone();
            self.entries.push_back(entry);
            return Ok(value);
        }

        // Load before mutating the cache. If loading fails, every known-good entry and its LRU order
        // remain untouched.
        let value = load()?;
        if self.entries.len() == self.capacity {
            self.entries.pop_front();
        }
        self.entries.push_back((key, value.clone()));
        Ok(value)
    }

    fn invalidate_matching_after<T, E>(
        &mut self,
        mutation: &Result<T, E>,
        matches: impl FnMut(&K) -> bool,
    ) {
        if mutation.is_ok() {
            self.invalidate_matching(matches);
        }
    }

    fn invalidate_matching(&mut self, mut matches: impl FnMut(&K) -> bool) {
        self.entries.retain(|(key, _)| !matches(key));
    }

    #[cfg(test)]
    fn len(&self) -> usize {
        self.entries.len()
    }

    #[cfg(test)]
    fn contains_key(&self, key: &K) -> bool {
        self.entries.iter().any(|(existing, _)| existing == key)
    }
}

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
    let _guard = INIT_LOCK
        .lock()
        .map_err(|_| "backend init lock poisoned".to_string())?;
    if let Some(backend) = BACKEND.get() {
        return Ok(backend);
    }
    let backend = LlamaBackend::init().map_err(|e| format!("init backend: {e}"))?;
    let _ = BACKEND.set(backend);
    Ok(BACKEND.get().expect("backend was just set"))
}

/// A projector retains its model explicitly because llama.cpp stores a raw pointer to the model in
/// the projector context. Field order also guarantees the context is dropped before that model Arc.
struct CachedProjector {
    context: MtmdContext,
    _model: Arc<LlamaModel>,
}

/// A content-addressed model cache entry. Projectors are bounded independently and declared before
/// the model so all projector contexts are released first during deterministic eviction.
struct CachedModel {
    projectors: Mutex<BoundedLruCache<VerifiedFileIdentity, Arc<CachedProjector>>>,
    model: Arc<LlamaModel>,
}

type ModelCache = BoundedLruCache<VerifiedFileIdentity, Arc<CachedModel>>;
static MODEL_CACHE: OnceLock<Mutex<ModelCache>> = OnceLock::new();

fn lock_unpoisoned<T>(mutex: &Mutex<T>) -> std::sync::MutexGuard<'_, T> {
    mutex
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner)
}

fn model_cache() -> &'static Mutex<ModelCache> {
    MODEL_CACHE.get_or_init(|| Mutex::new(BoundedLruCache::new(MODEL_CACHE_CAPACITY)))
}

/// Invalidate entries belonging to a model directory only when the filesystem mutation committed.
/// The result is returned unchanged so callers can wrap the atomic promotion/delete result directly.
pub(crate) fn invalidate_model_cache_after<T, E>(
    mutation: Result<T, E>,
    model_directory: &Path,
) -> Result<T, E> {
    if let Some(cache) = MODEL_CACHE.get() {
        lock_unpoisoned(cache)
            .invalidate_matching_after(&mutation, |identity| identity.belongs_to(model_directory));
    }
    mutation
}

/// Fail-closed invalidation for the exceptional case where a filesystem replacement fails and the
/// old directory cannot be rolled back. The old cache entry is no longer backed by verified live
/// store state, so retaining it would be both stale and an unbounded memory leak.
pub(crate) fn invalidate_model_cache(model_directory: &Path) {
    if let Some(cache) = MODEL_CACHE.get() {
        lock_unpoisoned(cache).invalidate_matching(|identity| identity.belongs_to(model_directory));
    }
}

/// Return the cached model for a path + digest that was verified immediately before inference.
fn cached_model(identity: &VerifiedFileIdentity) -> Result<Arc<CachedModel>, String> {
    lock_unpoisoned(model_cache()).get_or_try_insert_with(identity.clone(), || {
        let backend = shared_backend()?;
        let model =
            LlamaModel::load_from_file(backend, identity.path(), &LlamaModelParams::default())
                .map_err(|e| format!("load model: {e}"))?;
        Ok(Arc::new(CachedModel {
            projectors: Mutex::new(BoundedLruCache::new(PROJECTOR_CACHE_CAPACITY)),
            model: Arc::new(model),
        }))
    })
}

/// Return the cached vision projector for this model, loading it on first use. Errors if the model's
/// mmproj does not support image input.
fn cached_mtmd(
    entry: &CachedModel,
    identity: &VerifiedFileIdentity,
) -> Result<Arc<CachedProjector>, String> {
    lock_unpoisoned(&entry.projectors).get_or_try_insert_with(identity.clone(), || {
        let mmproj = identity.path().to_str().ok_or("mmproj path not utf-8")?;
        // media_marker stays the default `<__media__>`, which we embed in the prompt.
        let mut params = MtmdContextParams::default();
        params.use_gpu = false;
        let model = entry.model.clone();
        let context = MtmdContext::init_from_file(mmproj, model.as_ref(), &params)
            .map_err(|e| format!("init mtmd projector: {e}"))?;
        if !context.support_vision() {
            return Err("projector does not support image input".to_string());
        }
        Ok(Arc::new(CachedProjector {
            context,
            _model: model,
        }))
    })
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
    let template_src = template
        .to_str()
        .map_err(|e| format!("template not utf-8: {e}"))?;

    let mut env = minijinja::Environment::new();
    // Make HF templates' Python-isms (.get/.split/.items/slicing) resolve instead of erroring.
    env.set_unknown_method_callback(minijinja_contrib::pycompat::unknown_method_callback);
    // Some templates call raise_exception(...) to reject unsupported inputs; surface it as an error.
    env.add_function(
        "raise_exception",
        |msg: String| -> Result<minijinja::Value, minijinja::Error> {
            Err(minijinja::Error::new(
                minijinja::ErrorKind::InvalidOperation,
                msg,
            ))
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
        batch
            .add(token, n_cur, &[0], true)
            .map_err(|e| e.to_string())?;
        n_cur += 1;
        ctx.decode(&mut batch).map_err(|e| format!("decode: {e}"))?;
    }

    Ok(output)
}

/// Load a GGUF model and generate up to `max_tokens` tokens for `prompt`. When `response_schema` (a JSON
/// Schema string) is supplied the model is asked (best-effort) to return JSON conforming to it.
/// Synchronous + compute-heavy — callers run it on a blocking thread.
pub fn run_text_inference(
    model_identity: &VerifiedFileIdentity,
    prompt: &str,
    max_tokens: u32,
    response_schema: Option<&str>,
) -> Result<String, String> {
    let backend = shared_backend()?;
    let entry = cached_model(model_identity)?;
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
    ctx.decode(&mut batch)
        .map_err(|e| format!("decode prompt: {e}"))?;

    generate(model, &mut ctx, tokens.len() as i32, max_tokens)
}

/// Load a GGUF model plus its mmproj projector and generate a response for `prompt` grounded in a single
/// image (`image_bytes`: any stb_image-supported encoding — png/jpg/bmp/gif). Synchronous +
/// compute-heavy — callers run it on a blocking thread.
pub fn run_multimodal_inference(
    model_identity: &VerifiedFileIdentity,
    projector_identity: &VerifiedFileIdentity,
    prompt: &str,
    image_bytes: &[u8],
    max_tokens: u32,
    response_schema: Option<&str>,
) -> Result<String, String> {
    let backend = shared_backend()?;
    let entry = cached_model(model_identity)?;
    let model = entry.model.as_ref();

    let ctx_params = LlamaContextParams::default().with_n_ctx(NonZeroU32::new(DEFAULT_N_CTX));
    let mut ctx = model
        .new_context(backend, ctx_params)
        .map_err(|e| format!("create context: {e}"))?;

    // The vision projector (like the model) is loaded once and reused across calls.
    let mtmd = cached_mtmd(entry.as_ref(), projector_identity)?;
    let mtmd_ctx = &mtmd.context;

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
    use std::cell::Cell;

    fn test_identity(directory: &Path, file_name: &str, digest_byte: u8) -> VerifiedFileIdentity {
        VerifiedFileIdentity::from_verified_sha256(
            directory.join(file_name),
            &format!("{digest_byte:02x}").repeat(32),
        )
        .expect("test digest is valid")
    }

    fn verified_fixture_identity(path: &Path) -> VerifiedFileIdentity {
        use sha2::{Digest, Sha256};

        let mut file = std::fs::File::open(path).expect("open inference fixture");
        let mut hasher = Sha256::new();
        std::io::copy(&mut file, &mut hasher).expect("hash inference fixture");
        VerifiedFileIdentity::from_verified_sha256(path.to_owned(), &hex::encode(hasher.finalize()))
            .expect("fixture digest is valid")
    }

    #[test]
    fn same_id_atomic_replacement_uses_new_verified_content() {
        let directory = Path::new("models").join("same-id");
        let original = test_identity(&directory, "model.gguf", 0x11);
        let replacement = test_identity(&directory, "model.gguf", 0x22);
        let loads = Cell::new(0);
        let mut cache = BoundedLruCache::new(MODEL_CACHE_CAPACITY);

        let first = cache
            .get_or_try_insert_with(original.clone(), || {
                loads.set(loads.get() + 1);
                Ok::<_, ()>(Arc::new("original"))
            })
            .expect("load original");
        assert_eq!(*first, "original");
        let first_weak = Arc::downgrade(&first);

        let promotion = Ok::<_, &str>(());
        cache.invalidate_matching_after(&promotion, |key| key.belongs_to(&directory));
        assert!(!cache.contains_key(&original));
        drop(first);
        assert!(
            first_weak.upgrade().is_none(),
            "committed replacement releases the previous allocation"
        );

        let second = cache
            .get_or_try_insert_with(replacement.clone(), || {
                loads.set(loads.get() + 1);
                Ok::<_, ()>(Arc::new("replacement"))
            })
            .expect("load replacement");

        assert_eq!(*second, "replacement");
        assert_eq!(loads.get(), 2, "a new verified digest must force a reload");
        assert!(!cache.contains_key(&original));
        assert!(cache.contains_key(&replacement));
    }

    #[test]
    fn identical_verified_content_reuses_cached_value() {
        let directory = Path::new("models").join("same-content");
        let identity = test_identity(&directory, "model.gguf", 0x12);
        let loads = Cell::new(0);
        let mut cache = BoundedLruCache::new(MODEL_CACHE_CAPACITY);

        let first = cache
            .get_or_try_insert_with(identity.clone(), || {
                loads.set(loads.get() + 1);
                Ok::<_, ()>(Arc::new("loaded"))
            })
            .expect("load model");
        let second = cache
            .get_or_try_insert_with(identity, || Err::<Arc<&str>, _>("must not reload"))
            .expect("reuse model");

        assert!(Arc::ptr_eq(&first, &second));
        assert_eq!(loads.get(), 1);
    }

    #[test]
    fn verified_identity_rejects_malformed_digest_and_normalises_case() {
        let path = Path::new("models").join("identity").join("model.gguf");
        for malformed in ["", "ab", &"z".repeat(64)] {
            assert!(VerifiedFileIdentity::from_verified_sha256(path.clone(), malformed).is_err());
        }

        let lower = "ab".repeat(32);
        let upper = lower.to_ascii_uppercase();
        let lower_identity =
            VerifiedFileIdentity::from_verified_sha256(path.clone(), &lower).expect("lower digest");
        let upper_identity =
            VerifiedFileIdentity::from_verified_sha256(path, &upper).expect("upper digest");
        assert_eq!(lower_identity, upper_identity);
    }

    #[test]
    fn failed_atomic_replacement_with_successful_rollback_keeps_known_good_entry() {
        let directory = Path::new("models").join("same-id");
        let original = test_identity(&directory, "model.gguf", 0x11);
        let replacement = test_identity(&directory, "model.gguf", 0x22);
        let mut cache = BoundedLruCache::new(MODEL_CACHE_CAPACITY);
        let known_good = cache
            .get_or_try_insert_with(original.clone(), || Ok::<_, &str>(Arc::new("known-good")))
            .expect("load known-good model");

        let promotion = Err::<(), _>("atomic promotion failed");
        cache.invalidate_matching_after(&promotion, |key| key.belongs_to(&directory));

        assert_eq!(cache.len(), 1);
        assert!(cache.contains_key(&original));
        assert!(!cache.contains_key(&replacement));
        let still_cached = cache
            .get_or_try_insert_with(original, || Err::<Arc<&str>, _>("must not reload"))
            .expect("known-good model remains cached");
        assert!(Arc::ptr_eq(&known_good, &still_cached));
    }

    #[test]
    fn failed_new_identity_load_does_not_evict_lru_entry() {
        let directory = Path::new("models").join("load-failed");
        let original = test_identity(&directory, "model.gguf", 0x11);
        let replacement = test_identity(&directory, "model.gguf", 0x22);
        let mut cache = BoundedLruCache::new(MODEL_CACHE_CAPACITY);
        let known_good = cache
            .get_or_try_insert_with(original.clone(), || Ok::<_, &str>(Arc::new("known-good")))
            .expect("load known-good model");

        let failed = cache.get_or_try_insert_with(replacement.clone(), || {
            Err::<Arc<&str>, _>("replacement failed to load")
        });

        assert_eq!(failed, Err("replacement failed to load"));
        assert!(cache.contains_key(&original));
        assert!(!cache.contains_key(&replacement));
        let still_cached = cache
            .get_or_try_insert_with(original, || Err::<Arc<&str>, _>("must not reload"))
            .expect("known-good model remains cached");
        assert!(Arc::ptr_eq(&known_good, &still_cached));
    }

    #[test]
    fn successful_delete_then_reinstall_reloads_even_identical_content() {
        let directory = Path::new("models").join("reinstalled");
        let identity = test_identity(&directory, "model.gguf", 0x33);
        let mut cache = BoundedLruCache::new(MODEL_CACHE_CAPACITY);
        let original = cache
            .get_or_try_insert_with(identity.clone(), || Ok::<_, ()>(Arc::new("first-load")))
            .expect("load original");

        let deletion = Ok::<_, &str>(());
        cache.invalidate_matching_after(&deletion, |key| key.belongs_to(&directory));
        assert_eq!(
            cache.len(),
            0,
            "a committed delete must release its cache entry"
        );

        let reinstalled = cache
            .get_or_try_insert_with(identity, || Ok::<_, ()>(Arc::new("second-load")))
            .expect("load reinstall");
        assert!(!Arc::ptr_eq(&original, &reinstalled));
        assert_eq!(*reinstalled, "second-load");
    }

    #[test]
    fn failed_delete_does_not_evict_known_good_entry() {
        let directory = Path::new("models").join("delete-failed");
        let identity = test_identity(&directory, "model.gguf", 0x44);
        let mut cache = BoundedLruCache::new(MODEL_CACHE_CAPACITY);
        let known_good = cache
            .get_or_try_insert_with(identity.clone(), || Ok::<_, ()>(Arc::new("known-good")))
            .expect("load known-good model");

        let deletion = Err::<(), _>("filesystem delete failed");
        cache.invalidate_matching_after(&deletion, |key| key.belongs_to(&directory));

        let still_cached = cache
            .get_or_try_insert_with(identity, || Err::<Arc<&str>, _>("must not reload"))
            .expect("failed delete preserves known-good cache entry");
        assert!(Arc::ptr_eq(&known_good, &still_cached));
    }

    #[test]
    fn successful_live_delete_then_scratch_cleanup_failure_still_evicts() {
        let directory = Path::new("models").join("delete-committed");
        let identity = test_identity(&directory, "model.gguf", 0x45);
        let mut cache = BoundedLruCache::new(MODEL_CACHE_CAPACITY);
        let retained = Arc::new(());
        let retained_weak = Arc::downgrade(&retained);
        drop(
            cache
                .get_or_try_insert_with(identity.clone(), || Ok::<_, ()>(retained.clone()))
                .expect("cache installed model"),
        );
        drop(retained);

        let live_deletion = Ok::<_, &str>(());
        cache.invalidate_matching_after(&live_deletion, |key| key.belongs_to(&directory));
        let scratch_cleanup = Err::<(), _>("failed to remove stale partial directory");

        assert!(scratch_cleanup.is_err(), "cleanup error remains observable");
        assert!(!cache.contains_key(&identity));
        assert!(
            retained_weak.upgrade().is_none(),
            "a scratch cleanup failure must not retain the deleted live model"
        );
    }

    #[test]
    fn failed_promotion_and_failed_rollback_invalidates_fail_closed() {
        let directory = Path::new("models").join("rollback-failed");
        let identity = test_identity(&directory, "model.gguf", 0x46);
        let mut cache = BoundedLruCache::new(MODEL_CACHE_CAPACITY);
        let retained = Arc::new(());
        let retained_weak = Arc::downgrade(&retained);
        drop(
            cache
                .get_or_try_insert_with(identity.clone(), || Ok::<_, ()>(retained.clone()))
                .expect("cache known-good model"),
        );
        drop(retained);

        let promotion = Err::<(), _>("promotion failed");
        let rollback = Err::<(), _>("rollback failed");
        if promotion.is_err() && rollback.is_err() {
            cache.invalidate_matching(|key| key.belongs_to(&directory));
        }

        assert!(!cache.contains_key(&identity));
        assert!(
            retained_weak.upgrade().is_none(),
            "ambiguous live-store state must not retain a cached model"
        );
    }

    #[test]
    fn projector_path_change_reloads_projector() {
        let directory = Path::new("models").join("vision");
        let first_path = test_identity(&directory, "mmproj-v1.gguf", 0x55);
        let second_path = test_identity(&directory, "mmproj-v2.gguf", 0x55);
        let loads = Cell::new(0);
        let mut cache = BoundedLruCache::new(PROJECTOR_CACHE_CAPACITY);

        let first = cache
            .get_or_try_insert_with(first_path.clone(), || {
                loads.set(loads.get() + 1);
                Ok::<_, ()>(Arc::new("projector-v1"))
            })
            .expect("load first projector");
        let second = cache
            .get_or_try_insert_with(second_path.clone(), || {
                loads.set(loads.get() + 1);
                Ok::<_, ()>(Arc::new("projector-v2"))
            })
            .expect("load changed projector path");

        assert_eq!(*first, "projector-v1");
        assert_eq!(*second, "projector-v2");
        assert_eq!(loads.get(), 2, "projector path is part of its identity");
        assert!(!cache.contains_key(&first_path));
        assert!(cache.contains_key(&second_path));
    }

    #[test]
    fn projector_digest_change_at_same_path_reloads_projector() {
        let directory = Path::new("models").join("vision-digest");
        let original = test_identity(&directory, "mmproj.gguf", 0x55);
        let replacement = test_identity(&directory, "mmproj.gguf", 0x66);
        let mut cache = BoundedLruCache::new(PROJECTOR_CACHE_CAPACITY);

        let first = cache
            .get_or_try_insert_with(original.clone(), || Ok::<_, ()>(Arc::new("projector-v1")))
            .expect("load original projector");
        let second = cache
            .get_or_try_insert_with(replacement.clone(), || {
                Ok::<_, ()>(Arc::new("projector-v2"))
            })
            .expect("load replacement projector");

        assert_eq!(*first, "projector-v1");
        assert_eq!(*second, "projector-v2");
        assert!(!cache.contains_key(&original));
        assert!(cache.contains_key(&replacement));
    }

    #[test]
    fn failed_projector_change_keeps_known_good_projector() {
        let directory = Path::new("models").join("vision");
        let original = test_identity(&directory, "mmproj-v1.gguf", 0x55);
        let replacement = test_identity(&directory, "mmproj-v2.gguf", 0x66);
        let mut cache = BoundedLruCache::new(PROJECTOR_CACHE_CAPACITY);
        let known_good = cache
            .get_or_try_insert_with(original.clone(), || Ok::<_, &str>(Arc::new("known-good")))
            .expect("load known-good projector");

        let failed = cache.get_or_try_insert_with(replacement.clone(), || {
            Err::<Arc<&str>, _>("projector failed to load")
        });

        assert_eq!(failed, Err("projector failed to load"));
        assert!(cache.contains_key(&original));
        assert!(!cache.contains_key(&replacement));
        let still_cached = cache
            .get_or_try_insert_with(original, || Err::<Arc<&str>, _>("must not reload"))
            .expect("known-good projector remains cached");
        assert!(Arc::ptr_eq(&known_good, &still_cached));
    }

    #[test]
    fn cache_bound_evicts_lru_deterministically_and_releases_memory() {
        let directory = Path::new("models");
        let first_key = test_identity(&directory.join("one"), "model.gguf", 0x01);
        let second_key = test_identity(&directory.join("two"), "model.gguf", 0x02);
        let third_key = test_identity(&directory.join("three"), "model.gguf", 0x03);
        let mut cache = BoundedLruCache::new(2);

        let first = Arc::new(());
        let second = Arc::new(());
        let first_weak = Arc::downgrade(&first);
        let second_weak = Arc::downgrade(&second);
        drop(
            cache
                .get_or_try_insert_with(first_key.clone(), || Ok::<_, ()>(first.clone()))
                .expect("cache first"),
        );
        drop(
            cache
                .get_or_try_insert_with(second_key.clone(), || Ok::<_, ()>(second.clone()))
                .expect("cache second"),
        );
        drop(first);
        drop(second);

        drop(
            cache
                .get_or_try_insert_with(first_key.clone(), || Err::<Arc<()>, _>(()))
                .expect("touch first as most recently used"),
        );
        drop(
            cache
                .get_or_try_insert_with(third_key.clone(), || Ok::<_, ()>(Arc::new(())))
                .expect("cache third"),
        );

        assert_eq!(cache.len(), 2);
        assert!(cache.contains_key(&first_key));
        assert!(
            !cache.contains_key(&second_key),
            "least recently used entry is evicted"
        );
        assert!(cache.contains_key(&third_key));
        assert!(first_weak.upgrade().is_some());
        assert!(
            second_weak.upgrade().is_none(),
            "eviction releases the retained value"
        );
    }

    #[test]
    fn model_directory_invalidation_is_scoped() {
        let first_dir = Path::new("models").join("first");
        let second_dir = Path::new("models").join("second");
        let first = test_identity(&first_dir, "model.gguf", 0x77);
        let second = test_identity(&second_dir, "model.gguf", 0x88);
        let mut cache = BoundedLruCache::new(2);
        cache
            .get_or_try_insert_with(first.clone(), || Ok::<_, ()>(Arc::new("first")))
            .expect("cache first");
        cache
            .get_or_try_insert_with(second.clone(), || Ok::<_, ()>(Arc::new("second")))
            .expect("cache second");

        let mutation = Ok::<_, ()>(());
        cache.invalidate_matching_after(&mutation, |key| key.belongs_to(&first_dir));

        assert!(!cache.contains_key(&first));
        assert!(cache.contains_key(&second));
    }

    #[test]
    fn production_cache_limits_are_intentionally_small() {
        assert_eq!(MODEL_CACHE_CAPACITY, 1);
        assert_eq!(PROJECTOR_CACHE_CAPACITY, 1);
    }

    // Text smoke test. Explicitly ignored by default because it requires a real GGUF. Run with:
    //   set CMAKE_GENERATOR="Visual Studio 17 2022"
    //   set OC_TEST_MODEL_GGUF=C:\path\to\gemma-4-E2B-it-Q4_K_M.gguf
    //   cargo test --features inference -- --nocapture text_inference_smoke
    #[test]
    #[ignore = "requires OC_TEST_MODEL_GGUF; CI runs this explicitly with a pinned fixture"]
    fn text_inference_smoke() {
        let path = std::env::var("OC_TEST_MODEL_GGUF")
            .expect("OC_TEST_MODEL_GGUF must name a real GGUF fixture");
        let identity = verified_fixture_identity(Path::new(&path));
        let output = run_text_inference(
            &identity,
            "In one short sentence, what is a bicycle?",
            64,
            None,
        )
        .expect("text inference failed");
        // Also write to a file — stderr gets mangled under PowerShell's native-command capture.
        std::fs::write(std::env::temp_dir().join("oc_inference_smoke.txt"), &output).ok();
        eprintln!("=== text output ===\n{output}\n===================");
        assert!(
            !output.trim().is_empty(),
            "expected non-empty generated text"
        );
    }

    // Extract the first balanced-ish JSON object from possibly prose/fence-wrapped text.
    fn extract_json_object(s: &str) -> Option<String> {
        let start = s.find('{')?;
        let end = s.rfind('}')?;
        (end > start).then(|| s[start..=end].to_string())
    }

    // Structured-output smoke test (best-effort): with a JSON Schema the model is asked to return matching
    // JSON. Explicitly ignored by default because it requires a real GGUF.
    #[test]
    #[ignore = "requires OC_TEST_MODEL_GGUF fixture"]
    fn structured_output_smoke() {
        let path = std::env::var("OC_TEST_MODEL_GGUF")
            .expect("OC_TEST_MODEL_GGUF must name a real GGUF fixture");
        let identity = verified_fixture_identity(Path::new(&path));
        let schema = r#"{
            "type": "object",
            "properties": {
                "animal": { "type": "string" },
                "legs": { "type": "integer" }
            },
            "required": ["animal", "legs"]
        }"#;
        let output = run_text_inference(
            &identity,
            "Describe a dog with its number of legs.",
            128,
            Some(schema),
        )
        .expect("structured inference failed");
        std::fs::write(
            std::env::temp_dir().join("oc_structured_smoke.txt"),
            &output,
        )
        .ok();
        eprintln!("=== structured output ===\n{output}\n=========================");
        // Best-effort: pull the JSON object out of the (possibly prose-wrapped) output and parse it.
        let json = extract_json_object(&output).expect("expected a JSON object in the output");
        let value: serde_json::Value =
            serde_json::from_str(&json).expect("extracted JSON should parse");
        assert!(value.get("animal").is_some(), "missing 'animal' key");
        assert!(value.get("legs").is_some(), "missing 'legs' key");
    }

    // Vision smoke test. Explicitly ignored by default because it requires a model, projector and
    // image fixture. Run with the three env vars plus CMAKE_GENERATOR, then:
    //   cargo test --features inference -- --nocapture vision_inference_smoke
    #[test]
    #[ignore = "requires OC_TEST_MODEL_GGUF, OC_TEST_MMPROJ_GGUF and OC_TEST_IMAGE fixtures"]
    fn vision_inference_smoke() {
        let model = std::env::var("OC_TEST_MODEL_GGUF")
            .expect("OC_TEST_MODEL_GGUF must name a real GGUF fixture");
        let mmproj = std::env::var("OC_TEST_MMPROJ_GGUF")
            .expect("OC_TEST_MMPROJ_GGUF must name a real projector fixture");
        let image =
            std::env::var("OC_TEST_IMAGE").expect("OC_TEST_IMAGE must name a real image fixture");
        let bytes = std::fs::read(&image).expect("read test image");
        let model_identity = verified_fixture_identity(Path::new(&model));
        let projector_identity = verified_fixture_identity(Path::new(&mmproj));
        let output = run_multimodal_inference(
            &model_identity,
            &projector_identity,
            "What is in this image? Answer in one short sentence.",
            &bytes,
            64,
            None,
        )
        .expect("multimodal inference failed");
        std::fs::write(std::env::temp_dir().join("oc_vision_smoke.txt"), &output).ok();
        eprintln!("=== vision output ===\n{output}\n=====================");
        assert!(
            !output.trim().is_empty(),
            "expected non-empty generated text"
        );
    }
}
