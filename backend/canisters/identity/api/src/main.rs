use candid_gen::generate_candid_method;

fn main() {
    generate_candid_method!(identity, check_auth_principal, query);
    generate_candid_method!(identity, get_delegation, query);

    generate_candid_method!(identity, migrate_legacy_principal, query);
    generate_candid_method!(identity, prepare_delegation, query);

    candid::export_service!();
    std::print!("{}", __export_service());
}
