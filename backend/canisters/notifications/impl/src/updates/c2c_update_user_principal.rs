use crate::guards::caller_is_user_index;
use crate::{mutate_state, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use notifications_canister::c2c_update_user_principal::{Response::*, *};

#[update_msgpack(guard = "caller_is_user_index")]
#[trace]
fn c2c_update_user_principal(args: Args) -> Response {
    mutate_state(|state| c2c_update_user_principal_impl(args, state))
}

fn c2c_update_user_principal_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    if let Some(user_id) = runtime_state.data.principal_to_user_id.remove(&args.old_principal) {
        runtime_state.data.principal_to_user_id.insert(args.new_principal, user_id);
    }
    Success
}
