use canister_client_macros::*;
use group_index_canister::*;

// Queries
generate_query_call!(search);

// Updates
generate_update_call!(update_group_canister_wasm);
