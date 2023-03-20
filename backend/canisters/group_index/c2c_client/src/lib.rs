use canister_client::generate_c2c_call;
use group_index_canister::*;

// Queries
generate_c2c_call!(c2c_filter_groups);
generate_c2c_call!(c2c_recommended_groups);

// Updates
generate_c2c_call!(c2c_create_group);
generate_c2c_call!(c2c_delete_group);
generate_c2c_call!(c2c_make_private);
generate_c2c_call!(c2c_mark_active);
generate_c2c_call!(c2c_update_group);
