use canister_client_macros::*;
use group_canister::*;

// Queries
generate_query_call!(events);
generate_query_call!(events_by_index);
generate_query_call!(local_user_index);
generate_query_call!(selected_initial);
generate_query_call!(selected_updates);

// Updates
generate_update_call!(add_participants);
generate_update_call!(add_reaction);
generate_update_call!(block_user);
generate_update_call!(change_role);
generate_update_call!(delete_messages);
generate_update_call!(edit_message);
generate_update_call!(pin_message_v2);
generate_update_call!(register_poll_vote);
generate_update_call!(remove_participant);
generate_update_call!(remove_reaction);
generate_update_call!(send_message_v2);
generate_update_call!(unpin_message);
