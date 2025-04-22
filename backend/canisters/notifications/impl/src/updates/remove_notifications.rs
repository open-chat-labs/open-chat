use crate::guards::caller_is_push_service;
use crate::{RuntimeState, mutate_state};
use canister_tracing_macros::trace;
use ic_cdk::update;
use notifications_canister::remove_notifications::{Response::*, *};

#[update(guard = "caller_is_push_service")]
#[trace]
fn remove_notifications(args: Args) -> Response {
    mutate_state(|state| remove_notifications_impl(args, state))
}

fn remove_notifications_impl(args: Args, state: &mut RuntimeState) -> Response {
    state.data.notifications.remove(args.up_to_notification_index);
    Success
}
