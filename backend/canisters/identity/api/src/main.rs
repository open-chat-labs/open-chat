use candid_gen::generate_candid_method;

fn main() {
    generate_candid_method!(identity, check_auth_principal, query);
    generate_candid_method!(identity, get_delegation, query);

    generate_candid_method!(identity, create_identity, update);
    generate_candid_method!(identity, generate_challenge, update);
    generate_candid_method!(identity, migrate_legacy_principal, update);
    generate_candid_method!(identity, prepare_delegation, update);
    generate_candid_method!(identity, set_principal_migration_job_enabled, update);

    candid::export_service!();
    std::print!("{}", __export_service());
}
