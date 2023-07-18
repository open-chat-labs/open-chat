use candid_gen::{generate_candid_method, generate_candid_method_no_args};

#[allow(deprecated)]
fn main() {
    generate_candid_method_no_args!(icrc1_ledger, icrc1_decimals, query);
    generate_candid_method_no_args!(icrc1_ledger, icrc1_fee, query);
    generate_candid_method_no_args!(icrc1_ledger, icrc1_metadata, query);
    generate_candid_method_no_args!(icrc1_ledger, icrc1_name, query);
    generate_candid_method_no_args!(icrc1_ledger, icrc1_symbol, query);

    generate_candid_method!(icrc1_ledger, icrc1_transfer, update);

    candid::export_service!();
    std::print!("{}", __export_service());
}
