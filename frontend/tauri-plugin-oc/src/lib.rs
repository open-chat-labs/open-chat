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

/// Extensions to [`tauri::App`], [`tauri::AppHandle`] and [`tauri::Window`] to access the oc APIs.
pub trait OcExt<R: Runtime> {
    fn oc(&self) -> &Oc<R>;
}

impl<R: Runtime, T: Manager<R>> crate::OcExt<R> for T {
    fn oc(&self) -> &Oc<R> {
        self.state::<Oc<R>>().inner()
    }
}

fn build_response(data: Vec<u8>, mime_type: &str) -> tauri::http::Response<Vec<u8>> {
    tauri::http::Response::builder()
        .header("Content-Type", mime_type)
        .header("Access-Control-Allow-Origin", "*")
        .header("Cache-Control", "no-cache")
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
        ])
        .register_uri_scheme_protocol("oc", |ctx, request| {
            let handle = ctx.app_handle().clone();

            let path = request.uri().path();
            let path = if path == "/" {
                "index.html"
            } else {
                path.trim_start_matches('/')
            };

            // Check cache
            let update_manager = update_manager::UpdateManager::new(handle.clone());
            if let Some(cache_dir) = update_manager.get_cache_dir() {
                let cached_file = cache_dir.join(path);
                if cached_file.exists() && cached_file.is_file()
                    && let Ok(data) = std::fs::read(&cached_file) {
                        let mime_type = mime_guess::from_path(path)
                            .first_or_octet_stream()
                            .as_ref()
                            .to_string();
                        return build_response(data, &mime_type);
                    }

                // SPA Fallback (Cache): If not found and no extension, serve cached index.html
                if std::path::Path::new(path).extension().is_none() {
                    let index_path = "index.html";
                    let cached_index = cache_dir.join(index_path);
                    if cached_index.exists() && cached_index.is_file()
                        && let Ok(data) = std::fs::read(&cached_index) {
                            return build_response(data, "text/html");
                        }
                }
            }

            // Fallback to assets
            if let Some(asset) = handle.asset_resolver().get(path.to_string()) {
                return build_response(asset.bytes, &asset.mime_type);
            }

            // SPA Fallback (Assets): If not found and no extension, serve asset index.html
            if std::path::Path::new(path).extension().is_none() {
                let index_path = "index.html";
                if let Some(asset) = handle.asset_resolver().get(index_path.to_string()) {
                    return build_response(asset.bytes, "text/html");
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
