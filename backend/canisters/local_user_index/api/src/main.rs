use candid_gen::generate_candid_method;

fn main() {
    generate_candid_method!(local_user_index, invite_users_to_channel, update);
    generate_candid_method!(local_user_index, invite_users_to_community, update);
    generate_candid_method!(local_user_index, invite_users_to_group, update);
    generate_candid_method!(local_user_index, join_group, update);
    generate_candid_method!(local_user_index, join_community, update);
    generate_candid_method!(local_user_index, register_user, update);
    generate_candid_method!(local_user_index, report_message, update);

    candid::export_service!();
    std::print!("{}", __export_service());
}
