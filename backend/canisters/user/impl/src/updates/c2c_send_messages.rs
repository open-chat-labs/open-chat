use crate::updates::send_message::register_timer_jobs;
use crate::{mutate_state, read_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use chat_events::{MessageContentInternal, PushMessageArgs, Reader, ReplyContextInternal};
use ic_cdk_macros::update;
use rand::Rng;
use types::{
    CanisterId, DirectMessageNotification, EventWrapper, Message, MessageId, MessageIndex, Notification, TimestampMillis,
    UserId,
};
use user_canister::c2c_send_messages_v2::{Response::*, *};

#[update_msgpack]
#[trace]
async fn c2c_send_messages_v2(args: Args) -> Response {
    c2c_send_messages_with_sender_check(args).await
}

async fn c2c_send_messages_with_sender_check(args: Args) -> Response {
    run_regular_jobs();

    let sender_user_id = match read_state(get_sender_status) {
        SenderStatus::Ok(user_id) => user_id,
        SenderStatus::Blocked => return Blocked,
        SenderStatus::UnknownUser(local_user_index_canister_id, user_id) => {
            if !verify_user(local_user_index_canister_id, user_id, false).await {
                panic!("This request is not from an OpenChat user");
            }
            user_id
        }
    };

    mutate_state(|state| c2c_send_messages_impl(args, sender_user_id, state))
}
pub(crate) fn c2c_send_messages_impl(args: Args, sender_user_id: UserId, state: &mut RuntimeState) -> Response {
    let now = state.env.now();
    for message in args.messages {
        // Messages sent c2c can be retried so the same messageId may be received multiple
        // times, so here we skip any messages whose messageId already exists.
        if let Some(chat) = state.data.direct_chats.get(&sender_user_id.into()) {
            if chat.events.contains_message_id(None, message.message_id) {
                continue;
            }
        }

        handle_message_impl(
            sender_user_id,
            HandleMessageArgs {
                message_id: Some(message.message_id),
                sender_message_index: Some(message.sender_message_index),
                sender_name: args.sender_name.clone(),
                sender_display_name: args.sender_display_name.clone(),
                content: message.content,
                replies_to: message.replies_to,
                forwarding: message.forwarding,
                correlation_id: message.correlation_id,
                is_bot: false,
                sender_avatar_id: args.sender_avatar_id,
                now,
            },
            message.message_filter_failed.is_some(),
            state,
        );
    }

    Success
}

#[update]
#[trace]
async fn c2c_handle_bot_messages(
    args: user_canister::c2c_handle_bot_messages::Args,
) -> user_canister::c2c_handle_bot_messages::Response {
    let (sender_status, now) = read_state(|state| (get_sender_status(state), state.env.now()));

    let sender_user_id = match sender_status {
        SenderStatus::Ok(user_id) => user_id,
        SenderStatus::Blocked => return user_canister::c2c_handle_bot_messages::Response::Blocked,
        SenderStatus::UnknownUser(local_user_index_canister_id, user_id) => {
            if !verify_user(local_user_index_canister_id, user_id, true).await {
                panic!("This request is not from a bot registered with OpenChat");
            }
            user_id
        }
    };

    for message in args.messages.iter() {
        if let Err(error) = message.content.validate_for_new_message(true, true, false, now) {
            return user_canister::c2c_handle_bot_messages::Response::ContentValidationError(error);
        }
    }

    mutate_state(|state| {
        let now = state.env.now();
        for message in args.messages {
            handle_message_impl(
                sender_user_id,
                HandleMessageArgs {
                    message_id: None,
                    sender_message_index: None,
                    sender_name: args.bot_name.clone(),
                    sender_display_name: args.bot_display_name.clone(),
                    content: MessageContentInternal::from_initial(message.content, now).unwrap(),
                    replies_to: None,
                    forwarding: false,
                    correlation_id: 0,
                    is_bot: true,
                    sender_avatar_id: None,
                    now,
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
    pub sender_display_name: Option<String>,
    pub content: MessageContentInternal,
    pub replies_to: Option<C2CReplyContext>,
    pub forwarding: bool,
    pub correlation_id: u64,
    pub is_bot: bool,
    pub sender_avatar_id: Option<u128>,
    pub now: TimestampMillis,
}

pub(crate) enum SenderStatus {
    Ok(UserId),
    Blocked,
    UnknownUser(CanisterId, UserId),
}

pub(crate) fn get_sender_status(state: &RuntimeState) -> SenderStatus {
    let sender = state.env.caller().into();

    if state.data.blocked_users.contains(&sender) {
        SenderStatus::Blocked
    } else if state.data.direct_chats.get(&sender.into()).is_some() {
        SenderStatus::Ok(sender)
    } else {
        SenderStatus::UnknownUser(state.data.local_user_index_canister_id, sender)
    }
}

pub(crate) async fn verify_user(local_user_index_canister_id: CanisterId, user_id: UserId, is_bot: bool) -> bool {
    let args = local_user_index_canister::c2c_lookup_user::Args {
        user_id_or_principal: user_id.into(),
    };
    if let Ok(response) = local_user_index_canister_c2c_client::c2c_lookup_user(local_user_index_canister_id, &args).await {
        if let local_user_index_canister::c2c_lookup_user::Response::Success(r) = response {
            r.is_bot == is_bot
        } else {
            false
        }
    } else {
        panic!("Failed to call local_user_index to verify user");
    }
}

pub(crate) fn handle_message_impl(
    sender: UserId,
    args: HandleMessageArgs,
    mute_notification: bool,
    state: &mut RuntimeState,
) -> EventWrapper<Message> {
    let replies_to = convert_reply_context(args.replies_to, sender, state);
    let files = args.content.blob_references();

    let push_message_args = PushMessageArgs {
        thread_root_message_index: None,
        message_id: args.message_id.unwrap_or_else(|| state.env.rng().gen()),
        sender,
        content: args.content,
        mentioned: Vec::new(),
        replies_to,
        forwarded: args.forwarding,
        correlation_id: args.correlation_id,
        now: args.now,
    };

    let message_id = push_message_args.message_id;

    let message_event =
        state
            .data
            .direct_chats
            .push_message(false, sender, args.sender_message_index, push_message_args, args.is_bot);

    let mut is_next_event_to_expire = false;
    if let Some(expiry) = message_event.expires_at {
        is_next_event_to_expire = state.data.next_event_expiry.map_or(true, |ex| expiry < ex);
        if is_next_event_to_expire {
            state.data.next_event_expiry = Some(expiry);
        }
    }

    register_timer_jobs(
        sender.into(),
        message_id,
        &message_event,
        files,
        is_next_event_to_expire,
        args.now,
        &mut state.data.timer_jobs,
    );

    if let Some(chat) = state.data.direct_chats.get_mut(&sender.into()) {
        if args.is_bot {
            chat.mark_read_up_to(message_event.event.message_index, false, args.now);
        }
        if !mute_notification && !chat.notifications_muted.value && !state.data.suspended.value {
            let content = &message_event.event.content;
            let notification = Notification::DirectMessage(DirectMessageNotification {
                sender,
                thread_root_message_index: None,
                message_index: message_event.event.message_index,
                event_index: message_event.index,
                sender_name: args.sender_name,
                sender_display_name: args.sender_display_name,
                message_type: content.message_type(),
                message_text: content.notification_text(&[], &[]),
                image_url: content.notification_image_url(),
                sender_avatar_id: args.sender_avatar_id,
                crypto_transfer: content.notification_crypto_transfer_details(&[]),
            });

            let recipient = state.env.canister_id().into();

            state.push_notification(recipient, notification);
        }
    }

    message_event
}

fn convert_reply_context(
    replies_to: Option<C2CReplyContext>,
    sender: UserId,
    state: &RuntimeState,
) -> Option<ReplyContextInternal> {
    match replies_to? {
        C2CReplyContext::ThisChat(message_id) => {
            let chat_id = sender.into();
            state
                .data
                .direct_chats
                .get(&chat_id)
                .and_then(|chat| chat.events.main_events_reader().event_index(message_id.into()))
                .map(|event_index| ReplyContextInternal {
                    chat_if_other: None,
                    event_index,
                })
        }
        C2CReplyContext::OtherChat(chat, thread_root_message_index, event_index) => Some(ReplyContextInternal {
            chat_if_other: Some((chat.into(), thread_root_message_index)),
            event_index,
        }),
    }
}
