use crate::guards::caller_is_hosted_user;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use local_user_index_canister::UserEvent as LocalUserIndexEvent;
use types::{Notification, OCResult, UserId};
use user_canister::update_bot::*;

#[update(guard = "caller_is_hosted_user", msgpack = true)]
#[trace]
fn update_bot(args: Args) -> Response {
    mutate_state(|state| update_bot_impl(args, state)).into()
}

fn update_bot_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    let now = state.env.now();
    let canister_id = state.env.canister_id();
    let (my_index, notification) = state.with_caller_user_mut(|my_index, user| {
        let my_user_id = UserId::new_indexed(canister_id, my_index);
        user_core::updates::update_bot(user, args, my_user_id, now).map(|n| (my_index, n))
    })?;
    // Tells the bot via the LocalUserIndex, as the User canister's `push_bot_notification` does
    if !notification.recipients.is_empty() {
        state.push_local_user_index_canister_event(
            my_index,
            LocalUserIndexEvent::Notification(Box::new(Notification::Bot(notification))),
            now,
        );
    }
    Ok(())
}
