use candid_gen::generate_candid_method;

fn main() {
    generate_candid_method!(ckbtc_minter, get_btc_address, update);
    generate_candid_method!(ckbtc_minter, retrieve_btc_with_approval, update);

    candid::export_service!();
    std::print!("{}", __export_service());
}
