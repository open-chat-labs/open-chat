use super::send_message::Response::*;
use crate::canister::RUNTIME_STATE;
use crate::model::direct_chat::DirectChat;
use crate::model::messages::PushMessageArgs;
use crate::model::reply_context::ReplyContextInternal;
use crate::model::runtime_state::RuntimeState;
use candid::CandidType;
use ic_cdk_macros::update;
use serde::Deserialize;
use shared::time::TimestampMillis;
use shared::types::message_content::MessageContent;
use shared::types::{chat_id::DirectChatId, MessageId, MessageIndex, UserId};
use std::collections::hash_map::Entry::{Occupied, Vacant};

#[derive(Deserialize)]
struct Args {
    message_id: MessageId,
    recipient: UserId,
    content: MessageContent,
    replies_to: Option<ReplyContextInternal>,
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

        let (canister_id, send_message_c2c_args) = args.into();
        let send_to_recipient_canister_future = c2c::call(canister_id, send_message_c2c_args);
        ic_cdk::block_on(send_to_recipient_canister_future);

        Success(result)
    } else {
        NotAuthorised
    }
}

fn push_message(their_user_id: UserId, args: PushMessageArgs, runtime_state: &mut RuntimeState) -> SuccessResult {
    let now = runtime_state.env.now();
    let chat_id = DirectChatId::from((&runtime_state.env.canister_id().into(), &their_user_id));

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

mod c2c {
    use super::*;
    use crate::model::reply_context::ReplyContextInternal;
    use ic_cdk::api::call::CallResult;
    use shared::c2c::call_with_logging;
    use shared::types::message_notifications::*;
    use shared::types::CanisterId;

    pub async fn call(canister_id: CanisterId, args: Args) {
        let _: CallResult<(Response,)> = call_with_logging(canister_id, "handle_message_received", (args,)).await;
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
            content: args.content.clone(),
            replies_to: args.replies_to,
            now: runtime_state.env.now(),
        };

        let result = push_message(sender_user_id, push_message_args, runtime_state);

        let random = runtime_state.env.random_u32() as usize;

        if let Some(canister_id) = get_notification_canister(runtime_state, random) {
            let notification = DirectMessageNotification {
                sender: sender_user_id,
                recipient: runtime_state.env.canister_id().into(),
                message_index: result.message_index,
                content: args.content,
            };

            let push_notification_future = push_notification(canister_id, notification);
            ic_cdk::block_on(push_notification_future);
        }

        Response::Success
    }

    fn get_notification_canister(runtime_state: &RuntimeState, random: usize) -> Option<CanisterId> {
        if runtime_state.data.notification_canister_ids.is_empty() {
            None
        } else {
            let index = random % runtime_state.data.notification_canister_ids.len();

            runtime_state.data.notification_canister_ids.get(index).cloned()
        }
    }

    async fn push_notification(canister_id: CanisterId, notification: DirectMessageNotification) {
        let _: CallResult<(PushDirectMessageNotificationResponse,)> =
            call_with_logging(canister_id, "push_direct_message_notification", (notification,)).await;
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
