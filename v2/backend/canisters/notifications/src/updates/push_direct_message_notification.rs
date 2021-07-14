use crate::canister::RUNTIME_STATE;
use crate::model::events::Event;
use crate::model::runtime_state::RuntimeState;
use ic_cdk_macros::update;
use shared::types::message_notifications::*;

type Args = DirectMessageNotification;
type Response = PushDirectMessageNotificationResponse;

#[update]
fn push_direct_message_notification(args: Args) -> Response {
    RUNTIME_STATE.with(|state| push_direct_message_notification_impl(args, state.borrow_mut().as_mut().unwrap()))
}

fn push_direct_message_notification_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    runtime_state.data.events.add(Event::DirectMessageNotification(args));
    Response::Success
}
