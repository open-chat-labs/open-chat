const COMMANDS: &[&str] = &[
    "open_url",
    "sign_up",
    "sign_in",
    "registerListener",
    "removeListener",
    "get_fcm_token",
];

fn main() {
    tauri_plugin::Builder::new(COMMANDS)
        .android_path("android")
        .ios_path("ios")
        .build();
}
