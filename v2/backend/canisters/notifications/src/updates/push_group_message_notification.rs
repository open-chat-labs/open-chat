use super::push_group_message_notification::Response::*;
use crate::canister::RUNTIME_STATE;
use crate::model::events::{Event, GroupMessageNotification};
use crate::model::runtime_state::RuntimeState;
use candid::CandidType;
use ic_cdk_macros::update;

type Args = GroupMessageNotification;

#[derive(CandidType)]
enum Response {
    Success,
}

#[update]
fn push_group_message_notification(args: Args) -> Response {
    RUNTIME_STATE.with(|state| push_group_message_notification_impl(args, state.borrow_mut().as_mut().unwrap()))
}

fn push_group_message_notification_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    runtime_state.data.events.add(Event::GroupMessageNotification(args));
    Success
}
