use crate::guards::caller_is_user_index;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use group_canister::c2c_set_user_frozen::{Response::*, *};
use types::Timestamped;

#[update_msgpack(guard = "caller_is_user_index")]
#[trace]
fn c2c_set_user_frozen(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| c2c_set_user_frozen_impl(args, state))
}

fn c2c_set_user_frozen_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    if let Some(user) = runtime_state.data.participants.get_by_user_id_mut(&args.user_id) {
        if user.frozen.value != args.frozen {
            let now = runtime_state.env.now();
            user.frozen = Timestamped::new(args.frozen, now);
        }
        Success
    } else {
        UserNotInGroup
    }
}
