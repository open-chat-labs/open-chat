use canister_client::{generate_c2c_call, generate_c2c_call_with_payment};
use group_index_canister::*;

// Queries
generate_c2c_call!(c2c_active_groups);

// Updates
generate_c2c_call!(add_local_group_index_canister);
generate_c2c_call!(c2c_convert_group_into_community);
generate_c2c_call!(c2c_create_community);
generate_c2c_call!(c2c_create_group);
generate_c2c_call_with_payment!(c2c_delete_community);
generate_c2c_call_with_payment!(c2c_delete_group);
generate_c2c_call!(c2c_make_community_private);
generate_c2c_call!(c2c_make_private);
generate_c2c_call!(c2c_mark_active);
generate_c2c_call!(c2c_mark_community_active);
generate_c2c_call!(c2c_report_message);
generate_c2c_call!(c2c_start_importing_group_into_community);
generate_c2c_call!(c2c_update_community);
generate_c2c_call!(c2c_update_group);
