use candid_gen::generate_candid_method;
use std::env;
use ts_export::generate_ts_method;

#[allow(deprecated)]
fn main() {
    generate_candid_method!(storage_index, allocated_bucket_v2, query);
    generate_candid_method!(storage_index, can_forward, query);
    generate_candid_method!(storage_index, user, query);

    generate_candid_method!(storage_index, add_bucket_canister, update);
    generate_candid_method!(storage_index, add_or_update_users, update);
    generate_candid_method!(storage_index, remove_accessor, update);
    generate_candid_method!(storage_index, remove_user, update);
    generate_candid_method!(storage_index, set_bucket_full, update);

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
