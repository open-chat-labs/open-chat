use crate::{RuntimeState, RUNTIME_STATE};
use ic_cdk_macros::query;
use user_index_canister::sms_messages::{Response::*, *};

const MAX_SMS_MESSAGES_PER_BATCH: u32 = 100;

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
