use candid_gen::generate_candid_method;
use std::env;
use ts_export::generate_ts_method;

#[allow(deprecated)]
fn main() {
    generate_candid_method!(online_users, last_online, query);
    generate_candid_method!(online_users, mark_as_online, update);

    let directory = env::current_dir().unwrap().join("tsBindings/onlineUsers");
    if directory.exists() {
        std::fs::remove_dir_all(&directory).unwrap();
    }

    generate_ts_method!(online_users, last_online);
    generate_ts_method!(online_users, mark_as_online);

    candid::export_service!();
    std::print!("{}", __export_service());
}
