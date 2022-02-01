use candid_gen::generate_candid_method;

fn main() {
    generate_candid_method!(user_index, current_user, query);
    generate_candid_method!(user_index, search, query);
    generate_candid_method!(user_index, super_admins, query);
    generate_candid_method!(user_index, user, query);
    generate_candid_method!(user_index, users, query);

    generate_candid_method!(user_index, add_super_admin, update);
    generate_candid_method!(user_index, confirm_phone_number, update);
    generate_candid_method!(user_index, create_canister, update);
    generate_candid_method!(user_index, generate_registration_fee, update);
    generate_candid_method!(user_index, notify_registration_fee_paid, update);
    generate_candid_method!(user_index, notify_storage_upgrade_fee_paid, update);
    generate_candid_method!(user_index, register_user, update);
    generate_candid_method!(user_index, remove_super_admin, update);
    generate_candid_method!(user_index, resend_code, update);
    generate_candid_method!(user_index, set_username, update);
    generate_candid_method!(user_index, submit_phone_number, update);
    generate_candid_method!(user_index, upgrade_canister, update);

    candid::export_service!();
    std::print!("{}", __export_service());
}
