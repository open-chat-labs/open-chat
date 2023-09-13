use canister_client::generate_candid_c2c_call;
use icpswap_swap_pool_canister::*;

// Queries
generate_candid_c2c_call!(quote);

// Updates
generate_candid_c2c_call!(deposit);
generate_candid_c2c_call!(swap);
generate_candid_c2c_call!(withdraw);
