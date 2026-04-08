use crate::update_manager;
use std::collections::HashMap;
use std::path::Path;
use std::sync::{Arc, OnceLock};
use tauri::http::{Request, Response};
use tauri::{Runtime, UriSchemeContext};

const ORIGIN: &str = "http://tauri.localhost";

pub struct CachedAsset {
    data: Vec<u8>,
    mime_type: String,
}

pub type BundleMemoryCache = Arc<OnceLock<HashMap<String, CachedAsset>>>;

// Resolve release bundle
//
// In case of a release build, production files will be bundled with the app,
// and we can use this function to resolve those files as they're requested.
//
// NOTE: This function also supports the update mechanism for the app, which is
// crucial to keep the app updating as frictionless as possible.
#[allow(unused)]
pub fn fetch_app_bundle_from_device<R>(
    memory_cache: BundleMemoryCache,
    ctx: UriSchemeContext<'_, R>,
    request: Request<Vec<u8>>,
) -> Response<Vec<u8>>
where
    R: Runtime,
{
    let handle = ctx.app_handle().clone();
    let path = request.uri().path().trim_start_matches("/");
    let path = if path.is_empty() || path == "/" {
        "index.html"
    } else {
        path
    };

    // Lazily load cached assets into memory on first request
    let cache = memory_cache.get_or_init(|| {
        let um = update_manager::UpdateManager::new(handle.clone());
        um.get_cache_dir()
            .map(|dir| load_cache_into_memory(&dir))
            .unwrap_or_default()
    });

    // Serve from in-memory cache
    if let Some(asset) = cache.get(path) {
        return build_response(asset.data.clone(), &asset.mime_type);
    }

    // SPA fallback: if no extension, serve cached index.html
    if Path::new(path).extension().is_none()
        && let Some(asset) = cache.get("index.html")
    {
        return build_response(asset.data.clone(), &asset.mime_type);
    }

    // Fallback to Tauri's default assets resolver
    if let Some(asset) = handle.asset_resolver().get(path.to_string()) {
        return build_response(asset.bytes, &asset.mime_type);
    }

    // Final SPA fallback for default assets resolver with assumed file to resolve!
    if Path::new(path).extension().is_none()
        && let Some(asset) = handle.asset_resolver().get("index.html".to_string())
    {
        return build_response(asset.bytes, &asset.mime_type);
    }

    Response::builder().status(404).body(Vec::new()).unwrap()
}

// Builds a response for our tauri protocol request!
fn build_response(data: Vec<u8>, mime_type: &str) -> Response<Vec<u8>> {
    Response::builder()
        .header("Content-Type", mime_type)
        .header("Access-Control-Allow-Origin", ORIGIN)
        .body(data)
        .unwrap_or_else(|_| Response::builder().status(500).body(Vec::new()).unwrap())
}

/// Load all files from the cache directory into memory.
fn load_cache_into_memory(cache_dir: &std::path::Path) -> HashMap<String, CachedAsset> {
    let mut cache = HashMap::new();
    let version_path = cache_dir.join("version.json");
    if !version_path.exists() {
        return cache;
    }
    if let Ok(entries) = std::fs::read_dir(cache_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file()
                && let Ok(data) = std::fs::read(&path)
            {
                let name = path
                    .file_name()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .to_string();
                let mime_type = mime_guess::from_path(&name)
                    .first_or_octet_stream()
                    .as_ref()
                    .to_string();
                cache.insert(name, CachedAsset { data, mime_type });
            }
        }
    }
    if !cache.is_empty() {
        println!("Loaded {} cached assets into memory", cache.len());
    }
    cache
}
