use candid_gen::generate_candid_method;

#[allow(deprecated)]
fn main() {
    generate_candid_method!(icp_ledger, transfer, update);

    candid::export_service!();
    std::print!("{}", __export_service());
}
