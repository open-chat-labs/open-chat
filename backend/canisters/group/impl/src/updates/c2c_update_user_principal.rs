use crate::guards::caller_is_user_index;
use crate::{RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use group_canister::c2c_update_user_principal::*;
use stable_memory_map::StableMemoryMap;

#[update(guard = "caller_is_user_index", msgpack = true)]
#[trace]
async fn c2c_update_user_principal(args: Args) -> Response {
    execute_update(|state| c2c_update_user_principal_impl(args, state))
}

fn c2c_update_user_principal_impl(args: Args, state: &mut RuntimeState) -> Response {
    if let Some(user_id) = state
        .data
        .principal_to_user_id_map
        .remove(&args.old_principal)
        .map(|v| v.into_value())
    {
        state.data.principal_to_user_id_map.insert(args.new_principal, user_id);
    }
    Response::Success
}
