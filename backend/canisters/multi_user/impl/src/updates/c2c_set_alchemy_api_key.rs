use crate::guards::caller_is_local_user_index;
use crate::{RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use multi_user_canister::c2c_set_alchemy_api_key::*;

// Called by the LocalUserIndex whenever a platform operator sets the key on the UserIndex
#[update(guard = "caller_is_local_user_index", msgpack = true)]
#[trace]
fn c2c_set_alchemy_api_key(args: Args) -> Response {
    execute_update(|state| c2c_set_alchemy_api_key_impl(args, state))
}

fn c2c_set_alchemy_api_key_impl(args: Args, state: &mut RuntimeState) -> Response {
    state.data.alchemy_api_key = args.api_key;
    Response::Success
}
