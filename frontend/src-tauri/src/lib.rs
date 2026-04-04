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

    builder
        .plugin(tauri_plugin_devtools::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_oc::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

// #[cfg(mobile)]
mod mobile_features {
    pub use tauri::{App, Url, WebviewUrl, WebviewWindowBuilder};

    pub const MAIN_WINDOW_LABEL: &str = "main";
    // TODO perhaps this could be read from env alternativelly, with hard coded fallback?
    pub const DEFAULT_DEV_URL: &str = "http://localhost:5003";

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
