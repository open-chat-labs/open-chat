use candid_gen::generate_candid_method;

#[allow(deprecated)]
fn main() {
    generate_candid_method!(exchange_bot, quote, update);
    generate_candid_method!(exchange_bot, swap, update);

    candid::export_service!();
    std::print!("{}", __export_service());
}
