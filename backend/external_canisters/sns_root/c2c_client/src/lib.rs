use canister_client::generate_candid_c2c_call;
use sns_root_canister::*;

// Queries
generate_candid_c2c_call!(get_sns_canisters_summary);
