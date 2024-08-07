use canister_client::{generate_query_call, generate_update_call};
use user_index_canister::*;

// Queries
generate_query_call!(check_username);
generate_query_call!(current_user);
generate_query_call!(search);
generate_query_call!(platform_moderators);
generate_query_call!(platform_operators);
generate_query_call!(user);

// Updates
generate_update_call!(add_local_user_index_canister);
generate_update_call!(add_platform_moderator);
generate_update_call!(add_platform_operator);
generate_update_call!(remove_sms_messages);
generate_update_call!(remove_platform_moderator);
generate_update_call!(remove_platform_operator);
generate_update_call!(set_username);
generate_update_call!(upgrade_local_user_index_canister_wasm);
generate_update_call!(upgrade_user_canister_wasm);
