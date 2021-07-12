use super::send_message::Response::*;
use crate::model::direct_chat::DirectChat;
use crate::model::messages::PushMessageArgs;
use crate::model::runtime_state::RuntimeState;
use candid::CandidType;
use serde::Deserialize;
use shared::time::TimestampMillis;
use shared::types::message_content::MessageContent;
use shared::types::{chat_id::DirectChatId, MessageId, MessageIndex, UserId};
use std::collections::hash_map::Entry::{Occupied, Vacant};
use crate::model::reply_context::ReplyContextInternal;

pub fn update(args: &Args, runtime_state: &mut RuntimeState) -> Response {
    if runtime_state.is_caller_owner() {
        let push_message_args = PushMessageArgs {
            message_id: args.message_id,
            sent_by_me: true,
            content: args.content.clone(),
            replies_to: args.replies_to.clone(),
            now: runtime_state.env.now(),
            my_user_id: runtime_state.env.owner_user_id(),
            their_user_id: args.recipient,
        };

        let result = append_message(args.recipient, push_message_args, runtime_state);
        Success(result)
    } else {
        NotAuthorised
    }
}

fn append_message(their_user_id: UserId, args: PushMessageArgs, runtime_state: &mut RuntimeState) -> SuccessResult {
    let now = runtime_state.env.now();
    let chat_id = DirectChatId::from((&runtime_state.env.owner_user_id(), &their_user_id));

    let chat: &mut DirectChat = match runtime_state.data.direct_chats.entry(chat_id) {
        Occupied(e) => e.into_mut(),
        Vacant(e) => e.insert(DirectChat::new(chat_id, their_user_id, now)),
    };

    let message_index = chat.messages.push_message(args);

    SuccessResult {
        message_index,
        timestamp: now,
    }
}

#[derive(Deserialize)]
pub struct Args {
    message_id: MessageId,
    recipient: UserId,
    content: MessageContent,
    replies_to: Option<ReplyContextInternal>,
}

#[derive(CandidType)]
pub enum Response {
    Success(SuccessResult),
    NotAuthorised,
}

#[derive(CandidType)]
pub struct SuccessResult {
    message_index: MessageIndex,
    timestamp: TimestampMillis,
}

pub mod c2c {
    use super::*;
    use shared::types::CanisterId;
    use crate::model::reply_context::ReplyContextInternal;

    pub async fn call(canister_id: CanisterId, args: Args) -> Result<Response, String> {
        let (res,): (Response,) = ic_cdk::call(canister_id, "handle_message_received", (args,))
            .await
            .map_err(|e| e.1)?;

        Ok(res)
    }

    pub fn update(args: Args, runtime_state: &mut RuntimeState) -> Response {
        // TODO validate that this request came from an OpenChat canister
        let sender_user_id = runtime_state.env.caller().into();

        let append_message_args = PushMessageArgs {
            message_id: args.message_id,
            sent_by_me: false,
            content: args.content,
            replies_to: args.replies_to,
            now: runtime_state.env.now(),
            my_user_id: runtime_state.env.owner_user_id(),
            their_user_id: sender_user_id,
        };

        let _ = append_message(sender_user_id, append_message_args, runtime_state);

        Response::Success
    }

    #[derive(CandidType, Deserialize)]
    pub struct Args {
        message_id: MessageId,
        content: MessageContent,
        replies_to: Option<ReplyContextInternal>,
    }

    #[derive(CandidType, Deserialize)]
    pub enum Response {
        Success,
    }

    impl From<super::Args> for (CanisterId, Args) {
        fn from(args: super::Args) -> Self {
            let c2c_args = Args {
                message_id: args.message_id,
                content: args.content,
                replies_to: args.replies_to,
            };

            (args.recipient.into(), c2c_args)
        }
    }
}
