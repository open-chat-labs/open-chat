use crate::guards::caller_is_hosted_user;
use crate::{RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use multi_user_canister::pin_chat_v2::*;
use types::{Achievement, OCResult};

#[update(guard = "caller_is_hosted_user", msgpack = true)]
#[trace]
fn pin_chat_v2(args: Args) -> Response {
    execute_update(|state| pin_chat_impl(args, state)).into()
}

fn pin_chat_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    let now = state.env.now();
    let my_index = state.caller_user_index_or_trap();
    let data = &mut state.data;
    data.users
        .with_user_mut(my_index, |user| user_core::updates::pin_chat_v2(user, args, now))
        .expect("User not found")?;
    state.award_achievement_and_notify(my_index, Achievement::PinnedChat, now);
    Ok(())
}
