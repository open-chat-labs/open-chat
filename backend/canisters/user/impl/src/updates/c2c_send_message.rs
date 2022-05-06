use crate::updates::send_message_common::register_callbacks_if_required;
use crate::{mutate_state, read_state, run_regular_jobs, RuntimeState};
use canister_api_macros::trace;
use chat_events::PushMessageArgs;
use ic_cdk_macros::update;
use types::{CanisterId, DirectMessageNotification, MessageContent, Notification, ReplyContext, UserId};
use user_canister::c2c_send_message::{Response::*, *};

#[update]
#[trace]
async fn c2c_send_message(args: Args) -> Response {
    run_regular_jobs();

    let sender_user_id = match read_state(get_sender_status) {
        SenderStatus::Ok(user_id) => user_id,
        SenderStatus::Blocked => return Blocked,
        SenderStatus::UnknownUser(user_index_canister_id, user_id) => {
            if !verify_user(user_index_canister_id, user_id).await {
                panic!("This request is not from an OpenChat user");
            }
            user_id
        }
    };

    mutate_state(|state| c2c_send_message_impl(sender_user_id, args, state))
}

enum SenderStatus {
    Ok(UserId),
    Blocked,
    UnknownUser(CanisterId, UserId),
}

fn get_sender_status(runtime_state: &RuntimeState) -> SenderStatus {
    let sender = runtime_state.env.caller().into();

    if runtime_state.data.blocked_users.contains(&sender) {
        SenderStatus::Blocked
    } else if runtime_state.data.direct_chats.get(&sender.into()).is_some() {
        SenderStatus::Ok(sender)
    } else {
        SenderStatus::UnknownUser(runtime_state.data.user_index_canister_id, sender)
    }
}

async fn verify_user(user_index_canister_id: CanisterId, user_id: UserId) -> bool {
    let args = user_index_canister::user::Args {
        user_id: Some(user_id),
        username: None,
    };
    if let Ok(response) = user_index_canister_c2c_client::user(user_index_canister_id, &args).await {
        matches!(response, user_index_canister::user::Response::Success(_))
    } else {
        panic!("Failed to call user_index to verify user");
    }
}

fn c2c_send_message_impl(sender: UserId, args: Args, runtime_state: &mut RuntimeState) -> Response {
    let now = runtime_state.env.now();

    if let MessageContent::CryptocurrencyV2(c) = &args.content {
        runtime_state.data.transactions.add(c.transfer.clone(), now);
    }

    let replies_to = convert_reply_context(args.replies_to_v2, sender, runtime_state);

    let push_message_args = PushMessageArgs {
        message_id: args.message_id,
        sender,
        content: args.content.new_content_into_internal(),
        replies_to,
        now,
    };

    let message_event =
        runtime_state
            .data
            .direct_chats
            .push_message(false, sender, Some(args.sender_message_index), push_message_args);

    register_callbacks_if_required(sender, &message_event, runtime_state);

    if let Some(chat) = runtime_state.data.direct_chats.get(&sender.into()) {
        if !chat.notifications_muted.value {
            let notification = Notification::DirectMessageNotification(DirectMessageNotification {
                sender,
                sender_name: args.sender_name,
                message: message_event,
            });

            let recipient = runtime_state.env.canister_id().into();

            runtime_state.push_notification(vec![recipient], notification);
        }
    }

    Success
}

fn convert_reply_context(
    replies_to: Option<C2CReplyContext>,
    sender: UserId,
    runtime_state: &RuntimeState,
) -> Option<ReplyContext> {
    match replies_to? {
        C2CReplyContext::ThisChat(message_id) => {
            let chat_id = sender.into();
            runtime_state
                .data
                .direct_chats
                .get(&chat_id)
                .and_then(|chat| chat.events.get_event_index_by_message_id(message_id))
                .map(|event_index| ReplyContext {
                    chat_id_if_other: None,
                    event_index,
                })
        }
        C2CReplyContext::OtherChat(chat_id, event_index) => Some(ReplyContext {
            chat_id_if_other: Some(chat_id),
            event_index,
        }),
    }
}
