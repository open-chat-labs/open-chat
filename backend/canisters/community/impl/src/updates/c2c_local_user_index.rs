use crate::execute_update_even_if_frozen;
use crate::guards::caller_is_local_user_index;
use crate::updates::c2c_local_index::c2c_local_index_impl;
use canister_api_macros::update;
use canister_tracing_macros::trace;
use community_canister::c2c_local_user_index::*;

#[update(guard = "caller_is_local_user_index", msgpack = true)]
#[trace]
fn c2c_local_user_index(args: Args) -> Response {
    execute_update_even_if_frozen(|state| c2c_local_index_impl(args, state))
}
