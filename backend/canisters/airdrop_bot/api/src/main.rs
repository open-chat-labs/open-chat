use candid_gen::generate_candid_method;

#[allow(deprecated)]
fn main() {
    generate_candid_method!(airdrop_bot, initialize_bot, update);
    generate_candid_method!(airdrop_bot, set_avatar, update);
    generate_candid_method!(airdrop_bot, set_airdrop, update);
    generate_candid_method!(airdrop_bot, cancel_airdrop, update);

    candid::export_service!();
    std::print!("{}", __export_service());
}
