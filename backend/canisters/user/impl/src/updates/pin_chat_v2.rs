use crate::guards::caller_is_owner;
use crate::{RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use types::{Achievement, OCResult};
use user_canister::pin_chat_v2::*;

#[update(guard = "caller_is_owner", msgpack = true)]
#[trace]
fn pin_chat_v2(args: Args) -> Response {
    execute_update(|state| pin_chat_impl(args, state)).into()
}

fn pin_chat_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    let now = state.env.now();
    user_core::updates::pin_chat_v2::pin_chat_v2(&mut state.data.user, args, now)?;
    state.award_achievement_and_notify(Achievement::PinnedChat, now);
    Ok(())
}
