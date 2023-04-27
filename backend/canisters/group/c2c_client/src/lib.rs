use canister_client::{generate_c2c_call, generate_candid_c2c_call};
use group_canister::*;

// Queries
generate_c2c_call!(c2c_events_internal);
generate_c2c_call!(c2c_name_and_members);
generate_c2c_call!(c2c_summary);
generate_c2c_call!(c2c_summary_updates);
generate_c2c_call!(public_summary);

generate_candid_c2c_call!(events);
generate_candid_c2c_call!(http_request);
generate_candid_c2c_call!(invite_code);
generate_candid_c2c_call!(local_user_index);
generate_candid_c2c_call!(selected_initial);

// Updates
generate_c2c_call!(c2c_delete_group);
generate_c2c_call!(c2c_freeze_group);
generate_c2c_call!(c2c_join_group);
generate_c2c_call!(c2c_leave_group);
generate_c2c_call!(c2c_report_message);
generate_c2c_call!(c2c_set_user_suspended);
generate_c2c_call!(c2c_toggle_mute_notifications);
generate_c2c_call!(c2c_unfreeze_group);
generate_c2c_call!(c2c_update_proposals);
generate_c2c_call!(c2c_update_user_principal);
generate_c2c_call!(send_message_v2);
generate_c2c_call!(send_message);

generate_candid_c2c_call!(change_role);
