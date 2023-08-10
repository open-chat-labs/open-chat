use crate::guards::caller_is_openchat_user;
use crate::{mutate_state, RuntimeState};
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use user_index_canister::set_moderation_flags::{Response::*, *};

#[update(guard = "caller_is_openchat_user")]
#[trace]
fn set_moderation_flags(args: Args) -> Response {
    mutate_state(|state| set_moderation_flags_impl(args, state))
}

fn set_moderation_flags_impl(args: Args, state: &mut RuntimeState) -> Response {
    let caller = state.env.caller();
    state
        .data
        .users
        .set_moderation_flags_enabled(&caller, args.moderation_flags_enabled);

    Success
}
