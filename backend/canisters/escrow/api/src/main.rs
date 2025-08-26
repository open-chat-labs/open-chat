use candid_gen::generate_candid_method;

fn main() {
    generate_candid_method!(escrow, lookup_swap, query);

    generate_candid_method!(escrow, create_swap, update);
    generate_candid_method!(escrow, cancel_swap, update);
    generate_candid_method!(escrow, notify_deposit, update);

    candid::export_service!();
    std::print!("{}", __export_service());
}
