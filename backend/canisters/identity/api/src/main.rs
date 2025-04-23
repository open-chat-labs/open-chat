use std::env;
use ts_export::generate_ts_method;

fn main() {
    let directory = env::current_dir().unwrap().join("tsBindings/identity");
    if directory.exists() {
        std::fs::remove_dir_all(&directory).unwrap();
    }

    generate_ts_method!(identity, auth_principals);
    generate_ts_method!(identity, check_auth_principal);
    generate_ts_method!(identity, check_auth_principal_v2);
    generate_ts_method!(identity, get_delegation);
    generate_ts_method!(identity, lookup_webauthn_pubkey);

    generate_ts_method!(identity, approve_identity_link);
    generate_ts_method!(identity, create_identity);
    generate_ts_method!(identity, generate_challenge);
    generate_ts_method!(identity, initiate_identity_link);
    generate_ts_method!(identity, prepare_delegation);
    generate_ts_method!(identity, remove_identity_link);

    candid::export_service!();
    std::print!("{}", __export_service());
}
