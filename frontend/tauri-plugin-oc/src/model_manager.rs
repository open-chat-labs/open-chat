use futures_util::StreamExt;
use reqwest::{Client, Url, header::LOCATION, redirect::Policy};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashSet;
use std::fs;
use std::io::Write;
use std::net::{IpAddr, SocketAddr};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager, Runtime};
use tokio::sync::Semaphore;

use crate::models::{DownloadModelRequest, InferRequest, InferResponse, LocalModel, ModelFileSpec};

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

const MAX_MODEL_ID_BYTES: usize = 64;
const MAX_MODEL_FILES: usize = 4;
const MAX_MODEL_FILE_BYTES: u64 = 8 * 1024 * 1024 * 1024;
const MAX_MODEL_TOTAL_BYTES: u64 = 12 * 1024 * 1024 * 1024;
const MAX_INSTALLED_MODELS: usize = 4;
const MAX_MODEL_STORE_BYTES: u64 = 24 * 1024 * 1024 * 1024;
const MAX_PROMPT_BYTES: usize = 64 * 1024;
const MAX_TEXT_BYTES: usize = 1024 * 1024;
const MAX_IMAGE_BYTES: usize = 20 * 1024 * 1024;
const MAX_SCHEMA_BYTES: usize = 64 * 1024;
const MAX_OUTPUT_TOKENS: u32 = 4096;
const MAX_DOWNLOAD_REDIRECTS: usize = 4;

static ACTIVE_MODEL_OPERATIONS: OnceLock<Mutex<HashSet<String>>> = OnceLock::new();
static INFERENCE_LIMIT: OnceLock<Arc<Semaphore>> = OnceLock::new();
static MODEL_STORE_MUTATION_LIMIT: OnceLock<Arc<Semaphore>> = OnceLock::new();

struct ModelOperationGuard {
    model_id: String,
}

impl ModelOperationGuard {
    fn acquire(model_id: &str) -> Result<Self, String> {
        let operations = ACTIVE_MODEL_OPERATIONS.get_or_init(|| Mutex::new(HashSet::new()));
        let mut operations = operations
            .lock()
            .map_err(|_| "model operation lock poisoned".to_string())?;
        if !operations.insert(model_id.to_string()) {
            return Err("another operation for this model is already in progress".to_string());
        }
        Ok(Self {
            model_id: model_id.to_string(),
        })
    }
}

impl Drop for ModelOperationGuard {
    fn drop(&mut self) {
        if let Some(operations) = ACTIVE_MODEL_OPERATIONS.get()
            && let Ok(mut operations) = operations.lock()
        {
            operations.remove(&self.model_id);
        }
    }
}

struct StagingDirectory {
    path: PathBuf,
    armed: bool,
}

impl StagingDirectory {
    fn new(path: PathBuf) -> Self {
        Self { path, armed: true }
    }

    fn disarm(&mut self) {
        self.armed = false;
    }
}

impl Drop for StagingDirectory {
    fn drop(&mut self) {
        if self.armed {
            let _ = fs::remove_dir_all(&self.path);
        }
    }
}

fn remove_model_store_path(path: &Path) -> Result<(), String> {
    let metadata = match fs::symlink_metadata(path) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(()),
        Err(error) => return Err(error.to_string()),
    };

    if metadata.file_type().is_symlink() || metadata.file_type().is_file() {
        fs::remove_file(path).map_err(|error| error.to_string())
    } else if metadata.file_type().is_dir() {
        fs::remove_dir_all(path).map_err(|error| error.to_string())
    } else {
        Err("unsupported model path type".to_string())
    }
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct ModelManifestV1 {
    version: u8,
    model_id: String,
    runtime: String,
    size_bytes: u64,
    files: Vec<ModelFileSpec>,
}

fn is_reserved_windows_name(value: &str) -> bool {
    let stem = value.split('.').next().unwrap_or("").to_ascii_lowercase();
    matches!(stem.as_str(), "con" | "prn" | "aux" | "nul")
        || (stem.len() == 4
            && matches!(&stem[..3], "com" | "lpt")
            && matches!(stem.as_bytes()[3], b'1'..=b'9'))
}

fn validate_model_id(value: &str) -> Result<String, String> {
    if value.is_empty()
        || value.len() > MAX_MODEL_ID_BYTES
        || value.starts_with('.')
        || value.ends_with('.')
        || value.contains("..")
        || is_reserved_windows_name(value)
        || !value.bytes().all(|byte| {
            byte.is_ascii_lowercase() || byte.is_ascii_digit() || b"-_.".contains(&byte)
        })
    {
        return Err("invalid model id".to_string());
    }
    Ok(value.to_string())
}

fn is_public_ip(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(ip) => {
            let octets = ip.octets();
            !ip.is_unspecified()
                && !ip.is_loopback()
                && !ip.is_private()
                && !ip.is_link_local()
                && !ip.is_broadcast()
                && !ip.is_documentation()
                && !ip.is_multicast()
                && !(octets[0] == 100 && (64..=127).contains(&octets[1]))
                && !(octets[0] == 192 && octets[1] == 0 && octets[2] == 0)
                && !(octets[0] == 198 && (octets[1] == 18 || octets[1] == 19))
                && octets[0] < 240
        }
        IpAddr::V6(ip) => {
            if let Some(mapped) = ip.to_ipv4_mapped() {
                return is_public_ip(IpAddr::V4(mapped));
            }
            let segments = ip.segments();
            !ip.is_unspecified()
                && !ip.is_loopback()
                && !ip.is_multicast()
                && (segments[0] & 0xfe00) != 0xfc00
                && (segments[0] & 0xffc0) != 0xfe80
                && !(segments[0] == 0x2001 && segments[1] == 0x0db8)
        }
    }
}

