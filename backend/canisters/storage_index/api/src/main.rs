use candid_gen::generate_candid_method;

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
    generate_candid_method!(storage_index, update_user_id, update);

    candid::export_service!();
    std::print!("{}", __export_service());
}
