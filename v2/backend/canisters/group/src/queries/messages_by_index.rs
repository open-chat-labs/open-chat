use crate::model::message::Message;
use crate::model::runtime_state::RuntimeState;
use crate::queries::messages_by_index::Response::*;
use candid::CandidType;
use serde::Deserialize;
use shared::types::MessageIndex;
use crate::canister::RUNTIME_STATE;
use ic_cdk_macros::query;

#[query]
fn messages_by_index(args: Args) -> Response {
    RUNTIME_STATE.with(|state| messages_by_index_impl(args, state.borrow().as_ref().unwrap()))
}

fn messages_by_index_impl(args: Args, runtime_state: &RuntimeState) -> Response {
    if runtime_state.get_current_participant().is_some() {
        let chat_messages = &runtime_state.data.messages;

        let messages = chat_messages
            .get_by_index(args.messages)
            .into_iter()
            .map(|m| chat_messages.hydrate_message(m))
            .collect();

        Success(SuccessResult { messages })
    } else {
        NotAuthorised
    }
}

#[derive(Deserialize)]
pub struct Args {
    messages: Vec<MessageIndex>,
}

#[derive(CandidType)]
pub enum Response {
    Success(SuccessResult),
    NotAuthorised,
}

#[derive(CandidType)]
pub struct SuccessResult {
    messages: Vec<Message>,
}
