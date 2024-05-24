use canister_client::generate_candid_c2c_call;
use sns_ledger_canister::*;

// Queries
generate_candid_c2c_call!(get_transactions);
