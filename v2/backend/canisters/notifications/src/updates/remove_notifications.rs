use super::remove_notifications::Response::*;
use crate::canister::RUNTIME_STATE;
use crate::model::runtime_state::RuntimeState;
use candid::CandidType;
use ic_cdk_macros::update;
use serde::Deserialize;

#[derive(Deserialize)]
struct Args {
    up_to_notification_index: u64,
}

#[derive(CandidType)]
enum Response {
    Success,
    NotAuthorized,
}

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