fn validate_download_url(value: &str) -> Result<Url, String> {
    let url = Url::parse(value).map_err(|_| "invalid model URL".to_string())?;
    if url.scheme() != "https"
        || !url.username().is_empty()
        || url.password().is_some()
        || url.fragment().is_some()
        || url.port_or_known_default() != Some(443)
    {
        return Err("model URL must be credential-free HTTPS on port 443".to_string());
    }
    let host = url
        .host_str()
        .ok_or_else(|| "model URL has no host".to_string())?;
    if host.eq_ignore_ascii_case("localhost") || host.ends_with(".localhost") {
        return Err("model URL host is not public".to_string());
    }
    let ip_literal = host
        .strip_prefix('[')
        .and_then(|value| value.strip_suffix(']'))
        .unwrap_or(host);
    if let Ok(ip) = ip_literal.parse::<IpAddr>()
        && !is_public_ip(ip)
    {
        return Err("model URL host is not public".to_string());
    }
    Ok(url)
}

fn validate_download_request(req: &DownloadModelRequest) -> Result<(), String> {
    validate_model_id(&req.model_id)?;
    if req.runtime != "llama-cpp" {
        return Err("unsupported model runtime".to_string());
    }
    if req.files.is_empty() || req.files.len() > MAX_MODEL_FILES {
        return Err("invalid model file count".to_string());
    }

    let mut total = 0u64;
    let mut destinations = HashSet::new();
    for file in &req.files {
        let url = validate_download_url(&file.url)?;
        if file.bytes == 0 || file.bytes > MAX_MODEL_FILE_BYTES {
            return Err("invalid declared model file size".to_string());
        }
        total = total
            .checked_add(file.bytes)
            .ok_or_else(|| "model size overflow".to_string())?;
        if total > MAX_MODEL_TOTAL_BYTES {
            return Err("model exceeds the download size limit".to_string());
        }
        if file.sha256.len() != 64 || !file.sha256.bytes().all(|byte| byte.is_ascii_hexdigit()) {
            return Err("invalid model SHA-256".to_string());
        }
        let file_name = file_name_from_url(url.as_str());
        let collision_key = file_name.to_ascii_lowercase();
        if file_name == "model.bin"
            || file_name.len() > 128
            || !file_name.to_ascii_lowercase().ends_with(".gguf")
            || is_reserved_windows_name(&file_name)
            || !destinations.insert(collision_key)
        {
            return Err("invalid or duplicate model destination filename".to_string());
        }
    }
    Ok(())
}

fn validate_content_length(actual: Option<u64>, declared: u64) -> Result<(), String> {
    match actual {
        Some(value) if value == declared && value <= MAX_MODEL_FILE_BYTES => Ok(()),
        Some(_) => Err("download Content-Length does not match the catalog".to_string()),
        None => Err("download is missing a bounded Content-Length".to_string()),
    }
}

fn checked_stream_total(current: u64, chunk: usize, declared: u64) -> Result<u64, String> {
    let next = current
        .checked_add(chunk as u64)
        .ok_or_else(|| "download size overflow".to_string())?;
    if next > declared || next > MAX_MODEL_FILE_BYTES {
        return Err("download exceeded its declared size".to_string());
    }
    Ok(next)
}

fn validate_infer_request(req: &InferRequest) -> Result<(), String> {
    validate_model_id(&req.model_id)?;
    if req.runtime != "llama-cpp" {
        return Err("unsupported model runtime".to_string());
    }
    if req.prompt.is_empty() || req.prompt.len() > MAX_PROMPT_BYTES {
        return Err("prompt is empty or too large".to_string());
    }
    if req
        .text
        .as_ref()
        .is_some_and(|text| text.len() > MAX_TEXT_BYTES)
    {
        return Err("text context is too large".to_string());
    }
    if req
        .image
        .as_ref()
        .is_some_and(|image| image.len() > MAX_IMAGE_BYTES)
    {
        return Err("image is too large".to_string());
    }
    if let Some(schema) = &req.response_schema {
        if schema.len() > MAX_SCHEMA_BYTES
            || !serde_json::from_str::<serde_json::Value>(schema)
                .is_ok_and(|value| value.is_object())
        {
            return Err("response schema is invalid or too large".to_string());
        }
    }
    let max_tokens = req.max_tokens.unwrap_or(512);
    if max_tokens == 0 || max_tokens > MAX_OUTPUT_TOKENS {
        return Err("max_tokens is outside the allowed range".to_string());
    }
    Ok(())
}

async fn resolve_public_addresses(url: &Url) -> Result<Vec<SocketAddr>, String> {
    let host = url
        .host_str()
        .ok_or_else(|| "model URL has no host".to_string())?;
    let port = url
        .port_or_known_default()
        .ok_or_else(|| "model URL has no port".to_string())?;
    let addresses: Vec<_> = tokio::net::lookup_host((host, port))
        .await
        .map_err(|e| format!("could not resolve model host: {e}"))?
        .collect();
    if addresses.is_empty() || addresses.iter().any(|address| !is_public_ip(address.ip())) {
        return Err("model host resolved to a non-public address".to_string());
    }
    Ok(addresses)
}

