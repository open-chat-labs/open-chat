use crate::canister::RUNTIME_STATE;
use crate::model::runtime_state::RuntimeState;
use crate::updates::mark_read::Response::*;
use candid::CandidType;
use ic_cdk_macros::update;
use serde::Deserialize;
use shared::types::MessageIndex;
use std::cmp::min;

#[derive(Deserialize)]
struct Args {
    up_to_message_index: MessageIndex,
}

#[derive(CandidType)]
enum Response {
    Success,
    SuccessNoChange,
    NotInChat,
}

#[update]
fn mark_read(args: Args) -> Response {
    RUNTIME_STATE.with(|state| mark_read_impl(args, state.borrow_mut().as_mut().unwrap()))
}

fn mark_read_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let caller = &runtime_state.env.caller();
    if let Some(participant) = runtime_state.data.participants.get_by_principal_mut(caller) {
        let max_message_index = runtime_state
            .data
            .messages
            .last()
            .map_or(MessageIndex::default(), |m| m.message_index);

        let up_to_index = min(args.up_to_message_index, max_message_index);
        if up_to_index <= participant.read_up_to {
            SuccessNoChange
        } else {
            participant.read_up_to = up_to_index;
            Success
        }
    } else {
        NotInChat
    }
}
