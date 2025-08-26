use canister_client::generate_candid_update_call;
use market_maker_canister::*;

// Queries

// Update
generate_candid_update_call!(update_config);
