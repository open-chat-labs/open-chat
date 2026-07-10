fn main() {
    // option_env!("OC_DEVTOOLS") in lib.rs is captured at compile time; without
    // this, changing the env var wouldn't force a rebuild of the crate.
    println!("cargo:rerun-if-env-changed=OC_DEVTOOLS");
    tauri_build::build()
}
