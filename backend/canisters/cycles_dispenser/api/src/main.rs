use candid_gen::generate_candid_method;

#[allow(deprecated)]
fn main() {
    generate_candid_method!(cycles_dispenser, add_canister, update);
    generate_candid_method!(cycles_dispenser, c2c_request_cycles, update);
    generate_candid_method!(cycles_dispenser, update_config, update);

    candid::export_service!();
    std::print!("{}", __export_service());
}
