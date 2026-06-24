use futures_util::StreamExt;
use reqwest::Client;
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Emitter, Manager, Runtime};

use crate::models::{DownloadModelRequest, InferRequest, InferResponse, LocalModel};

// Generic on-device model store (design deliverable A): downloads/verifies/lists/removes user-selected
// models under the app data dir, and dispatches inference to the native runtime. Nothing is bundled; the
// catalog and prompts are caller-supplied. Mirrors the streamed-download pattern in `update_manager.rs`.

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ModelDownloadProgress {
    model_id: String,
    received_bytes: u64,
    total_bytes: u64,
}

pub struct ModelManager<R: Runtime> {
    app_handle: AppHandle<R>,
}

impl<R: Runtime> ModelManager<R> {
    pub fn new(app_handle: AppHandle<R>) -> Self {
        Self { app_handle }
    }

    fn models_dir(&self) -> Option<PathBuf> {
        self.app_handle
            .path()
            .app_data_dir()
            .ok()
            .map(|p| p.join("models"))
    }

    fn model_dir(&self, model_id: &str) -> Option<PathBuf> {
        self.models_dir().map(|p| p.join(sanitize(model_id)))
    }

    // Download (and SHA-256 verify) all of a model's files, emitting "model-download-progress" events.
    // Idempotent: already-present, verified files are skipped.
    pub async fn download_model(&self, req: DownloadModelRequest) -> Result<(), String> {
        let dir = self
            .model_dir(&req.model_id)
            .ok_or("could not resolve app data dir")?;
        fs::create_dir_all(&dir).map_err(|e| e.to_string())?;

        let total_bytes: u64 = req.files.iter().map(|f| f.bytes).sum();
        let mut received: u64 = 0;
        let client = Client::new();

        for file in &req.files {
            let dest = dir.join(file_name_from_url(&file.url));

            if dest.exists() && verify_sha256(&dest, &file.sha256).unwrap_or(false) {
                received = received.saturating_add(file.bytes);
                continue;
            }

            let resp = client
                .get(&file.url)
                .send()
                .await
                .map_err(|e| e.to_string())?;
            if !resp.status().is_success() {
                return Err(format!("download failed ({}): {}", resp.status(), file.url));
            }

            let mut out = fs::File::create(&dest).map_err(|e| e.to_string())?;
            let mut hasher = Sha256::new();
            let mut stream = resp.bytes_stream();

            while let Some(chunk) = stream.next().await {
                let chunk = chunk.map_err(|e| e.to_string())?;
                hasher.update(&chunk);
                out.write_all(&chunk).map_err(|e| e.to_string())?;
                received = received.saturating_add(chunk.len() as u64);
                let _ = self.app_handle.emit(
                    "model-download-progress",
                    ModelDownloadProgress {
                        model_id: req.model_id.clone(),
                        received_bytes: received,
                        total_bytes,
                    },
                );
            }

            let digest = hex::encode(hasher.finalize());
            if !digest.eq_ignore_ascii_case(&file.sha256) {
                let _ = fs::remove_file(&dest);
                return Err(format!("sha256 mismatch for {}", file.url));
            }
        }

        // Persist a manifest so list_local_models can report the runtime + footprint.
        let manifest = LocalModel {
            model_id: req.model_id.clone(),
            runtime: req.runtime.clone(),
            size_bytes: total_bytes,
            path: dir.to_string_lossy().to_string(),
        };
        fs::write(
            dir.join("model.json"),
            serde_json::to_vec(&manifest).map_err(|e| e.to_string())?,
        )
        .map_err(|e| e.to_string())?;

        Ok(())
    }

    pub fn list_local_models(&self) -> Result<Vec<LocalModel>, String> {
        let Some(dir) = self.models_dir() else {
            return Ok(Vec::new());
        };
        if !dir.exists() {
            return Ok(Vec::new());
        }

        let mut models = Vec::new();
        for entry in fs::read_dir(&dir).map_err(|e| e.to_string())? {
            let entry = entry.map_err(|e| e.to_string())?;
            let manifest = entry.path().join("model.json");
            if manifest.exists()
                && let Ok(bytes) = fs::read(&manifest)
                && let Ok(model) = serde_json::from_slice::<LocalModel>(&bytes)
            {
                models.push(model);
            }
        }
        Ok(models)
    }

