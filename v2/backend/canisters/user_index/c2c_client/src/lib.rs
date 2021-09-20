use canister_client_macros::*;
use ic_cdk::api::call::CallResult;
use log::error;
use types::CanisterId;
use user_index_canister::*;

// Updates
generate_c2c_call!(c2c_set_avatar);
