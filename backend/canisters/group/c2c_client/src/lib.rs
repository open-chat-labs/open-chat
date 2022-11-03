use canister_client_macros::*;
use group_canister::*;

// Queries
generate_c2c_call!(c2c_search_messages);
generate_c2c_call!(c2c_summary);
generate_c2c_call!(c2c_summary_updates);
generate_c2c_call!(public_summary);

// Updates
generate_c2c_call!(c2c_assume_super_admin);
generate_c2c_call!(c2c_delete_group);
generate_c2c_call!(c2c_dismiss_super_admin);
generate_c2c_call!(c2c_freeze_group);
generate_c2c_call!(c2c_join_group_v2);
generate_c2c_call!(c2c_leave_group);
generate_c2c_call!(c2c_relinquish_super_admin);
generate_c2c_call!(c2c_toggle_mute_notifications);
generate_c2c_call!(c2c_update_proposals);
generate_c2c_call!(c2c_update_user_principal);
generate_c2c_call!(send_message);
