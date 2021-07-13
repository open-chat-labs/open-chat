use super::send_message::Response::*;
use crate::canister::RUNTIME_STATE;
use crate::model::direct_chat::DirectChat;
use crate::model::message::Message;
use crate::model::runtime_state::RuntimeState;
use candid::CandidType;
use ic_cdk_macros::update;
use serde::Deserialize;
use shared::time::TimestampMillis;
use shared::types::message_content::MessageContent;
use shared::types::reply_context::ReplyContext;
use shared::types::{chat_id::DirectChatId, MessageId, MessageIndex, UserId};
use std::collections::hash_map::Entry::{Occupied, Vacant};

#[derive(Deserialize)]
struct Args {
    message_id: MessageId,
    recipient: UserId,
    content: MessageContent,
    replies_to: Option<ReplyContext>,
}

#[derive(CandidType)]
enum Response {
    Success(SuccessResult),
    NotAuthorised,
}

#[derive(CandidType)]
struct SuccessResult {
    message_index: MessageIndex,
    timestamp: TimestampMillis,
}

#[update]
async fn send_message(args: Args) -> Response {
    let response = RUNTIME_STATE.with(|state| send_message_impl(&args, state.borrow_mut().as_mut().unwrap()));

    // Now call "handle_message_received" on the recipient's canister
    if matches!(response, Response::Success(_)) {
        let (canister_id, send_message_c2c_args) = args.into();
        if let Err(e) = c2c::call(canister_id, send_message_c2c_args).await {
            panic!("{}", e);
        }
    }

    response
}

fn send_message_impl(args: &Args, runtime_state: &mut RuntimeState) -> Response {
    if runtime_state.is_caller_owner() {
        let append_message_args = AppendMessageArgs {
            message_id: args.message_id,
            their_user_id: args.recipient,
            sent_by_me: true,
            content: args.content.clone(),
            replies_to: args.replies_to.clone(),
        };

        let result = append_message(append_message_args, runtime_state);
        Success(result)
    } else {
        NotAuthorised
    }
}

fn append_message(args: AppendMessageArgs, runtime_state: &mut RuntimeState) -> SuccessResult {
    let now = runtime_state.env.now();
    let chat_id = DirectChatId::from((&runtime_state.env.owner_user_id(), &args.their_user_id));

    let chat: &mut DirectChat = match runtime_state.data.direct_chats.entry(chat_id) {
        Occupied(e) => e.into_mut(),
        Vacant(e) => e.insert(DirectChat::new(chat_id, args.their_user_id, now)),
    };

    let message_index = chat.next_message_index();
    let message = Message {
        message_index,
        message_id: args.message_id,
        timestamp: now,
        sent_by_me: args.sent_by_me,
        content: args.content,
        replies_to: args.replies_to,
    };
    chat.messages.push(message);

    SuccessResult {
        message_index,
        timestamp: now,
    }
}

struct AppendMessageArgs {
    their_user_id: UserId,
    sent_by_me: bool,
    message_id: MessageId,
    content: MessageContent,
    replies_to: Option<ReplyContext>,
}

mod c2c {
    use super::*;
    use shared::types::CanisterId;

    pub async fn call(canister_id: CanisterId, args: Args) -> Result<Response, String> {
        let (res,): (Response,) = ic_cdk::call(canister_id, "handle_message_received", (args,))
            .await
            .map_err(|e| e.1)?;

        Ok(res)
    }

    #[derive(CandidType, Deserialize)]
    pub struct Args {
        message_id: MessageId,
        content: MessageContent,
        replies_to: Option<ReplyContext>,
    }

    #[derive(CandidType, Deserialize)]
    pub enum Response {
        Success,
    }

    #[update]
    fn handle_message_received(args: Args) -> Response {
        RUNTIME_STATE.with(|state| handle_message_received_impl(args, state.borrow_mut().as_mut().unwrap()))
    }

    fn handle_message_received_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
        // TODO validate that this request came from an OpenChat canister
        let sender_user_id = runtime_state.env.caller().into();

        let append_message_args = AppendMessageArgs {
            message_id: args.message_id,
            their_user_id: sender_user_id,
            sent_by_me: false,
            content: args.content,
            replies_to: args.replies_to,
        };

        let _ = append_message(append_message_args, runtime_state);

        Response::Success
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