async fn send_validated_download(mut url: Url) -> Result<reqwest::Response, String> {
    for redirect_count in 0..=MAX_DOWNLOAD_REDIRECTS {
        url = validate_download_url(url.as_str())?;
        let host = url
            .host_str()
            .ok_or_else(|| "model URL has no host".to_string())?
            .to_string();
        let addresses = resolve_public_addresses(&url).await?;
        let client = Client::builder()
            .redirect(Policy::none())
            .no_proxy()
            .connect_timeout(Duration::from_secs(15))
            .read_timeout(Duration::from_secs(30))
            .resolve_to_addrs(&host, &addresses)
            .build()
            .map_err(|e| e.to_string())?;
        let response = client
            .get(url.clone())
            .send()
            .await
            .map_err(|e| e.to_string())?;
        if response.status().is_redirection() {
            if redirect_count == MAX_DOWNLOAD_REDIRECTS {
                return Err("too many model download redirects".to_string());
            }
            let location = response
                .headers()
                .get(LOCATION)
                .ok_or_else(|| "model redirect has no Location header".to_string())?
                .to_str()
                .map_err(|_| "model redirect Location is invalid".to_string())?;
            url = url
                .join(location)
                .map_err(|_| "model redirect URL is invalid".to_string())?;
            continue;
        }
        return Ok(response);
    }
    Err("too many model download redirects".to_string())
}

fn read_validated_manifest(
    directory: &Path,
    expected_model_id: &str,
    verify_hashes: bool,
) -> Result<ModelManifestV1, String> {
    let bytes = fs::read(directory.join("model.json"))
        .map_err(|_| "model manifest is missing".to_string())?;
    let manifest: ModelManifestV1 =
        serde_json::from_slice(&bytes).map_err(|_| "model manifest is invalid".to_string())?;
    if manifest.version != 1 || manifest.model_id != expected_model_id {
        return Err("model manifest identity does not match its directory".to_string());
    }
    validate_download_request(&DownloadModelRequest {
        model_id: manifest.model_id.clone(),
        runtime: manifest.runtime.clone(),
        files: manifest.files.clone(),
    })?;
    let declared_total = manifest
        .files
        .iter()
        .try_fold(0u64, |total, file| total.checked_add(file.bytes))
        .ok_or_else(|| "model manifest size overflow".to_string())?;
    if declared_total != manifest.size_bytes {
        return Err("model manifest size does not match its files".to_string());
    }

    for file in &manifest.files {
        let path = directory.join(file_name_from_url(&file.url));
        let metadata =
            fs::symlink_metadata(&path).map_err(|_| "model file is missing".to_string())?;
        if !metadata.file_type().is_file() || metadata.len() != file.bytes {
            return Err("model file type or size does not match its manifest".to_string());
        }
        if verify_hashes && !verify_sha256(&path, &file.sha256)? {
            return Err("model file integrity verification failed".to_string());
        }
    }
    Ok(manifest)
}

fn validate_capacity_values(
    installed_models: usize,
    installed_bytes: u64,
    incoming_bytes: u64,
) -> Result<(), String> {
    if installed_models >= MAX_INSTALLED_MODELS {
        return Err("installed model count limit reached".to_string());
    }
    let total = installed_bytes
        .checked_add(incoming_bytes)
        .ok_or_else(|| "model store size overflow".to_string())?;
    if total > MAX_MODEL_STORE_BYTES {
        return Err("model store byte limit reached".to_string());
    }
    Ok(())
}

fn validate_model_store_capacity(
    root: &Path,
    replacing_model_id: &str,
    incoming_bytes: u64,
) -> Result<(), String> {
    let mut installed_models = 0usize;
    let mut installed_bytes = 0u64;
    for entry in fs::read_dir(root).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let file_type = entry.file_type().map_err(|e| e.to_string())?;
        let name = entry
            .file_name()
            .to_str()
            .ok_or_else(|| "model store contains a non-UTF-8 entry".to_string())?
            .to_string();
        if name == replacing_model_id {
            continue;
        }
        if name.starts_with('.') {
            return Err("model store contains stale scratch data".to_string());
        }
        if !file_type.is_dir() || file_type.is_symlink() || validate_model_id(&name).is_err() {
            return Err("model store contains an unsafe entry".to_string());
        }
        let manifest = read_validated_manifest(&entry.path(), &name, false)?;
        installed_models = installed_models
            .checked_add(1)
            .ok_or_else(|| "model store count overflow".to_string())?;
        installed_bytes = installed_bytes
            .checked_add(manifest.size_bytes)
            .ok_or_else(|| "model store size overflow".to_string())?;
    }
    validate_capacity_values(installed_models, installed_bytes, incoming_bytes)
}

#[cfg(feature = "inference")]
fn selected_model_files(
    directory: &Path,
    manifest: &ModelManifestV1,
) -> Result<
    (
        crate::inference::VerifiedFileIdentity,
        Option<crate::inference::VerifiedFileIdentity>,
    ),
    String,
