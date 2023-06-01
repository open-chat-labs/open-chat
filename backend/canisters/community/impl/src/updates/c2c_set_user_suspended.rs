use crate::guards::caller_is_user_index;
use crate::{mutate_state, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use community_canister::c2c_set_user_suspended::{Response::*, *};
use types::Timestamped;

#[update_msgpack(guard = "caller_is_user_index")]
#[trace]
fn c2c_set_user_suspended(args: Args) -> Response {
    mutate_state(|state| c2c_set_user_suspended_impl(args, state))
}

fn c2c_set_user_suspended_impl(args: Args, state: &mut RuntimeState) -> Response {
    if let Some(user) = state.data.members.get_mut_by_user_id(&args.user_id) {
        if user.suspended.value != args.suspended {
            let now = state.env.now();
            user.suspended = Timestamped::new(args.suspended, now);
        }
        Success
    } else {
        UserNotInCommunity
    }
}
