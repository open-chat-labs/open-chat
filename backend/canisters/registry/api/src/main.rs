use candid_gen::generate_candid_method;

#[allow(deprecated)]
fn main() {
    generate_candid_method!(registry, add_message_filter, update);
    generate_candid_method!(registry, remove_message_filter, update);
    generate_candid_method!(registry, set_token_enabled, update);
    generate_candid_method!(registry, updates, query);

    candid::export_service!();
    std::print!("{}", __export_service());
}
