const COMMANDS: &[&str] = &[
    "registerListener",
    "removeListener",
    "open_url",
    "sign_up",
    "sign_in",
    "get_fcm_token",
    "show_notification",
    "svelte_ready",
];

fn main() {
    tauri_plugin::Builder::new(COMMANDS)
        .android_path("android")
        .ios_path("ios")
        .build();
}
