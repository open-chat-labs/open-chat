use crate::guards::caller_is_hosted_user;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use user_canister::mark_achievements_seen::*;

#[update(guard = "caller_is_hosted_user", msgpack = true)]
#[trace]
fn mark_achievements_seen(args: Args) -> Response {
    mutate_state(|state| mark_achievements_seen_impl(args, state))
}

fn mark_achievements_seen_impl(args: Args, state: &mut RuntimeState) -> Response {
    state.with_caller_user_mut(|_, user| user.achievements_last_seen = args.last_seen);
    Response::Success
}
