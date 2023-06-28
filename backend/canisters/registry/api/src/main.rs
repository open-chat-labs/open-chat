use candid_gen::generate_candid_method;

fn main() {
    generate_candid_method!(registry, token_details, query);
    generate_candid_method!(registry, version, query);

    candid::export_service!();
    std::print!("{}", __export_service());
}
