use candid_gen::generate_candid_method;

fn main() {
    generate_candid_method!(exchange_client, list_exchanges, query);

    generate_candid_method!(exchange_client, make_orders, update);
    generate_candid_method!(exchange_client, cancel_orders, update);

    candid::export_service!();
    std::print!("{}", __export_service());
}