    pub fn delete_model(&self, model_id: &str) -> Result<(), String> {
        if let Some(dir) = self.model_dir(model_id)
            && dir.exists()
        {
            fs::remove_dir_all(&dir).map_err(|e| e.to_string())?;
        }
        Ok(())
    }

    pub async fn infer(&self, req: InferRequest) -> Result<InferResponse, String> {
        #[cfg(feature = "inference")]
        {
            let dir = self
                .model_dir(&req.model_id)
                .ok_or("could not resolve model dir")?;
            let gguf = find_gguf(&dir).ok_or("no GGUF model file found for this model")?;
            let prompt = req.prompt.clone();
            let max_tokens = req.max_tokens.unwrap_or(512);
            let schema = req.response_schema.clone();
            // llama.cpp inference is synchronous and compute-heavy — keep it off the async runtime.
            // With an image, route through the multimodal path (mtmd + the model's mmproj projector);
            // otherwise text-only.
            let text = match req.image {
                Some(image) if !image.is_empty() => {
                    let mmproj = find_mmproj(&dir).ok_or(
                        "this model has no vision projector (mmproj) file; it cannot process images",
                    )?;
                    tokio::task::spawn_blocking(move || {
                        crate::inference::run_multimodal_inference(
                            &gguf,
                            &mmproj,
                            &prompt,
                            &image,
                            max_tokens,
                            schema.as_deref(),
                        )
                    })
                    .await
                    .map_err(|e| e.to_string())??
                }
                _ => tokio::task::spawn_blocking(move || {
                    crate::inference::run_text_inference(&gguf, &prompt, max_tokens, schema.as_deref())
                })
                .await
                .map_err(|e| e.to_string())??,
            };
            Ok(InferResponse { text })
        }
        #[cfg(not(feature = "inference"))]
        {
            let _ = req;
            Err("this build was compiled without the on-device inference runtime (enable the `inference` cargo feature)".to_string())
        }
    }
}

// Keep a model id usable as a single path segment (defence against traversal / odd characters).
fn sanitize(value: &str) -> String {
    value
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '-' || c == '_' || c == '.' {
                c
            } else {
                '_'
            }
        })
        .collect()
}

fn file_name_from_url(url: &str) -> String {
    let trimmed = url.split(['?', '#']).next().unwrap_or(url);
    let name = trimmed.rsplit('/').next().unwrap_or("model.bin");
    if name.is_empty() {
        "model.bin".to_string()
    } else {
        sanitize(name)
    }
}

fn verify_sha256(path: &Path, expected: &str) -> Result<bool, String> {
    let mut file = fs::File::open(path).map_err(|e| e.to_string())?;
    let mut hasher = Sha256::new();
    std::io::copy(&mut file, &mut hasher).map_err(|e| e.to_string())?;
    Ok(hex::encode(hasher.finalize()).eq_ignore_ascii_case(expected))
}

// The main LM GGUF for a downloaded model (the vision projector mmproj is a separate file we skip here).
#[cfg(feature = "inference")]
fn find_gguf(dir: &Path) -> Option<PathBuf> {
    for entry in fs::read_dir(dir).ok()?.flatten() {
        let path = entry.path();
        let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
        if path.extension().and_then(|e| e.to_str()) == Some("gguf") && !name.contains("mmproj") {
            return Some(path);
        }
    }
    None
}

// The vision projector (mmproj) GGUF, present only for multimodal models that shipped one alongside
// the language model. Identified by the conventional "mmproj" marker in the filename.
#[cfg(feature = "inference")]
fn find_mmproj(dir: &Path) -> Option<PathBuf> {
    for entry in fs::read_dir(dir).ok()?.flatten() {
        let path = entry.path();
        let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
        if path.extension().and_then(|e| e.to_str()) == Some("gguf") && name.contains("mmproj") {
            return Some(path);
        }
    }
    None
}
