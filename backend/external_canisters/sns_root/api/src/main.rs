use candid_gen::generate_candid_method;

#[allow(deprecated)]
fn main() {
    generate_candid_method!(sns_root, get_sns_canisters_summary, update);

    candid::export_service!();
    std::print!("{}", __export_service());
}
