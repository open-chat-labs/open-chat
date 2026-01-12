use candid_gen::generate_candid_method;

fn main() {
    generate_candid_method!(sign_in_with_email, get_principal, query);

    candid::export_service!();
    std::print!("{}", __export_service());
}
