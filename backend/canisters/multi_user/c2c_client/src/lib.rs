use canister_client::generate_c2c_call;
use multi_user_canister::*;

// Updates
generate_c2c_call!(c2c_create_user);
generate_c2c_call!(c2c_delete_user);
