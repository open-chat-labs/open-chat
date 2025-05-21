use candid_gen::generate_candid_method;

fn main() {
    generate_candid_method!(sns_ledger, get_transactions, query);

    candid::export_service!();
    std::print!("{}", __export_service());
}
