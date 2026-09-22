use crate::guards::caller_is_owner;
use crate::{RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use types::OCResult;
use user_canister::update_bot::*;

#[update(guard = "caller_is_owner", msgpack = true)]
#[trace]
fn update_bot(args: Args) -> Response {
    execute_update(|state| update_bot_impl(args, state)).into()
}

fn update_bot_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    let my_user_id = state.env.canister_id().into();
    let now = state.env.now();
    let notification = user_core::updates::update_bot(&mut state.data.user, args, my_user_id, now)?;
    state.push_bot_notification(Some(notification));
    Ok(())
}
