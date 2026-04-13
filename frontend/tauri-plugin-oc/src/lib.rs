use tauri::plugin::{Builder, TauriPlugin};
use tauri::{Manager, Runtime};

// This is used in non-debug envs! But we ignore the unused to allow the IDE to
// highlight any potential issues with the module.
#[allow(unused)]
use bundle_manager::fetch_app_bundle_from_device;

pub use models::*;

mod bundle_manager;
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

/// Initializes the plugin.
pub fn init<R: Runtime>() -> TauriPlugin<R> {
    #[allow(unused_mut)]
    let mut builder = Builder::new("oc").invoke_handler(tauri::generate_handler![
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
    ]);

    // Only register the custom protocol handler when not in debug mode
    #[cfg(not(debug_assertions))]
    {
        let memory_cache = std::sync::Arc::new(std::sync::OnceLock::new());
        builder = builder.register_uri_scheme_protocol("tauri", move |ctx, request| {
            // If not debug mode, we resolve the local bundle!
            return fetch_app_bundle_from_device(memory_cache.clone(), ctx, request);
        });
    }

    builder
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

// TODO kept just in case more issues with serving dev files pops up!
// // Fetch from dev server
// //
// // In dev/debug mode, the app will load static files from the Vite dev server,
// // and we need to request the downloads as such.
// fn fetch_files_from_dev_server(
//     request: Request<Vec<u8>>,
//     dev_server_url: &str,
// ) -> Response<Vec<u8>> {
//     let uri = request.uri();

//     // pq.as_str() preserves the "?import" or "?v=123" strings
//     let full_path = uri
//         .path_and_query()
//         .map(|pq| pq.as_str())
//         .unwrap_or(uri.path())
//         .trim_start_matches("/");

//     let request_url = format!("{}/{}", dev_server_url, full_path);

//     if let Ok(response) = reqwest::blocking::get(&request_url) {
//         if response.status().is_success() {
//             let mime = response
//                 .headers()
//                 .get("content-type")
//                 .and_then(|v| v.to_str().ok())
//                 .unwrap_or("application/octet-stream")
//                 .to_string();

//             let bytes = response.bytes().unwrap_or_default().to_vec();
//             return build_response(bytes, &mime);
//         } else {
//             eprintln!("# Error: could not load file ::: {:#?}", request_url);
//         }
//     } else {
//         eprintln!("# Error: could not load file ::: {:#?}", request_url);
//     };

//     Response::builder().status(404).body(Vec::new()).unwrap()
// }