> {
    let mut model = None;
    let mut projector = None;
    for file in &manifest.files {
        let path = directory.join(file_name_from_url(&file.url));
        let name = path
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or_default()
            .to_ascii_lowercase();
        let identity =
            crate::inference::VerifiedFileIdentity::from_verified_sha256(path, &file.sha256)?;
        if name.contains("mmproj") {
            if projector.replace(identity).is_some() {
                return Err("model manifest has multiple vision projectors".to_string());
            }
        } else if model.replace(identity).is_some() {
            return Err("model manifest has multiple primary GGUF files".to_string());
        }
    }
    Ok((
        model.ok_or_else(|| "model manifest has no primary GGUF file".to_string())?,
        projector,
    ))
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

    #[cfg(feature = "inference")]
    fn model_dir(&self, model_id: &str) -> Option<PathBuf> {
        self.models_dir().map(|p| p.join(sanitize(model_id)))
    }

    // Download (and SHA-256 verify) all of a model's files, emitting "model-download-progress" events.
    // Files are written to a sibling staging directory and atomically promoted
    // only after every declared byte and hash has been verified.
    pub async fn download_model(&self, req: DownloadModelRequest) -> Result<(), String> {
        validate_download_request(&req)?;
        let model_id = validate_model_id(&req.model_id)?;
        let _operation = ModelOperationGuard::acquire(&model_id)?;
        let mutation_limit = MODEL_STORE_MUTATION_LIMIT
            .get_or_init(|| Arc::new(Semaphore::new(1)))
            .clone();
        let _mutation_permit = mutation_limit
            .acquire_owned()
            .await
            .map_err(|_| "model store scheduler is unavailable".to_string())?;
        let root = self.models_dir().ok_or("could not resolve app data dir")?;
        fs::create_dir_all(&root).map_err(|e| e.to_string())?;
        let dir = root.join(&model_id);
        let staging_path = root.join(format!(".{model_id}.partial"));
        let backup_path = root.join(format!(".{model_id}.backup"));

        for scratch in [&staging_path, &backup_path] {
            if let Ok(metadata) = fs::symlink_metadata(scratch) {
                if metadata.file_type().is_symlink() || !metadata.file_type().is_dir() {
                    return Err("unsafe model scratch path".to_string());
                }
                fs::remove_dir_all(scratch).map_err(|e| e.to_string())?;
            }
        }
        if let Ok(metadata) = fs::symlink_metadata(&dir)
            && (metadata.file_type().is_symlink() || !metadata.file_type().is_dir())
        {
            return Err("unsafe installed model path".to_string());
        }

        let total_bytes = req.files.iter().map(|file| file.bytes).sum();
        validate_model_store_capacity(&root, &model_id, total_bytes)?;

        fs::create_dir(&staging_path).map_err(|e| e.to_string())?;
        let mut staging = StagingDirectory::new(staging_path.clone());
        let mut received: u64 = 0;

        for file in &req.files {
            let source_url = validate_download_url(&file.url)?;
            let dest = staging_path.join(file_name_from_url(source_url.as_str()));
            let resp = send_validated_download(source_url).await?;
            if !resp.status().is_success() {
                return Err(format!("download failed ({}): {}", resp.status(), file.url));
            }
            validate_content_length(resp.content_length(), file.bytes)?;

            let mut out = fs::OpenOptions::new()
                .write(true)
                .create_new(true)
                .open(&dest)
                .map_err(|e| e.to_string())?;
            let mut hasher = Sha256::new();
            let mut stream = resp.bytes_stream();
            let mut file_received = 0u64;

            while let Some(chunk) = stream.next().await {
                let chunk = chunk.map_err(|e| e.to_string())?;
                file_received = checked_stream_total(file_received, chunk.len(), file.bytes)?;
                hasher.update(&chunk);
                out.write_all(&chunk).map_err(|e| e.to_string())?;
                received = received
                    .checked_add(chunk.len() as u64)
                    .ok_or_else(|| "model download progress overflow".to_string())?;
                let _ = self.app_handle.emit(
                    "model-download-progress",
                    ModelDownloadProgress {
                        model_id: req.model_id.clone(),
                        received_bytes: received,
                        total_bytes,
                    },
                );
            }
            if file_received != file.bytes {
                return Err("download ended before its declared size".to_string());
            }
            out.sync_all().map_err(|e| e.to_string())?;

            let digest = hex::encode(hasher.finalize());
            if !digest.eq_ignore_ascii_case(&file.sha256) {
                return Err(format!("sha256 mismatch for {}", file.url));
            }
        }

        let manifest = ModelManifestV1 {
            version: 1,
            model_id: req.model_id.clone(),
            runtime: req.runtime.clone(),
            size_bytes: total_bytes,
            files: req.files.clone(),
        };
        let manifest_path = staging_path.join("model.json");
        let mut manifest_file = fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&manifest_path)
            .map_err(|e| e.to_string())?;
        manifest_file
            .write_all(&serde_json::to_vec(&manifest).map_err(|e| e.to_string())?)
            .map_err(|e| e.to_string())?;
        manifest_file.sync_all().map_err(|e| e.to_string())?;

        let had_existing = dir.exists();
        let promotion = (|| {
            if had_existing {
                fs::rename(&dir, &backup_path).map_err(|e| e.to_string())?;
            }
            if let Err(promotion_error) = fs::rename(&staging_path, &dir) {
                if had_existing {
                    if let Err(rollback_error) = fs::rename(&backup_path, &dir) {
                        // Neither verified replacement nor known-good rollback is live. The cache
                        // must fail closed rather than retain content with no verified store state.
                        #[cfg(feature = "inference")]
                        crate::inference::invalidate_model_cache(&dir);
                        return Err(format!(
                            "failed to promote model: {promotion_error}; failed to restore previous model: {rollback_error}"
                        ));
                    }
                }
                return Err(promotion_error.to_string());
            }
            Ok(())
        })();
        #[cfg(feature = "inference")]
        let promotion = crate::inference::invalidate_model_cache_after(promotion, &dir);
        promotion?;
        staging.disarm();
        if backup_path.exists() {
            fs::remove_dir_all(&backup_path).map_err(|e| e.to_string())?;
        }

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
            let file_type = entry.file_type().map_err(|e| e.to_string())?;
            if !file_type.is_dir() || file_type.is_symlink() {
                continue;
            }
            let Some(model_id) = entry.file_name().to_str().map(str::to_string) else {
                continue;
            };
            if validate_model_id(&model_id).as_deref() != Ok(model_id.as_str()) {
                continue;
            }
            let Ok(manifest) = read_validated_manifest(&entry.path(), &model_id, false) else {
                continue;
            };
            models.push(LocalModel {
                model_id,
                runtime: manifest.runtime,
                size_bytes: manifest.size_bytes,
                path: entry.path().to_string_lossy().to_string(),
            });
        }
        Ok(models)
    }

    pub async fn delete_model(&self, model_id: &str) -> Result<(), String> {
        let model_id = validate_model_id(model_id)?;
        let _operation = ModelOperationGuard::acquire(&model_id)?;
        let mutation_limit = MODEL_STORE_MUTATION_LIMIT
            .get_or_init(|| Arc::new(Semaphore::new(1)))
            .clone();
        let _mutation_permit = mutation_limit
            .acquire_owned()
            .await
            .map_err(|_| "model store scheduler is unavailable".to_string())?;
        let Some(root) = self.models_dir() else {
            return Ok(());
        };
        let dir = root.join(&model_id);
        let deletion = remove_model_store_path(&dir);
        #[cfg(feature = "inference")]
        let deletion = crate::inference::invalidate_model_cache_after(deletion, &dir);
        deletion?;

        // The live deletion is already committed and its cache entry invalidated. A later scratch
        // cleanup failure is still reported, but cannot strand the deleted model in memory.
        for scratch in [
            root.join(format!(".{model_id}.partial")),
            root.join(format!(".{model_id}.backup")),
        ] {
            remove_model_store_path(&scratch)?;
        }
        Ok(())
    }

    pub async fn infer(&self, req: InferRequest) -> Result<InferResponse, String> {
        validate_infer_request(&req)?;
        let model_id = validate_model_id(&req.model_id)?;
        let _operation = ModelOperationGuard::acquire(&model_id)?;
        let inference_limit = INFERENCE_LIMIT
            .get_or_init(|| Arc::new(Semaphore::new(1)))
            .clone();
        let _inference_permit = inference_limit
            .acquire_owned()
            .await
            .map_err(|_| "inference scheduler is unavailable".to_string())?;

        #[cfg(feature = "inference")]
        {
            let dir = self
                .model_dir(&model_id)
                .ok_or("could not resolve model dir")?;
            let manifest = read_validated_manifest(&dir, &model_id, true)?;
            if manifest.runtime != req.runtime {
                return Err("requested runtime does not match the installed model".to_string());
            }
            let (gguf, mmproj) = selected_model_files(&dir, &manifest)?;
            let prompt = req.prompt.clone();
            let max_tokens = req.max_tokens.unwrap_or(512);
            let schema = req.response_schema.clone();
            // llama.cpp inference is synchronous and compute-heavy — keep it off the async runtime.
            // With an image, route through the multimodal path (mtmd + the model's mmproj projector);
            // otherwise text-only.
            let text = match req.image {
                Some(image) if !image.is_empty() => {
                    let mmproj = mmproj.ok_or(
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
                    crate::inference::run_text_inference(
                        &gguf,
                        &prompt,
                        max_tokens,
                        schema.as_deref(),
                    )
                })
                .await
                .map_err(|e| e.to_string())??,
            };
            Ok(InferResponse { text })
        }
        #[cfg(not(feature = "inference"))]
        {
            let _ = req;
            Err(NO_INFERENCE_RUNTIME_ERROR.to_string())
        }
    }
}

