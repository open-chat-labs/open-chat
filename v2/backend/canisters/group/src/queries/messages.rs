use crate::canister::RUNTIME_STATE;
use crate::model::message::Message;
use crate::model::runtime_state::RuntimeState;
use crate::queries::messages::Response::*;
use candid::CandidType;
use ic_cdk_macros::query;
use serde::Deserialize;
use shared::types::MessageIndex;

#[derive(Deserialize)]
struct Args {
    from_index: MessageIndex,
    to_index: MessageIndex,
}

#[derive(CandidType)]
enum Response {
    Success(SuccessResult),
    NotAuthorised,
}

#[derive(CandidType)]
struct SuccessResult {
    messages: Vec<Message>,
}

#[query]
fn messages(args: Args) -> Response {
    RUNTIME_STATE.with(|state| messages_impl(args, state.borrow().as_ref().unwrap()))
}

fn messages_impl(args: Args, runtime_state: &RuntimeState) -> Response {
    if runtime_state.is_caller_participant() {
        let chat_messages = &runtime_state.data.messages;

        let messages = chat_messages
            .get_range(args.from_index, args.to_index)
            .into_iter()
            .map(|m| chat_messages.hydrate_message(m))
            .collect();

        Success(SuccessResult { messages })
    } else {
        NotAuthorised
    }
}
