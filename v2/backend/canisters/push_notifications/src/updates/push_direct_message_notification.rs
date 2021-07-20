use crate::canister::RUNTIME_STATE;
use crate::model::notification::{DirectMessageNotification, Notification};
use crate::model::runtime_state::RuntimeState;
use candid::CandidType;
use ic_cdk_macros::update;
use serde::Deserialize;

#[derive(Deserialize)]
struct Args {
    notification: DirectMessageNotification,
}

#[derive(CandidType)]
enum Response {
    Success,
}

#[update]
fn push_direct_message_notification(args: Args) -> Response {
    RUNTIME_STATE.with(|state| push_direct_message_notification_impl(args, state.borrow_mut().as_mut().unwrap()))
}

fn push_direct_message_notification_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    runtime_state
        .data
        .notifications
        .add(Notification::DirectMessageNotification(args.notification));
    Response::Success
}
