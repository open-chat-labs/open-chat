use crate::guards::caller_is_known_bot;
use crate::{mutate_state, read_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use chat_events::{PushMessageArgs, Reader};
use ic_cdk_macros::update;
use types::{
    CanisterId, DirectMessageNotification, MessageContent, MessageId, MessageIndex, Notification, ReplyContext, UserId,
};
use user_canister::c2c_send_messages::{Response::*, *};

#[update_msgpack]
#[trace]
async fn c2c_send_messages(args: Args) -> Response {
    c2c_send_messages_impl(args).await
}

async fn c2c_send_messages_impl(args: Args) -> Response {
    run_regular_jobs();

    let sender_user_id = match read_state(get_sender_status) {
        SenderStatus::Ok(user_id) => user_id,
        SenderStatus::Blocked => return Blocked,
        SenderStatus::UnknownUser(local_user_index_canister_id, user_id) => {
            if !verify_user(local_user_index_canister_id, user_id).await {
                panic!("This request is not from an OpenChat user");
            }
            user_id
        }
    };

    mutate_state(|state| {
        for message in args.messages {
            // Messages sent c2c can be retried so the same messageId may be received multiple
            // times, so here we skip any messages whose messageId already exists.
            if let Some(chat) = state.data.direct_chats.get(&sender_user_id.into()) {
                if chat
                    .events
                    .main_events_reader()
                    .message_internal(message.message_id.into())
                    .is_some()
                {
                    continue;
                }
            }

            handle_message_impl(
                sender_user_id,
                HandleMessageArgs {
                    message_id: Some(message.message_id),
                    sender_message_index: Some(message.sender_message_index),
                    sender_name: args.sender_name.clone(),
                    content: message.content,
                    replies_to: message.replies_to,
                    forwarding: message.forwarding,
                    correlation_id: message.correlation_id,
                    is_bot: false,
                },
                false,
                state,
            );
        }
    });

    Success
}

#[update(guard = "caller_is_known_bot")]
#[trace]
fn c2c_handle_bot_messages(
    args: user_canister::c2c_handle_bot_messages::Args,
) -> user_canister::c2c_handle_bot_messages::Response {
    let (sender_status, now) = read_state(|state| (get_sender_status(state), state.env.now()));

    let sender_user_id = match sender_status {
        SenderStatus::Ok(user_id) => user_id,
        SenderStatus::Blocked => return user_canister::c2c_handle_bot_messages::Response::Blocked,
        SenderStatus::UnknownUser(..) => unreachable!(),
    };

    for message in args.messages.iter() {
        if let Err(error) = message.content.validate_for_new_message(true, false, now) {
            return user_canister::c2c_handle_bot_messages::Response::ContentValidationError(error);
        }
    }

    mutate_state(|state| {
        for message in args.messages {
            handle_message_impl(
                sender_user_id,
                HandleMessageArgs {
                    message_id: None,
                    sender_message_index: None,
                    sender_name: args.bot_name.clone(),
                    content: message.content,
                    replies_to: None,
                    forwarding: false,
                    correlation_id: 0,
                    is_bot: true,
                },
                false,
                state,
            );
        }
    });
    user_canister::c2c_handle_bot_messages::Response::Success
}

pub(crate) struct HandleMessageArgs {
    pub message_id: Option<MessageId>,
    pub sender_message_index: Option<MessageIndex>,
    pub sender_name: String,
    pub content: MessageContent,
    pub replies_to: Option<C2CReplyContext>,
    pub forwarding: bool,
    pub correlation_id: u64,
    pub is_bot: bool,
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
        SenderStatus::UnknownUser(runtime_state.data.local_user_index_canister_id, sender)
    }
}

async fn verify_user(local_user_index_canister_id: CanisterId, user_id: UserId) -> bool {
    let args = local_user_index_canister::c2c_lookup_user::Args {
        user_id_or_principal: user_id.into(),
    };
    if let Ok(response) = local_user_index_canister_c2c_client::c2c_lookup_user(local_user_index_canister_id, &args).await {
        matches!(response, local_user_index_canister::c2c_lookup_user::Response::Success(_))
    } else {
        panic!("Failed to call local_user_index to verify user");
    }
}

pub(crate) fn handle_message_impl(
    sender: UserId,
    args: HandleMessageArgs,
    mute_notification: bool,
    runtime_state: &mut RuntimeState,
) -> Response {
    let now = runtime_state.env.now();
    let replies_to = convert_reply_context(args.replies_to, sender, runtime_state);

    let push_message_args = PushMessageArgs {
        thread_root_message_index: None,
        message_id: args
            .message_id
            .unwrap_or_else(|| MessageId::generate(|| runtime_state.env.random_u32())),
        sender,
        content: args.content.new_content_into_internal(),
        replies_to,
        forwarded: args.forwarding,
        correlation_id: args.correlation_id,
        now,
    };

    let message_event =
        runtime_state
            .data
            .direct_chats
            .push_message(false, sender, args.sender_message_index, push_message_args, args.is_bot);

    if let Some(chat) = runtime_state.data.direct_chats.get_mut(&sender.into()) {
        if args.is_bot {
            chat.mark_read_up_to(message_event.event.message_index, false, now);
        }
        if !mute_notification && !chat.notifications_muted.value {
            let notification = Notification::DirectMessageNotification(DirectMessageNotification {
                sender,
                thread_root_message_index: None,
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
                .and_then(|chat| chat.events.main_events_reader().event_index(message_id.into()))
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
