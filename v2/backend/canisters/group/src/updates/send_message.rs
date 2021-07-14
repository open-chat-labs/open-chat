use super::send_message::Response::*;
use crate::canister::RUNTIME_STATE;
use crate::model::messages::PushMessageArgs;
use crate::model::reply_context::ReplyContextInternal;
use crate::model::runtime_state::RuntimeState;
use candid::CandidType;
use ic_cdk_macros::update;
use serde::Deserialize;
use shared::time::TimestampMillis;
use shared::types::message_content::MessageContent;
use shared::types::message_notifications::*;
use shared::types::{CanisterId, MessageId, MessageIndex};

#[derive(Deserialize)]
struct Args {
    message_id: MessageId,
    content: MessageContent,
    replies_to: Option<ReplyContextInternal>,
}

#[derive(CandidType)]
enum Response {
    Success(SuccessResult),
    NotInGroup,
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
    let caller = runtime_state.env.caller();
    if let Some(participant) = runtime_state.data.participants.get_by_principal(&caller) {
        let now = runtime_state.env.now();

        let push_message_args = PushMessageArgs {
            sender: participant.user_id,
            message_id: args.message_id,
            content: args.content.clone(),
            replies_to: args.replies_to,
            now,
        };

        let message_index = runtime_state.data.messages.push_message(push_message_args);

        if let Some(canister_id) = runtime_state.data.notification_canister_ids.first() {
            let notification = GroupMessageNotification {
                chat_id: runtime_state.env.group_chat_id(),
                sender: participant.user_id,
                recipients: runtime_state.data.participants.get_other_user_ids(participant.user_id),
                message_index,
                content: args.content,
            };

            let push_notification_future = push_notification(*canister_id, notification);
            ic_cdk::block_on(push_notification_future);
        }

        Success(SuccessResult {
            message_index,
            timestamp: now,
        })
    } else {
        NotInGroup
    }
}

async fn push_notification(canister_id: CanisterId, notification: GroupMessageNotification) {
    let _: Result<(PushGroupMessageNotificationResponse,), String> =
        ic_cdk::call(canister_id, "push_group_message_notification", (notification,))
            .await
            .map_err(|e| e.1);
}
