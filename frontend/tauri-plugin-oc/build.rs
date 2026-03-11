const COMMANDS: &[&str] = &[
    "registerListener",
    "removeListener",
    "open_url",
    "sign_up",
    "sign_in",
    "get_fcm_token",
    "show_notification",
    "svelte_ready",
    "release_notifications",
    "minimize_app",
    "get_server_version",
    "download_update",
    "restart_app",
    "load_recent_media",
    "enable_viewport_resize",
    "disable_viewport_resize",
];

fn main() {
    tauri_plugin::Builder::new(COMMANDS)
        .android_path("android")
        .ios_path("ios")
        .build();
}
