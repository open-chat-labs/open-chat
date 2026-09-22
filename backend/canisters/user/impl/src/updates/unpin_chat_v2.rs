use crate::guards::caller_is_owner;
use crate::{RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use types::OCResult;
use user_canister::unpin_chat_v2::*;

#[update(guard = "caller_is_owner", msgpack = true)]
#[trace]
fn unpin_chat_v2(args: Args) -> Response {
    execute_update(|state| unpin_chat_impl(args, state)).into()
}

fn unpin_chat_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    let now = state.env.now();
    user_core::updates::unpin_chat_v2::unpin_chat_v2(&mut state.data.user, args, now)
}
