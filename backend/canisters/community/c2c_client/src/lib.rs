use canister_client::generate_c2c_call;
use community_canister::*;

// Queries

// Updates
generate_c2c_call!(c2c_delete_community);
generate_c2c_call!(c2c_freeze_community);
generate_c2c_call!(c2c_invite_users);
generate_c2c_call!(c2c_join_community);
generate_c2c_call!(c2c_leave_community);
generate_c2c_call!(c2c_unfreeze_community);
