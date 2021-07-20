use crate::canister::RUNTIME_STATE;
use crate::model::runtime_state::RuntimeState;
use candid::CandidType;
use ic_cdk_macros::update;
use serde::Deserialize;
use shared::types::push_notifications::{GroupMessageNotification, Notification};

#[derive(Deserialize)]
struct Args {
    notification: GroupMessageNotification,
}

#[derive(CandidType)]
enum Response {
    Success,
}

#[update]
fn push_group_message_notification(args: Args) -> Response {
    RUNTIME_STATE.with(|state| push_group_message_notification_impl(args, state.borrow_mut().as_mut().unwrap()))
}

fn push_group_message_notification_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    runtime_state
        .data
        .notifications
        .add(Notification::GroupMessageNotification(args.notification));

    Response::Success
}
