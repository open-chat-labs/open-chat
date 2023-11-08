use candid_gen::generate_candid_method;

#[allow(deprecated)]
fn main() {
    generate_candid_method!(modclub, addProviderAdmin, update);
    generate_candid_method!(modclub, addRules, update);
    generate_candid_method!(modclub, registerProvider, update);
    generate_candid_method!(modclub, submitHtmlContent, update);
    generate_candid_method!(modclub, subscribe, update);

    candid::export_service!();
    std::print!("{}", __export_service());
}
