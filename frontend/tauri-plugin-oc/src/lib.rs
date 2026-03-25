use std::collections::HashMap;
use std::sync::{Arc, OnceLock};

use tauri::{
    Manager, Runtime,
    plugin::{Builder, TauriPlugin},
};

pub use models::*;

#[cfg(desktop)]
mod desktop;
#[cfg(mobile)]
mod mobile;

mod commands;
mod error;
mod models;
mod update_manager;

pub use error::{Error, Result};

#[cfg(desktop)]
use desktop::Oc;
#[cfg(mobile)]
use mobile::Oc;

struct CachedAsset {
    data: Vec<u8>,
    mime_type: String,
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
            if path.is_file() {
                if let Ok(data) = std::fs::read(&path) {
                    let name = path.file_name()
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
    }
    if !cache.is_empty() {
        println!("Loaded {} cached assets into memory", cache.len());
    }
    cache
}

/// Extensions to [`tauri::App`], [`tauri::AppHandle`] and [`tauri::Window`] to access the oc APIs.
pub trait OcExt<R: Runtime> {
    fn oc(&self) -> &Oc<R>;
}

impl<R: Runtime, T: Manager<R>> crate::OcExt<R> for T {
    fn oc(&self) -> &Oc<R> {
        self.state::<Oc<R>>().inner()
    }
}

const ORIGIN: &str = "https://tauri.localhost";

fn build_response(data: Vec<u8>, mime_type: &str) -> tauri::http::Response<Vec<u8>> {
    tauri::http::Response::builder()
        .header("Content-Type", mime_type)
        .header("Access-Control-Allow-Origin", ORIGIN)
        .body(data)
        .unwrap_or_else(|_| {
            tauri::http::Response::builder()
                .status(500)
                .body(Vec::new())
                .unwrap()
        })
}

/// Initializes the plugin.
pub fn init<R: Runtime>() -> TauriPlugin<R> {
    let memory_cache: Arc<OnceLock<HashMap<String, CachedAsset>>> = Arc::new(OnceLock::new());

    Builder::new("oc")
        .invoke_handler(tauri::generate_handler![
            commands::open_url,
            commands::sign_up,
            commands::sign_in,
            commands::show_notification,
            commands::svelte_ready,
            commands::release_notifications,
            commands::minimize_app,
            commands::restart_app,
            commands::get_server_version,
            commands::download_update,
            commands::load_recent_media,
            commands::enable_viewport_resize,
            commands::disable_viewport_resize,
        ])
        .register_uri_scheme_protocol("tauri", move |ctx, request| {
            let handle = ctx.app_handle().clone();

            let path = request.uri().path();
            let path = if path == "/" {
                "index.html"
            } else {
                path.trim_start_matches('/')
            };

            // Lazily load cached assets into memory on first request
            let cache = memory_cache.get_or_init(|| {
                let um = update_manager::UpdateManager::new(handle.clone());
                match um.get_cache_dir() {
                    Some(dir) => load_cache_into_memory(&dir),
                    None => HashMap::new(),
                }
            });

            // Serve from in-memory cache
            if let Some(asset) = cache.get(path) {
                return build_response(asset.data.clone(), &asset.mime_type);
            }

            // SPA fallback: if no extension, serve cached index.html
            if std::path::Path::new(path).extension().is_none() {
                if let Some(asset) = cache.get("index.html") {
                    return build_response(asset.data.clone(), &asset.mime_type);
                }
            }

            // Fallback to bundled assets
            if let Some(asset) = handle.asset_resolver().get(path.to_string()) {
                return build_response(asset.bytes, &asset.mime_type);
            }

            // SPA fallback for bundled assets
            if std::path::Path::new(path).extension().is_none() {
                if let Some(asset) = handle.asset_resolver().get("index.html".to_string()) {
                    return build_response(asset.bytes, &asset.mime_type);
                }
            }

            tauri::http::Response::builder()
                .status(404)
                .body(Vec::new())
                .unwrap()
        })
        .setup(|app, api| {
            #[cfg(mobile)]
            let oc = mobile::init(app, api)?;
            #[cfg(desktop)]
            let oc = desktop::init(app, api)?;
            app.manage(oc);
            Ok(())
        })
        .build()
}
