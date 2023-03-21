use canister_client::generate_update_call;
use storage_index_canister::*;

// Queries

// Updates
generate_update_call!(upgrade_bucket_canister_wasm);
