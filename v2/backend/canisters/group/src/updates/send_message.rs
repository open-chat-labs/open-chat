use super::send_message::Response::*;
use crate::canister::RUNTIME_STATE;
use crate::model::messages::PushMessageArgs;
use crate::model::runtime_state::RuntimeState;
use candid::CandidType;
use ic_cdk_macros::update;
use serde::Deserialize;
use shared::time::TimestampMillis;
use shared::types::message_content::MessageContent;
use shared::types::{MessageId, MessageIndex};
use crate::model::reply_context::ReplyContextInternal;

#[update]
fn send_message(args: Args) -> Response {
    RUNTIME_STATE.with(|state| send_message_impl(args, state.borrow_mut().as_mut().unwrap()))
}

fn send_message_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    if let Some(participant) = runtime_state.get_current_participant() {
        let now = runtime_state.env.now();

        let push_message_args = PushMessageArgs {
            sender: participant.user_id,
            message_id: args.message_id,
            content: args.content,
            replies_to: args.replies_to,
            now,
        };

        let message_index = runtime_state.data.messages.push_message(push_message_args);

        Success(SuccessResult {
            message_index,
            timestamp: now,
        })
    } else {
        NotInGroup
    }
}

#[derive(Deserialize)]
pub struct Args {
    message_id: MessageId,
    content: MessageContent,
    replies_to: Option<ReplyContextInternal>,
}

#[derive(CandidType)]
pub enum Response {
    Success(SuccessResult),
    NotInGroup,
}

#[derive(CandidType)]
pub struct SuccessResult {
    message_index: MessageIndex,
    timestamp: TimestampMillis,
}
