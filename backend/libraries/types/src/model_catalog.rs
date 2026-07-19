use candid::{CandidType, Deserialize};
use serde::Serialize;
use std::collections::HashSet;

// The on-device model catalog, stored owner-configurable on the `registry` canister and read by the
// Model Manager. This is DATA — each entry merely points at publicly hosted GGUF files the user
// chooses to download, SHA-256-verify and run locally. Nothing here is a dependency of OpenChat.
//
// This mirrors the frontend `ModelCatalog` domain type (openchat-shared). It is intentionally NOT
// `#[ts_export]`ed: the frontend keeps its hand-written domain type and maps the canister response to
// it, so the pre-existing on-device types are undisturbed. `catalog_version` lets a client cheaply
// detect a change.
#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Default)]
pub struct ModelCatalog {
    pub catalog_version: u32,
    pub models: Vec<ModelCatalogEntry>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct ModelCatalogEntry {
    // Local store key: download_model writes files under it and list_local_models reports it back, so
    // it must be stable + filesystem-safe.
    pub id: String,
    pub name: String,
    pub description: String,
    pub modalities: Vec<Modality>,
    pub runtime: ModelRuntime,
    pub files: Vec<ModelFile>,
    pub license: String,
    pub license_url: String,
    // Total download size across `files` — must equal the sum of `files[].bytes`.
    pub size_bytes: u64,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct ModelFile {
    pub url: String,
    // Lower-case 64-char hex SHA-256 of the file; the downloader verifies it.
    pub sha256: String,
    pub bytes: u64,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub enum Modality {
    Text,
    Image,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub enum ModelRuntime {
    LlamaCpp,
}

impl ModelCatalog {
    // Structural validation, run by the registry before accepting a catalog from the owner so a bad
    // catalog can't break every client. Purely about internal consistency + safe references — it does
    // NOT fetch the URLs.
    pub fn validate(&self) -> Result<(), String> {
        const MAX_MODELS: usize = 50;
        const MAX_FILES_PER_MODEL: usize = 4;
        const MAX_URL_LEN: usize = 2048;
        const MAX_NAME_LEN: usize = 200;

        if self.models.len() > MAX_MODELS {
            return Err(format!("too many models: {} (max {MAX_MODELS})", self.models.len()));
        }

        let mut ids = HashSet::new();
        for m in &self.models {
            if m.id.is_empty()
                || !m
                    .id
                    .chars()
                    .all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.'))
            {
                return Err(format!("invalid model id (must be filesystem-safe): {:?}", m.id));
            }
            if !ids.insert(m.id.as_str()) {
                return Err(format!("duplicate model id: {}", m.id));
            }
            if m.name.len() > MAX_NAME_LEN {
                return Err(format!("model {} name too long", m.id));
            }
            if m.files.is_empty() || m.files.len() > MAX_FILES_PER_MODEL {
                return Err(format!("model {} must have 1..={MAX_FILES_PER_MODEL} files", m.id));
            }

            let mut sum: u64 = 0;
            for f in &m.files {
                if !f.url.starts_with("https://") || f.url.len() > MAX_URL_LEN {
                    return Err(format!("model {} file url must be https and <= {MAX_URL_LEN} chars", m.id));
                }
                if f.sha256.len() != 64 || !f.sha256.bytes().all(|b| b.is_ascii_hexdigit()) {
                    return Err(format!("model {} file sha256 must be 64 hex chars", m.id));
                }
                if f.bytes == 0 {
                    return Err(format!("model {} file bytes must be > 0", m.id));
                }
                sum = sum.saturating_add(f.bytes);
            }
            if m.size_bytes != sum {
                return Err(format!(
                    "model {} size_bytes ({}) != sum of file bytes ({})",
                    m.id, m.size_bytes, sum
                ));
            }
        }
        Ok(())
    }
}
