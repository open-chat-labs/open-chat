use candid_gen::generate_candid_method;

fn main() {
    generate_candid_method!(identity, check_auth_principal, query);
    generate_candid_method!(identity, get_delegation, query);

    generate_candid_method!(identity, create_identity, update);
    generate_candid_method!(identity, generate_challenge, update);
    generate_candid_method!(identity, prepare_delegation, update);

    candid::export_service!();
    std::print!("{}", __export_service());
}
