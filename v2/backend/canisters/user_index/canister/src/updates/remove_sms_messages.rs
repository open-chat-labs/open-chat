use super::remove_sms_messages::Response::*;
use crate::canister::RUNTIME_STATE;
use crate::model::runtime_state::RuntimeState;
use candid::CandidType;
use ic_cdk_macros::update;
use serde::Deserialize;

#[derive(Deserialize)]
struct Args {
    up_to_index: u64,
}

#[derive(CandidType)]
enum Response {
    Success,
    NotAuthorized,
}

#[update]
fn remove_sms_messages(args: Args) -> Response {
    RUNTIME_STATE.with(|state| remove_sms_messages_impl(args, state.borrow_mut().as_mut().unwrap()))
}

fn remove_sms_messages_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    if runtime_state.is_caller_sms_service() {
        runtime_state.data.sms_messages.remove(args.up_to_index);
        Success
    } else {
        NotAuthorized
    }
}
