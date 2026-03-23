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
        .plugin(tauri_plugin_devtools::init()) // this should help debug release builds (?)
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

    // Handles app window setup and navigation interception!
    pub fn setup_app(app: &mut App) -> Result<(), Box<dyn std::error::Error>> {
        let app_handle = app.handle().clone();

        // Init window builder
        // TODO can we recover here if build fails?
        WebviewWindowBuilder::new(app, MAIN_WINDOW_LABEL, WebviewUrl::App("index.html".into()))
            .on_navigation(move |url: &Url| {
                crate::navigation::mobile_on_navigation_handler(&app_handle, url)
            })
            .build()?;

        Ok(())
    }
}
