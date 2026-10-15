use crate::guards::caller_is_hosted_user;
use crate::{RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use multi_user_canister::unpin_chat_v2::*;
use types::OCResult;

#[update(guard = "caller_is_hosted_user", msgpack = true)]
#[trace]
fn unpin_chat_v2(args: Args) -> Response {
    execute_update(|state| unpin_chat_impl(args, state)).into()
}

fn unpin_chat_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    let now = state.env.now();
    let my_index = state.caller_user_index_or_trap();
    let data = &mut state.data;
    data.users
        .with_user_mut(my_index, |user| user_core::updates::unpin_chat_v2(user, args, now))
        .expect("User not found")
}
