use canister_client::{generate_c2c_call, generate_candid_c2c_call};
use group_canister::*;

// Queries
generate_c2c_call!(c2c_can_issue_access_token);
generate_c2c_call!(c2c_events);
generate_c2c_call!(c2c_events_by_index);
generate_c2c_call!(c2c_events_internal);
generate_c2c_call!(c2c_events_window);
generate_c2c_call!(c2c_name_and_members);
generate_c2c_call!(c2c_summary);
generate_c2c_call!(c2c_summary_updates);
generate_c2c_call!(public_summary);

generate_candid_c2c_call!(events);
generate_candid_c2c_call!(invite_code);
generate_candid_c2c_call!(selected_initial);

// Updates
generate_c2c_call!(c2c_delete_group);
generate_c2c_call!(c2c_export_group);
generate_c2c_call!(c2c_export_group_events);
generate_c2c_call!(c2c_freeze_group);
generate_c2c_call!(c2c_invite_users);
generate_c2c_call!(c2c_join_group);
generate_c2c_call!(c2c_leave_group);
generate_c2c_call!(c2c_migrate_events_to_stable_memory);
generate_c2c_call!(c2c_report_message_v2);
generate_c2c_call!(c2c_send_message);
generate_c2c_call!(c2c_set_user_suspended);
generate_c2c_call!(c2c_start_import_into_community);
generate_c2c_call!(c2c_tip_message);
generate_c2c_call!(c2c_unfreeze_group);
generate_c2c_call!(c2c_update_proposals);
generate_c2c_call!(c2c_update_user_principal);
generate_c2c_call!(delete_messages);

generate_candid_c2c_call!(change_role);
generate_candid_c2c_call!(send_message_v2);
generate_candid_c2c_call!(update_group_v2);