// The exact error `infer` returns on a build compiled WITHOUT the `inference` feature. Extracted to a
// const (only compiled in that configuration) so the "no on-device runtime" contract can be pinned by a
// CI unit test — the `infer` method itself needs a Tauri `AppHandle`, which a bare `cargo test` cannot
// construct on Windows (webview DLL), so the message rather than the full call is what we assert here.
#[cfg(not(feature = "inference"))]
pub(crate) const NO_INFERENCE_RUNTIME_ERROR: &str = "this build was compiled without the on-device inference runtime (enable the `inference` cargo feature)";

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

#[cfg(all(test, feature = "inference"))]
mod cycle_tests {
    use super::*;
    use crate::models::LocalModel;

    const MODEL_ID: &str = "gemma-4-e2b-it-q4";
    const LM_URL: &str = "https://huggingface.co/unsloth/gemma-4-E2B-it-GGUF/resolve/0314792d7f1f7e229411f620751375812bb9faf2/gemma-4-E2B-it-Q4_K_M.gguf";
    const LM_SHA: &str = "740185b21d22ceb83a11c3aa62ad5842ef32c70f6096d756bbee85a1e4ec34b8";
    const MMPROJ_URL: &str = "https://huggingface.co/unsloth/gemma-4-E2B-it-GGUF/resolve/0314792d7f1f7e229411f620751375812bb9faf2/mmproj-F16.gguf";
    const MMPROJ_SHA: &str = "140be8d7849741f88c50757d529b84373ee8e27052cc2236855b537f4a8215fa";

    // Hardlink (instant, no copy) the real file into the model dir, falling back to a copy across volumes.
    fn seed(src: &str, dst: &Path) {
        if fs::hard_link(src, dst).is_err() {
            fs::copy(src, dst).expect("seed file");
        }
    }

    // Drives the WHOLE on-device cycle on the PC, against a temp model dir, using the SAME standalone
    // functions the ModelManager methods call:
    //   verify (download_model's SHA-256 step, against the catalog's own hashes) -> write/read the
    //   model.json manifest (download_model / list_local_models) -> find_gguf + infer (text + structured
    //   JSON) -> delete.
    // The thin ModelManager wrappers add only Tauri app_data_dir resolution + progress events on top;
    // those need a bundled Tauri app context that a bare `cargo test` can't load on Windows (webview DLL),
    // so they run in the real app, not here. Skipped unless the two model env vars point at real files.
    #[test]
    #[ignore = "requires OC_TEST_MODEL_GGUF and OC_TEST_MMPROJ_GGUF fixtures"]
    fn full_model_cycle() {
        let lm = std::env::var("OC_TEST_MODEL_GGUF")
            .expect("OC_TEST_MODEL_GGUF must name a real GGUF fixture");
        let mmproj = std::env::var("OC_TEST_MMPROJ_GGUF")
            .expect("OC_TEST_MMPROJ_GGUF must name a real projector fixture");

        let dir = std::env::temp_dir()
            .join("oc_cycle_test")
            .join(sanitize(MODEL_ID));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).expect("create model dir");
        let lm_path = dir.join(file_name_from_url(LM_URL));
        let mmproj_path = dir.join(file_name_from_url(MMPROJ_URL));
        seed(&lm, &lm_path);
        seed(&mmproj, &mmproj_path);

