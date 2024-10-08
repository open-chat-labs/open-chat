use candid_gen::generate_candid_method;
use std::env;
use ts_export::generate_ts_method;

fn main() {
    generate_candid_method!(online_users, last_online, query);

    candid::export_service!();
    std::print!("{}", __export_service());

    let directory = env::current_dir().unwrap().join("tsBindings/onlineUsers");
    if directory.exists() {
        std::fs::remove_dir_all(&directory).unwrap();
    }

    generate_ts_method!(online_users, last_online);
    generate_ts_method!(online_users, mark_as_online);
}
