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
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
