use canister_client::{generate_candid_c2c_call, generate_candid_c2c_call_no_args};
use icrc_ledger_canister::*;

// Queries
generate_candid_c2c_call!(icrc1_balance_of);
generate_candid_c2c_call_no_args!(icrc1_decimals);
generate_candid_c2c_call_no_args!(icrc1_fee);
generate_candid_c2c_call_no_args!(icrc1_metadata);
generate_candid_c2c_call_no_args!(icrc1_name);
generate_candid_c2c_call_no_args!(icrc1_symbol);

// Updates
generate_candid_c2c_call!(icrc1_transfer);
generate_candid_c2c_call!(icrc2_approve);
generate_candid_c2c_call!(icrc2_transfer_from);