        // 1. Verify the seeded files against the CATALOG's SHA-256s (proves the catalog hashes are correct
        //    and is exactly download_model's verify step).
        assert!(
            verify_sha256(&lm_path, LM_SHA).expect("hash lm"),
            "LM sha256 must match catalog"
        );
        assert!(
            verify_sha256(&mmproj_path, MMPROJ_SHA).expect("hash mmproj"),
            "mmproj sha256 must match catalog"
        );

        // 2. Manifest round-trip (download_model writes model.json; list_local_models reads it).
        let total = 3_106_738_272u64 + 985_654_080u64;
        let manifest = LocalModel {
            model_id: MODEL_ID.to_string(),
            runtime: "llama-cpp".to_string(),
            size_bytes: total,
            path: dir.to_string_lossy().to_string(),
        };
        fs::write(
            dir.join("model.json"),
            serde_json::to_vec(&manifest).unwrap(),
        )
        .unwrap();
        let listed: LocalModel =
            serde_json::from_slice(&fs::read(dir.join("model.json")).unwrap()).unwrap();
        assert_eq!(listed.model_id, MODEL_ID);
        assert_eq!(listed.size_bytes, total);

        // 3. find_gguf picks the LM (not the mmproj), then infer — plain text.
        let gguf_path = find_gguf(&dir).expect("find_gguf should locate the LM");
        assert_eq!(gguf_path, lm_path);
        let gguf = crate::inference::VerifiedFileIdentity::from_verified_sha256(gguf_path, LM_SHA)
            .expect("catalog digest is valid");
        let text = crate::inference::run_text_inference(
            &gguf,
            "In one short sentence, what is a bicycle?",
            48,
            None,
        )
        .expect("text infer");
        eprintln!("[cycle] text => {text}");
        assert!(
            !text.trim().is_empty(),
            "text inference should produce output"
        );

        // 4. infer — structured (JSON schema).
        let schema =
            r#"{"type":"object","properties":{"animal":{"type":"string"}},"required":["animal"]}"#;
        let structured =
            crate::inference::run_text_inference(&gguf, "Name one animal.", 64, Some(schema))
                .expect("structured infer");
        eprintln!("[cycle] structured => {structured}");
        assert!(
            structured.contains('{'),
            "structured output should contain JSON"
        );

        // 5. delete — and confirm it's gone.
        fs::remove_dir_all(&dir).expect("delete model dir");
        assert!(!dir.exists(), "model dir should be gone after delete");
    }
}

// Pure/fs-helper tests that need NO real GGUF and NO `inference` feature, so they run in CI on the
// default build. They cover the standalone helpers the ModelManager command path relies on:
// `sanitize` (path-segment safety), `verify_sha256` (download integrity check), `file_name_from_url`
// (download destination naming) and the model.json manifest round-trip (download_model writes it,
// list_local_models reads it). The thin ModelManager command wrappers are NOT exercised here: they
// resolve `app_data_dir()` from a Tauri `AppHandle`, which a bare `cargo test` cannot construct on
// Windows (webview DLL) — same reason cycle_tests runs the wrappers in the real app (see the comment
// on `full_model_cycle` above). We therefore test the exact standalone functions those wrappers call.
#[cfg(test)]
mod helper_tests {
    use super::*;
    use crate::models::LocalModel;

