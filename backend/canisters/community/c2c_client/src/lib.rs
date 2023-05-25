use canister_client::generate_c2c_call;
use community_canister::*;

// Queries

// Updates
generate_c2c_call!(c2c_freeze_community);
generate_c2c_call!(c2c_unfreeze_community);
