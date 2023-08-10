use canister_client::generate_candid_c2c_call;
use sns_swap_canister::*;

// Queries
generate_candid_c2c_call!(get_lifecycle);
