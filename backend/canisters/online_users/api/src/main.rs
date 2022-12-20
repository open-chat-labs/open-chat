use candid_gen::generate_candid_method;

fn main() {
    generate_candid_method!(online_users, last_online, query);
    generate_candid_method!(online_users, mark_as_online, update);

    candid::export_service!();
    std::print!("{}", __export_service());
}
