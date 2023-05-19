use crate::guards::caller_is_user_index;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use group_canister::c2c_set_user_suspended::{Response::*, *};
use types::Timestamped;

#[update_msgpack(guard = "caller_is_user_index")]
#[trace]
fn c2c_set_user_suspended(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| c2c_set_user_suspended_impl(args, state))
}

fn c2c_set_user_suspended_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    if let Some(user) = runtime_state.data.chat.members.get_mut(&args.user_id) {
        if user.suspended.value != args.suspended {
            let now = runtime_state.env.now();
            user.suspended = Timestamped::new(args.suspended, now);
        }
        Success
    } else {
        UserNotInGroup
    }
}
