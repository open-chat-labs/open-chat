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

#[cfg(test)]
mod tests {
    use super::*;

    // A valid file with a caller-chosen size (default sha256 = 64 hex chars, https url).
    fn file(bytes: u64) -> ModelFile {
        ModelFile {
            url: "https://example.com/model.gguf".to_string(),
            sha256: "a".repeat(64),
            bytes,
        }
    }

    // A valid entry whose size_bytes equals the sum of its files' bytes.
    fn entry(id: &str, files: Vec<ModelFile>) -> ModelCatalogEntry {
        let size_bytes = files.iter().map(|f| f.bytes).sum();
        ModelCatalogEntry {
            id: id.to_string(),
            name: "Test Model".to_string(),
            description: "desc".to_string(),
            modalities: vec![Modality::Text, Modality::Image],
            runtime: ModelRuntime::LlamaCpp,
            files,
            license: "MIT".to_string(),
            license_url: "https://example.com/license".to_string(),
            size_bytes,
        }
    }

    fn catalog(models: Vec<ModelCatalogEntry>) -> ModelCatalog {
        ModelCatalog {
            catalog_version: 1,
            models,
        }
    }

    #[test]
    fn empty_catalog_is_valid() {
        // Empty ⇒ the client falls back to its built-in default; must not error.
        assert!(catalog(vec![]).validate().is_ok());
    }

    #[test]
    fn a_well_formed_catalog_is_valid() {
        let c = catalog(vec![
            entry("gemma-3-1b", vec![file(1000)]),
            entry("llava_v1.5.q4", vec![file(500), file(1500)]),
        ]);
        assert!(c.validate().is_ok(), "{:?}", c.validate());
    }

    #[test]
    fn filesystem_safe_id_chars_accepted() {
        assert!(catalog(vec![entry("Model-1_v2.3", vec![file(1)])]).validate().is_ok());
    }

    #[test]
    fn too_many_models_rejected() {
        let models = (0..51).map(|i| entry(&format!("m{i}"), vec![file(1)])).collect();
        assert!(catalog(models).validate().unwrap_err().contains("too many models"));
    }

    #[test]
    fn empty_id_rejected() {
        assert!(catalog(vec![entry("", vec![file(1)])]).validate().is_err());
    }

    #[test]
    fn non_filesystem_safe_id_rejected() {
        for bad in ["a/b", "a b", "a$b", "../x", "a\\b", "a:b"] {
            assert!(
                catalog(vec![entry(bad, vec![file(1)])]).validate().is_err(),
                "id {bad:?} should be rejected"
            );
        }
    }

    #[test]
    fn duplicate_id_rejected() {
        let c = catalog(vec![entry("dup", vec![file(1)]), entry("dup", vec![file(2)])]);
        assert!(c.validate().unwrap_err().contains("duplicate"));
    }

    #[test]
    fn name_too_long_rejected() {
        let mut e = entry("m", vec![file(1)]);
        e.name = "x".repeat(201);
        assert!(catalog(vec![e]).validate().unwrap_err().contains("name too long"));
    }

    #[test]
    fn zero_files_rejected() {
        assert!(catalog(vec![entry("m", vec![])]).validate().is_err());
    }

    #[test]
    fn too_many_files_rejected() {
        let files = (0..5).map(|_| file(1)).collect();
        assert!(catalog(vec![entry("m", files)]).validate().is_err());
    }

    #[test]
    fn non_https_url_rejected() {
        let mut e = entry("m", vec![file(1)]);
        e.files[0].url = "http://example.com/model.gguf".to_string();
        assert!(catalog(vec![e]).validate().unwrap_err().contains("https"));
    }

    #[test]
    fn bad_sha256_length_rejected() {
        let mut e = entry("m", vec![file(1)]);
        e.files[0].sha256 = "abc".to_string(); // too short
        assert!(catalog(vec![e]).validate().unwrap_err().contains("64 hex"));
    }

    #[test]
    fn non_hex_sha256_rejected() {
        let mut e = entry("m", vec![file(1)]);
        e.files[0].sha256 = "g".repeat(64); // 64 chars but not hex
        assert!(catalog(vec![e]).validate().unwrap_err().contains("64 hex"));
    }

    #[test]
    fn zero_bytes_file_rejected() {
        assert!(
            catalog(vec![entry("m", vec![file(0)])])
                .validate()
                .unwrap_err()
                .contains("bytes must be > 0")
        );
    }

    #[test]
    fn size_bytes_mismatch_rejected() {
        let mut e = entry("m", vec![file(1000)]);
        e.size_bytes = 999; // != sum of file bytes (1000)
        assert!(catalog(vec![e]).validate().unwrap_err().contains("size_bytes"));
    }

    #[test]
    fn size_bytes_equal_to_sum_of_multiple_files_is_valid() {
        // helper sets size_bytes = 300 + 700 = 1000
        assert!(catalog(vec![entry("m", vec![file(300), file(700)])]).validate().is_ok());
    }
}
