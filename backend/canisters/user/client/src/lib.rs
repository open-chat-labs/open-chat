use canister_client_macros::*;
use user_canister::*;

// Queries
generate_query_call!(events_by_index);

// Updates
generate_update_call!(add_reaction);
generate_update_call!(assume_group_super_admin);
generate_update_call!(block_user);
generate_update_call!(delete_messages);
generate_update_call!(edit_message);
generate_update_call!(create_group);
generate_update_call!(leave_group);
generate_update_call!(mark_read_v2);
generate_update_call!(mute_notifications);
generate_update_call!(relinquish_group_super_admin);
generate_update_call!(remove_reaction);
generate_update_call!(send_message);
generate_update_call!(unblock_user);