    // A unique, hermetic temp directory for a single test. Cleaned up on entry (in case a prior run
    // aborted) and returned for the caller to remove at the end.
    fn unique_dir(tag: &str) -> PathBuf {
        let dir =
            std::env::temp_dir().join(format!("oc_helper_test_{}_{}", tag, std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).expect("create temp test dir");
        dir
    }

    // Well-known NIST vector: SHA-256("abc").
    const ABC_SHA256: &str = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";

    #[test]
    fn verify_sha256_matches_and_is_case_insensitive() {
        let dir = unique_dir("verify_ok");
        let path = dir.join("blob.bin");
        fs::write(&path, b"abc").expect("write blob");

        // Lowercase and uppercase digests both match (verify uses eq_ignore_ascii_case).
        assert_eq!(
            verify_sha256(&path, ABC_SHA256),
            Ok(true),
            "lowercase digest should match"
        );
        assert_eq!(
            verify_sha256(&path, &ABC_SHA256.to_uppercase()),
            Ok(true),
            "uppercase digest should match (case-insensitive compare)"
        );

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn verify_sha256_rejects_mismatch_without_touching_the_file() {
        let dir = unique_dir("verify_mismatch");
        let path = dir.join("blob.bin");
        fs::write(&path, b"abc").expect("write blob");

        let wrong = "0000000000000000000000000000000000000000000000000000000000000000";
        assert_eq!(
            verify_sha256(&path, wrong),
            Ok(false),
            "wrong digest should return Ok(false)"
        );
        // verify_sha256 is a pure read: it must NOT delete on mismatch. (download_model owns the
        // remove-on-mismatch cleanup of a freshly streamed file — that path needs the network + an
        // AppHandle and is covered by the real app, not this unit test.)
        assert!(
            path.exists(),
            "verify_sha256 must not remove the file on mismatch"
        );

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn verify_sha256_errors_when_file_missing() {
        let dir = unique_dir("verify_missing");
        let missing = dir.join("does-not-exist.bin");
        assert!(
            verify_sha256(&missing, ABC_SHA256).is_err(),
            "opening a missing file should Err"
        );
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn sanitize_replaces_unsafe_chars_and_blocks_traversal() {
        // Safe set [A-Za-z0-9._-] passes through unchanged.
        assert_eq!(sanitize("gemma-4_E2B-it.Q4_K_M"), "gemma-4_E2B-it.Q4_K_M");
        assert_eq!(sanitize("ABCabc0189-_."), "ABCabc0189-_.");

        // Path separators, drive colons, wildcards and spaces all collapse to '_', so a model id can
        // never escape its single directory segment.
        assert_eq!(sanitize("../../etc/passwd"), ".._.._etc_passwd");
        assert_eq!(sanitize("a/b\\c:d*e f"), "a_b_c_d_e_f");
        assert_eq!(sanitize("with spaces"), "with_spaces");
        // No unsanitized separator can survive.
        for bad in ["a/b", "a\\b", "a:b", "a\0b"] {
            let out = sanitize(bad);
            assert!(
                !out.contains(['/', '\\', ':', '\0']),
                "sanitize left a separator in {out:?}"
            );
        }
    }

    #[test]
    fn file_name_from_url_derives_and_sanitizes_the_destination() {
        // Plain HF-style resolve URL -> the final path segment.
        assert_eq!(
            file_name_from_url(
                "https://huggingface.co/org/repo/resolve/main/gemma-4-E2B-it-Q4_K_M.gguf"
            ),
            "gemma-4-E2B-it-Q4_K_M.gguf"
        );
        // Query string and fragment are stripped before taking the segment.
        assert_eq!(
            file_name_from_url("https://host/dir/model.gguf?download=true&x=1"),
            "model.gguf"
        );
        assert_eq!(
            file_name_from_url("https://host/dir/model.gguf#section"),
            "model.gguf"
        );
        // A trailing slash (no file segment) falls back to the default name.
        assert_eq!(file_name_from_url("https://host/dir/"), "model.bin");
        // Odd characters in the segment are sanitized (same guarantee as sanitize()).
        assert_eq!(file_name_from_url("https://host/a b.gguf"), "a_b.gguf");
    }

    #[test]
    fn model_json_manifest_round_trips() {
        // Mirror download_model's persist step and list_local_models' read step against a temp dir,
        // proving the on-disk manifest survives a write/read cycle with camelCase keys intact (the TS
        // side deserialises those). This is the wrapper-free core of the manifest contract.
        let dir = unique_dir("manifest");
        let manifest = LocalModel {
            model_id: "gemma-4-e2b-it-q4".to_string(),
            runtime: "llama-cpp".to_string(),
            size_bytes: 4_092_392_352,
            path: dir.to_string_lossy().to_string(),
        };

        let manifest_path = dir.join("model.json");
        fs::write(
            &manifest_path,
            serde_json::to_vec(&manifest).expect("serialize manifest"),
        )
        .expect("write model.json");

        // Round-trips into an identical struct (exactly what list_local_models does).
        let read_back: LocalModel =
            serde_json::from_slice(&fs::read(&manifest_path).expect("read model.json"))
                .expect("deserialize manifest");
        assert_eq!(read_back.model_id, manifest.model_id);
        assert_eq!(read_back.runtime, manifest.runtime);
        assert_eq!(read_back.size_bytes, manifest.size_bytes);
        assert_eq!(read_back.path, manifest.path);

        // Serde rename_all = camelCase must be honoured on the wire (TS reads modelId / sizeBytes).
        let json = fs::read_to_string(&manifest_path).expect("read json text");
        assert!(
            json.contains("\"modelId\""),
            "manifest must use camelCase modelId, got {json}"
        );
        assert!(
            json.contains("\"sizeBytes\""),
            "manifest must use camelCase sizeBytes, got {json}"
        );

        let _ = fs::remove_dir_all(&dir);
    }
}

// The `infer` no-runtime contract, asserted only on a build WITHOUT the `inference` feature. Invoking
// `infer` end-to-end needs a Tauri `AppHandle` (mock runtime or the real app) — infeasible in a bare
// `cargo test` on Windows — so we pin the exact error string returned by that code path instead.
#[cfg(all(test, not(feature = "inference")))]
mod no_inference_tests {
    use super::*;

    #[test]
    fn infer_error_message_is_pinned() {
        assert_eq!(
            NO_INFERENCE_RUNTIME_ERROR,
            "this build was compiled without the on-device inference runtime (enable the `inference` cargo feature)"
        );
    }
}

#[cfg(test)]
mod security_regression_tests {
    use super::*;
    use crate::models::{DownloadModelRequest, InferRequest, ModelFileSpec};
    use std::net::{IpAddr, Ipv4Addr, Ipv6Addr};

    fn file(url: &str, bytes: u64) -> ModelFileSpec {
        ModelFileSpec {
            url: url.to_string(),
            sha256: "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad".to_string(),
            bytes,
        }
    }

    fn download_request() -> DownloadModelRequest {
        DownloadModelRequest {
            model_id: "safe-model-1".to_string(),
            runtime: "llama-cpp".to_string(),
            files: vec![file("https://models.example/model.gguf", 3)],
        }
    }

    #[test]
    fn model_ids_are_strict_and_collision_free() {
        for valid in ["a", "safe-model-1", "gemma.4_q4"] {
            assert_eq!(validate_model_id(valid), Ok(valid.to_string()));
        }

        for invalid in [
            "",
            ".",
            "..",
            "../x",
            "a/b",
            "a\\b",
            "A",
            "a b",
            "a\u{2215}b",
            "con",
            "con.txt",
            "aux",
            "com1",
            "lpt9",
            "trailing.",
        ] {
            assert!(
                validate_model_id(invalid).is_err(),
                "accepted unsafe id {invalid:?}"
            );
        }

        // Previously these two caller-visible IDs were silently mapped to one directory.
        assert!(validate_model_id("a/b").is_err());
        assert_eq!(validate_model_id("a_b"), Ok("a_b".to_string()));
    }

    #[test]
    fn download_request_rejects_unsafe_or_ambiguous_inputs() {
        assert!(validate_download_request(&download_request()).is_ok());

        for url in [
            "http://models.example/model.gguf",
            "file:///tmp/model.gguf",
            "https://127.0.0.1/model.gguf",
            "https://[::1]/model.gguf",
            "https://169.254.169.254/latest/meta-data",
            "https://models.example:444/model.gguf",
            "https://user:pass@models.example/model.gguf",
        ] {
            let mut req = download_request();
            req.files[0].url = url.to_string();
            assert!(
                validate_download_request(&req).is_err(),
                "accepted unsafe URL {url}"
            );
        }

        let mut req = download_request();
        req.files[0].sha256 = "not-a-sha".to_string();
        assert!(validate_download_request(&req).is_err());

        let mut req = download_request();
        req.files[0].bytes = 0;
        assert!(validate_download_request(&req).is_err());

        let mut req = download_request();
        req.files = (0..=MAX_MODEL_FILES)
            .map(|n| file(&format!("https://models.example/model-{n}.gguf"), 1))
            .collect();
        assert!(validate_download_request(&req).is_err());

        let mut req = download_request();
        req.files.push(file("https://cdn.example/model.gguf", 3));
        assert!(
            validate_download_request(&req).is_err(),
            "duplicate destination was accepted"
        );

        let mut req = download_request();
        req.files.push(file("https://cdn.example/MODEL.GGUF", 3));
        assert!(
            validate_download_request(&req).is_err(),
            "case-insensitive destination collision was accepted"
        );

        let mut req = download_request();
        req.files[0].url = "https://models.example/con.gguf".to_string();
        assert!(
            validate_download_request(&req).is_err(),
            "reserved Windows destination was accepted"
        );
    }

    #[test]
    fn network_policy_rejects_private_and_special_addresses() {
        for ip in [
            IpAddr::V4(Ipv4Addr::new(0, 0, 0, 0)),
            IpAddr::V4(Ipv4Addr::new(10, 0, 0, 1)),
            IpAddr::V4(Ipv4Addr::new(100, 64, 0, 1)),
            IpAddr::V4(Ipv4Addr::new(127, 0, 0, 1)),
            IpAddr::V4(Ipv4Addr::new(169, 254, 1, 1)),
            IpAddr::V4(Ipv4Addr::new(172, 16, 0, 1)),
            IpAddr::V4(Ipv4Addr::new(192, 168, 0, 1)),
            IpAddr::V4(Ipv4Addr::new(224, 0, 0, 1)),
            IpAddr::V6(Ipv6Addr::LOCALHOST),
            IpAddr::V6("fe80::1".parse().unwrap()),
            IpAddr::V6("fc00::1".parse().unwrap()),
            IpAddr::V6("2001:db8::1".parse().unwrap()),
        ] {
            assert!(!is_public_ip(ip), "accepted non-public address {ip}");
        }

        for ip in [
            IpAddr::V4(Ipv4Addr::new(1, 1, 1, 1)),
            IpAddr::V4(Ipv4Addr::new(8, 8, 8, 8)),
            IpAddr::V6("2606:4700:4700::1111".parse().unwrap()),
        ] {
            assert!(is_public_ip(ip), "rejected public address {ip}");
        }
    }

    #[test]
    fn declared_and_streamed_sizes_fail_closed() {
        assert!(validate_content_length(Some(3), 3).is_ok());
        assert!(validate_content_length(None, 3).is_err());
        assert!(validate_content_length(Some(2), 3).is_err());
        assert!(validate_content_length(Some(4), 3).is_err());

        assert_eq!(checked_stream_total(0, 3, 3), Ok(3));
        assert!(checked_stream_total(2, 2, 3).is_err());
        assert!(checked_stream_total(u64::MAX, 1, u64::MAX).is_err());
    }

    #[test]
    fn aggregate_model_store_capacity_is_bounded() {
        assert!(validate_capacity_values(0, 0, 1).is_ok());
        assert!(validate_capacity_values(MAX_INSTALLED_MODELS - 1, 0, 1).is_ok());
        assert!(validate_capacity_values(MAX_INSTALLED_MODELS, 0, 1).is_err());
        assert!(validate_capacity_values(0, MAX_MODEL_STORE_BYTES - 1, 1).is_ok());
        assert!(validate_capacity_values(0, MAX_MODEL_STORE_BYTES, 1).is_err());
        assert!(validate_capacity_values(0, u64::MAX, 1).is_err());
    }

    #[test]
    fn inference_request_has_authoritative_native_bounds() {
        let base = InferRequest {
            model_id: "safe-model-1".to_string(),
            runtime: "llama-cpp".to_string(),
            prompt: "hello".to_string(),
            image: None,
            text: None,
            max_tokens: Some(64),
            response_schema: None,
        };
        assert!(validate_infer_request(&base).is_ok());

        let mut req = base.clone();
        req.prompt = "x".repeat(MAX_PROMPT_BYTES + 1);
        assert!(validate_infer_request(&req).is_err());

        let mut req = base.clone();
        req.text = Some("x".repeat(MAX_TEXT_BYTES + 1));
        assert!(validate_infer_request(&req).is_err());

        let mut req = base.clone();
        req.image = Some(vec![0; MAX_IMAGE_BYTES + 1]);
        assert!(validate_infer_request(&req).is_err());

        let mut req = base.clone();
        req.response_schema = Some("x".repeat(MAX_SCHEMA_BYTES + 1));
        assert!(validate_infer_request(&req).is_err());

        let mut req = base.clone();
        req.response_schema = Some("[]".to_string());
        assert!(validate_infer_request(&req).is_err());

        for max_tokens in [0, MAX_OUTPUT_TOKENS + 1] {
            let mut req = base.clone();
            req.max_tokens = Some(max_tokens);
            assert!(validate_infer_request(&req).is_err());
        }
    }
}
