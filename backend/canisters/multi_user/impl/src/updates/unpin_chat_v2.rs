use crate::guards::caller_is_hosted_user;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use types::OCResult;
use user_canister::unpin_chat_v2::*;

#[update(guard = "caller_is_hosted_user", msgpack = true)]
#[trace]
fn unpin_chat_v2(args: Args) -> Response {
    mutate_state(|state| unpin_chat_impl(args, state)).into()
}

fn unpin_chat_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    let now = state.env.now();
    state.with_caller_user_mut(|_, user| user_core::updates::unpin_chat_v2(user, args, now))
}
