#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // only enable instrumentation in development builds
    #[cfg(debug_assertions)]
    let devtools = tauri_plugin_devtools::init();

    let mut builder = tauri::Builder::default();

    #[cfg(debug_assertions)]
    {
        builder = builder.plugin(devtools);
    }

    builder
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_oc::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
