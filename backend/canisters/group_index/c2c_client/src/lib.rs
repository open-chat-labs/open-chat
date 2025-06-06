use canister_client::generate_c2c_call;
use group_index_canister::*;

// Queries
generate_c2c_call!(c2c_active_groups);

// Updates
generate_c2c_call!(notify_local_index_added);
generate_c2c_call!(c2c_convert_group_into_community);
generate_c2c_call!(c2c_create_community);
generate_c2c_call!(c2c_create_group);
generate_c2c_call!(c2c_make_community_private);
generate_c2c_call!(c2c_make_private);
generate_c2c_call!(c2c_mark_active);
generate_c2c_call!(c2c_mark_community_active);
generate_c2c_call!(c2c_report_message);
generate_c2c_call!(c2c_start_importing_group_into_community);
generate_c2c_call!(c2c_update_community);
generate_c2c_call!(c2c_update_group);
generate_c2c_call!(c2c_user_index, 300);
