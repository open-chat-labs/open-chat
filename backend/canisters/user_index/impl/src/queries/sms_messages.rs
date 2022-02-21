use crate::guards::caller_is_sms_sender;
use crate::{read_state, RuntimeState};
use ic_cdk_macros::query;
use user_index_canister::sms_messages::{Response::*, *};

const MAX_SMS_MESSAGES_PER_BATCH: u32 = 100;

#[query(guard = "caller_is_sms_sender")]
fn sms_messages(args: Args) -> Response {
    read_state(|state| sms_messages_impl(args, state))
}

fn sms_messages_impl(args: Args, runtime_state: &RuntimeState) -> Response {
    let messages = runtime_state
        .data
        .sms_messages
        .get(args.from_index, MAX_SMS_MESSAGES_PER_BATCH);

    Success(SuccessResult { messages })
}
