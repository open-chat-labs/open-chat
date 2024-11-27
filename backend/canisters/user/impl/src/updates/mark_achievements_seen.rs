use crate::guards::caller_is_owner;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use user_canister::mark_achievements_seen::{Response::*, *};

#[update(guard = "caller_is_owner", msgpack = true)]
#[trace]
fn mark_achievements_seen(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| mark_achievements_seen_impl(args, state))
}

fn mark_achievements_seen_impl(args: Args, state: &mut RuntimeState) -> Response {
    state.data.achievements_last_seen = args.last_seen;
    Success
}
