use canister_client::{generate_query_call, generate_update_call};
use group_index_canister::*;

// Queries
generate_query_call!(explore_groups);
generate_query_call!(recommended_groups);
generate_query_call!(search);

// Updates
generate_update_call!(add_local_group_index_canister);
generate_update_call!(upgrade_community_canister_wasm);
generate_update_call!(upgrade_group_canister_wasm);
generate_update_call!(upgrade_local_group_index_canister_wasm);
