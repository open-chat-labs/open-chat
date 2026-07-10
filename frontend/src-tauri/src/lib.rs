// #[cfg(mobile)]
use mobile_features::*;

mod navigation;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[allow(unused_mut)]
    let mut builder = tauri::Builder::default();

    // #[cfg(mobile)] {
    builder = builder.setup(|app: &mut App| setup_app(app));
    // }

    // CrabNebula DevTools telemetry — opt-in at build time (OC_DEVTOOLS=1).
    //
    // The collector instruments and buffers every IPC / network / log / span
    // event. A dev full-reload re-fetches thousands of ES modules through the
    // Tauri protocol, flooding the collector far faster than it can flush; its
    // buffer realloc-grows into the gigabytes and the Android WebView process is
    // OOM-killed by scudo. Confirmed with heapprofd: ~89% of the retained native
    // memory during the crash flowed through tauri_plugin_devtools. Never built
    // into release, and off by default in dev so a plain reload no longer
    // crashes.
    //
    // `option_env!` is read at compile time (not runtime): an Android app can't
    // pick up a shell env var at launch, so gate on the build environment and
    // rebuild with OC_DEVTOOLS=1 when you actually need the inspector.
    #[cfg(debug_assertions)]
    if matches!(option_env!("OC_DEVTOOLS"), Some("1" | "true")) {
        builder = builder.plugin(tauri_plugin_devtools::init());
    }

    builder
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_oc::init())
        .plugin(tauri_plugin_android_fs::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

// #[cfg(mobile)]
mod mobile_features {
    pub use tauri::{App, Url, WebviewUrl, WebviewWindowBuilder};

    pub const MAIN_WINDOW_LABEL: &str = "main";
    // TODO perhaps this could be read from env alternativelly, with hard coded fallback?
    pub const DEFAULT_DEV_URL: &str = "http://localhost:5001";

    // Handles app window setup and navigation interception!
    pub fn setup_app(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
        let app_handle = app.handle().clone();

        // Decide URL: dev server on debug, bundled assets on release
        let webview_url = if cfg!(debug_assertions) {
            let dev_url = app
                .config()
                .build
                .dev_url
                .clone()
                .map(|u| u.to_string())
                .unwrap_or_else(|| DEFAULT_DEV_URL.to_string());

            WebviewUrl::External(Url::parse(&dev_url).expect("Invalid devUrl"))
        } else {
            WebviewUrl::App("index.html".into())
        };

        // Create the main window ourselves with navigation handler
        WebviewWindowBuilder::new(app, MAIN_WINDOW_LABEL, webview_url)
            .on_navigation(move |url: &Url| {
                crate::navigation::mobile_on_navigation_handler(&app_handle, url)
            })
            .build()?;

        // ADD ANY OTHER INIT CODE HERE....

        Ok(())
    }
}
