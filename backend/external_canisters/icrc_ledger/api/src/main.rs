use candid_gen::{generate_candid_method, generate_candid_method_no_args};

#[allow(deprecated)]
fn main() {
    generate_candid_method_no_args!(icrc_ledger, icrc1_decimals, query);
    generate_candid_method_no_args!(icrc_ledger, icrc1_fee, query);
    generate_candid_method_no_args!(icrc_ledger, icrc1_metadata, query);
    generate_candid_method_no_args!(icrc_ledger, icrc1_name, query);
    generate_candid_method_no_args!(icrc_ledger, icrc1_supported_standards, query);
    generate_candid_method_no_args!(icrc_ledger, icrc1_symbol, query);
    generate_candid_method_no_args!(icrc_ledger, icrc1_total_supply, query);

    generate_candid_method!(icrc_ledger, icrc1_transfer, update);
    generate_candid_method!(icrc_ledger, icrc2_approve, update);
    generate_candid_method!(icrc_ledger, icrc2_transfer_from, update);

    candid::export_service!();
    std::print!("{}", __export_service());
}
