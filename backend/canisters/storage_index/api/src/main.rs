use candid_gen::generate_candid_method;
use std::env;
use ts_export::generate_ts_method;

#[allow(deprecated)]
fn main() {
    generate_candid_method!(storage_index, allocated_bucket_v2, query);
    generate_candid_method!(storage_index, can_forward, query);
    generate_candid_method!(storage_index, user, query);

    let directory = env::current_dir().unwrap().join("tsBindings/storageIndex");
    if directory.exists() {
        std::fs::remove_dir_all(&directory).unwrap();
    }

    generate_ts_method!(storage_index, allocated_bucket_v2);
    generate_ts_method!(storage_index, can_forward);
    generate_ts_method!(storage_index, user);

    candid::export_service!();
    std::print!("{}", __export_service());
}
