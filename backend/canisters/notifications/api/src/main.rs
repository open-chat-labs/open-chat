use std::env;
use ts_export::generate_ts_method;

#[allow(deprecated)]
fn main() {
    let directory = env::current_dir().unwrap().join("tsBindings/notifications");
    if directory.exists() {
        std::fs::remove_dir_all(&directory).unwrap();
    }

    generate_ts_method!(notifications, notification_types, query);
}
