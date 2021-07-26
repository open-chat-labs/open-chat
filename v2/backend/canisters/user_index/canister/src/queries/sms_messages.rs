use super::sms_messages::Response::*;
use crate::canister::RUNTIME_STATE;
use crate::model::confirmation_code_sms::ConfirmationCodeSms;
use crate::model::runtime_state::RuntimeState;
use candid::CandidType;
use ic_cdk_macros::query;
use serde::Deserialize;
use shared::types::indexed_event::IndexedEvent;

const MAX_SMS_MESSAGES_PER_BATCH: u32 = 100;

#[derive(Deserialize)]
struct Args {
    from_index: u64,
}

#[derive(CandidType)]
enum Response {
    Success(SuccessResult),
    NotAuthorized,
}

#[derive(CandidType)]
struct SuccessResult {
    messages: Vec<IndexedEvent<ConfirmationCodeSms>>,
}

#[query]
fn sms_messages(args: Args) -> Response {
    RUNTIME_STATE.with(|state| sms_messages_impl(args, state.borrow().as_ref().unwrap()))
}

fn sms_messages_impl(args: Args, runtime_state: &RuntimeState) -> Response {
    if runtime_state.is_caller_sms_service() {
        let messages = runtime_state
            .data
            .sms_messages
            .get(args.from_index, MAX_SMS_MESSAGES_PER_BATCH);

        Success(SuccessResult { messages })
    } else {
        NotAuthorized
    }
}
