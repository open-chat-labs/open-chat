use crate::model::direct_chat::DirectChat;
use crate::model::messages::PushMessageArgs;
use crate::{RuntimeState, RUNTIME_STATE};
use candid::CandidType;
use ic_cdk_macros::update;
use serde::Deserialize;
use shared::types::direct_message::Message;
use shared::types::message_content::MessageContent;
use shared::types::{chat_id::DirectChatId, MessageId, UserId};
use std::collections::hash_map::Entry::{Occupied, Vacant};
use user_canister::updates::send_message::{Response::*, *};

#[update]
fn send_message(args: Args) -> Response {
    RUNTIME_STATE.with(|state| send_message_impl(args, state.borrow_mut().as_mut().unwrap()))
}

fn send_message_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    if runtime_state.is_caller_owner() {
        let push_message_args = PushMessageArgs {
            message_id: args.message_id,
            sent_by_me: true,
            content: args.content.clone(),
            replies_to: args.replies_to.clone(),
            now: runtime_state.env.now(),
        };

        let result = push_message(args.recipient, push_message_args, runtime_state);

        let (canister_id, send_message_c2c_args) = c2c::build_args(args);
        let send_to_recipient_canister_future = c2c::call(canister_id, send_message_c2c_args);
        ic_cdk::block_on(send_to_recipient_canister_future);

        Success(SuccessResult {
            message_index: result.message_index,
            timestamp: result.timestamp,
        })
    } else {
        NotAuthorised
    }
}

fn push_message(their_user_id: UserId, args: PushMessageArgs, runtime_state: &mut RuntimeState) -> Message {
    let now = runtime_state.env.now();
    let chat_id = DirectChatId::from((&runtime_state.env.canister_id().into(), &their_user_id));

    let chat: &mut DirectChat = match runtime_state.data.direct_chats.entry(chat_id) {
        Occupied(e) => e.into_mut(),
        Vacant(e) => e.insert(DirectChat::new(chat_id, their_user_id, now)),
    };

    chat.messages.push_message(args)
}

mod c2c {
    use super::*;
    use ic_cdk::api::call::CallResult;
    use notifications_canister::updates::push_direct_message_notification;
    use shared::c2c::call_with_logging;
    use shared::rand::get_random_item;
    use shared::types::notifications::DirectMessageNotification;
    use shared::types::CanisterId;
    use user_canister::common::message_internal::ReplyContextInternal;

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

    pub async fn call(canister_id: CanisterId, args: Args) {
        let _: CallResult<(Response,)> = call_with_logging(canister_id, "handle_message_received", (args,)).await;
    }

    pub fn build_args(args: super::Args) -> (CanisterId, Args) {
        let c2c_args = Args {
            message_id: args.message_id,
            content: args.content,
            replies_to: args.replies_to,
        };

        (args.recipient.into(), c2c_args)
    }

    #[update]
    fn handle_message_received(args: Args) -> Response {
        RUNTIME_STATE.with(|state| handle_message_received_impl(args, state.borrow_mut().as_mut().unwrap()))
    }

    fn handle_message_received_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
        // TODO validate that this request came from an OpenChat canister
        let sender_user_id = runtime_state.env.caller().into();

        let push_message_args = PushMessageArgs {
            message_id: args.message_id,
            sent_by_me: false,
            content: args.content,
            replies_to: args.replies_to,
            now: runtime_state.env.now(),
        };

        let message = push_message(sender_user_id, push_message_args, runtime_state);

        let random = runtime_state.env.random_u32() as usize;

        if let Some(canister_id) = get_random_item(&runtime_state.data.notification_canister_ids, random) {
            let notification = DirectMessageNotification {
                sender: sender_user_id,
                recipient: runtime_state.env.canister_id().into(),
                message,
            };

            let push_notification_future = push_notification(*canister_id, notification);
            ic_cdk::block_on(push_notification_future);
        }

        Response::Success
    }

    async fn push_notification(canister_id: CanisterId, notification: DirectMessageNotification) {
        let args = push_direct_message_notification::Args { notification };

        let _: CallResult<(push_direct_message_notification::Response,)> =
            call_with_logging(canister_id, "push_direct_message_notification", (args,)).await;
    }
}
