use candid_gen::generate_candid_method;

fn main() {
    generate_candid_method!(sns_wasm, list_deployed_snses, query);

    candid::export_service!();
    std::print!("{}", __export_service());
}
