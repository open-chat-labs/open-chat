use canister_client_macros::*;
use local_user_index_canister::*;

// Queries

// Updates
generate_update_call!(upgrade_user_canister_wasm);
