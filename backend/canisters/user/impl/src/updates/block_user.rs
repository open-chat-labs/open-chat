use crate::guards::caller_is_owner;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use user_canister::block_user::{Response::*, *};

#[update(guard = "caller_is_owner")]
#[trace]
fn block_user(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| block_user_impl(args, state))
}

fn block_user_impl(args: Args, state: &mut RuntimeState) -> Response {
    if state.data.suspended.value {
        return UserSuspended;
    }

    let now = state.env.now();
    state.data.block_user(args.user_id, now);
    state.data.unpin_chat(&args.user_id.into(), now);
    Success
}
