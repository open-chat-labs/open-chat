use candid_gen::generate_candid_method;

fn main() {
    generate_candid_method!(identity, check_auth_principal, query);

    candid::export_service!();
    std::print!("{}", __export_service());
}
