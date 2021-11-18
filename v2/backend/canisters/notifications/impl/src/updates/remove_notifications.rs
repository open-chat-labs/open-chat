use crate::guards::caller_is_push_service;
use crate::{RuntimeState, RUNTIME_STATE};
use canister_api_macros::trace;
use ic_cdk_macros::update;
use notifications_canister::remove_notifications::{Response::*, *};

#[update(guard = "caller_is_push_service")]
#[trace]
fn remove_notifications(args: Args) -> Response {
    RUNTIME_STATE.with(|state| remove_notifications_impl(args, state.borrow_mut().as_mut().unwrap()))
}

fn remove_notifications_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    runtime_state.data.notifications.remove(args.up_to_notification_index);
    Success
}
