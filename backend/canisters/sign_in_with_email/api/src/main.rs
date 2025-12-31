use candid_gen::{generate_candid_method, generate_candid_method_no_args};

fn main() {
    generate_candid_method!(sign_in_with_email, get_delegation, query);
    generate_candid_method!(sign_in_with_email, get_principal, query);
    generate_candid_method_no_args!(sign_in_with_email, email_sender_config, query);
    generate_candid_method_no_args!(sign_in_with_email, rsa_public_key, query);

    generate_candid_method!(sign_in_with_email, generate_magic_link, update);
    generate_candid_method!(sign_in_with_email, handle_magic_link, update);

    candid::export_service!();
    std::print!("{}", __export_service());
}
