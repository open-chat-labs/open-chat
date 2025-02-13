use canister_client::{generate_candid_query_call, generate_candid_update_call};
use group_canister::*;

// Queries
generate_candid_query_call!(events);
generate_candid_query_call!(events_by_index);
generate_candid_query_call!(selected_initial);
generate_candid_query_call!(selected_updates_v2);

// Updates
generate_candid_update_call!(add_reaction);
generate_candid_update_call!(block_user);
generate_candid_update_call!(change_role);
generate_candid_update_call!(delete_messages);
generate_candid_update_call!(pin_message_v2);
generate_candid_update_call!(register_poll_vote);
generate_candid_update_call!(remove_participant);
generate_candid_update_call!(remove_reaction);
generate_candid_update_call!(send_message_v2);
generate_candid_update_call!(unpin_message);
generate_candid_update_call!(update_group_v2);
