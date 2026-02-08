mod update_manager;

#[tauri::command]
async fn get_server_version(app: tauri::AppHandle) -> Result<String, String> {
    let manager = update_manager::UpdateManager::new(app);
    manager.get_server_version().await.map(|v| v.to_string()).map_err(|e| e.to_string())
}

#[tauri::command]
async fn download_update(app: tauri::AppHandle) -> Result<bool, String> {
    let manager = update_manager::UpdateManager::new(app.clone());
    let did_download = manager.check_for_updates().await.map_err(|e| e.to_string())?;

    if did_download {
        return Ok(true);
    }

    let bundled = manager
        .get_bundled_version()
        .unwrap_or_else(|| semver::Version::parse("0.0.0").unwrap());
    let cached = manager
        .get_cached_version()
        .unwrap_or_else(|| semver::Version::parse("0.0.0").unwrap());

    if cached > bundled {
        return Ok(true);
    }

    Ok(false)
}

#[tauri::command]
fn restart_app(app: tauri::AppHandle) {
    app.restart();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // ENABLE DEVTOOLS FOR DEBUGGING RELEASE BUILD
    let devtools = tauri_plugin_devtools::init();

    #[allow(unused_mut)]
    let mut builder = tauri::Builder::default();

    builder = builder.plugin(devtools);

    builder
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_oc::init())
        .invoke_handler(tauri::generate_handler![get_server_version, download_update, restart_app])
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
                if cached_file.exists() && cached_file.is_file() {
                    if let Ok(data) = std::fs::read(&cached_file) {
                        let mime_type = mime_guess::from_path(path).first_or_octet_stream().as_ref().to_string();
                        return tauri::http::Response::builder()
                            .header("Content-Type", mime_type)
                            .header("Access-Control-Allow-Origin", "*")
                            .header("Cache-Control", "no-cache")
                            .body(data)
                            .unwrap_or_else(|_| {
                                tauri::http::Response::builder()
                                    .status(500)
                                    .body(Vec::new())
                                    .unwrap()
                            });
                    }
                }

                // SPA Fallback (Cache): If not found and no extension, serve cached index.html
                if std::path::Path::new(path).extension().is_none() {
                    let index_path = "index.html";
                    let cached_index = cache_dir.join(index_path);
                    if cached_index.exists() && cached_index.is_file() {
                         if let Ok(data) = std::fs::read(&cached_index) {
                            return tauri::http::Response::builder()
                                .header("Content-Type", "text/html")
                                .header("Access-Control-Allow-Origin", "*")
                                .header("Cache-Control", "no-cache")
                                .body(data)
                                .unwrap_or_else(|_| {
                                    tauri::http::Response::builder()
                                        .status(500)
                                        .body(Vec::new())
                                        .unwrap()
                                });
                        }
                    }
                }
            }

            // Fallback to assets
            if let Some(asset) = handle.asset_resolver().get(path.to_string()) {
                return tauri::http::Response::builder()
                    .header("Content-Type", asset.mime_type)
                    .header("Access-Control-Allow-Origin", "*")
                    .header("Cache-Control", "no-cache")
                    .body(asset.bytes)
                    .unwrap_or_else(|_| {
                        tauri::http::Response::builder()
                            .status(500)
                            .body(Vec::new())
                            .unwrap()
                    });
            }

            // SPA Fallback (Assets): If not found and no extension, serve asset index.html
            if std::path::Path::new(path).extension().is_none() {
                let index_path = "index.html";
                if let Some(asset) = handle.asset_resolver().get(index_path.to_string()) {
                     return tauri::http::Response::builder()
                        .header("Content-Type", "text/html")
                        .header("Access-Control-Allow-Origin", "*")
                        .header("Cache-Control", "no-cache")
                        .body(asset.bytes)
                        .unwrap_or_else(|_| {
                            tauri::http::Response::builder()
                                .status(500)
                                .body(Vec::new())
                                .unwrap()
                        });
                }
            }

            tauri::http::Response::builder()
                .status(404)
                .body(Vec::new())
                .unwrap()
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
