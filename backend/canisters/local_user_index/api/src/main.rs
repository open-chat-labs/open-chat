use candid_gen::generate_candid_method;

fn main() {
    generate_candid_method!(local_user_index, invite_users_to_group, update);
    generate_candid_method!(local_user_index, join_group, update);

    candid::export_service!();
    std::print!("{}", __export_service());
}
