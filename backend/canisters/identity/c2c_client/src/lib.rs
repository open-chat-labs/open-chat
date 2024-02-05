use canister_client::generate_candid_c2c_call;
use identity_canister::*;

// Queries

// Updates
generate_candid_c2c_call!(c2c_sync_legacy_user_principals);
