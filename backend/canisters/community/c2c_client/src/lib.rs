use canister_client::{generate_c2c_call, generate_candid_c2c_call};
use community_canister::*;

// Queries
generate_c2c_call!(c2c_events);
generate_c2c_call!(c2c_events_by_index);
generate_c2c_call!(c2c_events_window);
generate_c2c_call!(c2c_summary);
generate_c2c_call!(c2c_summary_updates);

// Updates
generate_c2c_call!(c2c_create_proposals_channel);
generate_c2c_call!(c2c_delete_community);
generate_c2c_call!(c2c_freeze_community);
generate_c2c_call!(c2c_import_proposals_group);
generate_c2c_call!(c2c_invite_users);
generate_c2c_call!(c2c_invite_users_to_channel);
generate_c2c_call!(c2c_join_channel);
generate_c2c_call!(c2c_join_community);
generate_c2c_call!(c2c_leave_community);
generate_c2c_call!(c2c_send_message);
generate_c2c_call!(c2c_set_user_suspended);
generate_c2c_call!(c2c_tip_message);
generate_c2c_call!(c2c_unfreeze_community);
generate_c2c_call!(c2c_update_proposals);
generate_c2c_call!(change_channel_role);
generate_c2c_call!(delete_channel);
generate_c2c_call!(delete_messages);
generate_candid_c2c_call!(send_message);
