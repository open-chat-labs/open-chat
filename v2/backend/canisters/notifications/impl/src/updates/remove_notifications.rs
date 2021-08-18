use crate::{RuntimeState, RUNTIME_STATE};
use ic_cdk_macros::update;
use notifications_canister::remove_notifications::{Response::*, *};

#[update]
fn remove_notifications(args: Args) -> Response {
    RUNTIME_STATE.with(|state| remove_notifications_impl(args, state.borrow_mut().as_mut().unwrap()))
}

fn remove_notifications_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    if runtime_state.is_caller_push_service() {
        runtime_state.data.notifications.remove(args.up_to_notification_index);
        Success
    } else {
        NotAuthorized
    }
}
