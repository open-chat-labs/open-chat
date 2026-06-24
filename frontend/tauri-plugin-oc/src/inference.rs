//! On-device inference backend (deliverable A6): llama.cpp via the `llama-cpp-2` crate, used on every
//! platform (desktop MSVC, Android NDK, iOS XCFramework). Gated behind the `inference` cargo feature so
//! default/dev builds don't pull the C++/cmake/libclang toolchain.
//!
//! This is the text-generation path (the stable llama.cpp API). Image input (Gemma 4 vision via llama.cpp
//! `mtmd` + the model's mmproj projector) is the next step and is intentionally not wired here yet.

use std::num::NonZeroU32;
use std::path::Path;

use llama_cpp_2::context::params::LlamaContextParams;
use llama_cpp_2::llama_backend::LlamaBackend;
use llama_cpp_2::llama_batch::LlamaBatch;
use llama_cpp_2::model::params::LlamaModelParams;
use llama_cpp_2::model::{AddBos, LlamaModel, Special};
use llama_cpp_2::sampling::LlamaSampler;

/// Load a GGUF model and generate up to `max_tokens` tokens for `prompt`. Synchronous + compute-heavy —
/// callers run it on a blocking thread.
pub fn run_text_inference(model_path: &Path, prompt: &str, max_tokens: u32) -> Result<String, String> {
    let backend = LlamaBackend::init().map_err(|e| format!("init backend: {e}"))?;

    let model_params = LlamaModelParams::default();
    let model =
        LlamaModel::load_from_file(&backend, model_path, &model_params).map_err(|e| format!("load model: {e}"))?;

    let ctx_params = LlamaContextParams::default().with_n_ctx(NonZeroU32::new(4096));
    let mut ctx = model
        .new_context(&backend, ctx_params)
        .map_err(|e| format!("create context: {e}"))?;

    let tokens = model
        .str_to_token(prompt, AddBos::Always)
        .map_err(|e| format!("tokenize: {e}"))?;

    let mut batch = LlamaBatch::new(512, 1);
    let last_index = (tokens.len() - 1) as i32;
    for (i, token) in tokens.iter().enumerate() {
        let is_last = i as i32 == last_index;
        batch.add(*token, i as i32, &[0], is_last).map_err(|e| e.to_string())?;
    }
    ctx.decode(&mut batch).map_err(|e| format!("decode prompt: {e}"))?;

    let mut sampler = LlamaSampler::greedy();
    let mut output = String::new();
    let mut n_cur = batch.n_tokens();

    for _ in 0..max_tokens {
        let token = sampler.sample(&ctx, batch.n_tokens() - 1);
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
