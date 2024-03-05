use crate::updates::send_message::register_timer_jobs;
use crate::{mutate_state, read_state, RuntimeState};
use canister_tracing_macros::trace;
use chat_events::{MessageContentInternal, PushMessageArgs, Reader, ReplyContextInternal};
use event_sink_client::EventBuilder;
use ic_cdk_macros::update;
use rand::Rng;
use types::{
    CanisterId, DirectMessageNotification, EventWrapper, Message, MessageId, MessageIndex, Notification, TimestampMillis,
    UserId,
};
use user_canister::C2CReplyContext;

#[update]
#[trace]
async fn c2c_handle_bot_messages(
    args: user_canister::c2c_handle_bot_messages::Args,
) -> user_canister::c2c_handle_bot_messages::Response {
    let (sender_status, now) = read_state(|state| (get_sender_status(state), state.env.now()));

    let sender = match sender_status {
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
                HandleMessageArgs {
                    sender,
                    message_id: None,
                    sender_message_index: None,
                    sender_name: args.bot_name.clone(),
                    sender_display_name: args.bot_display_name.clone(),
                    content: message.content.into(),
                    replies_to: None,
                    forwarding: false,
                    is_bot: true,
                    sender_avatar_id: None,
                    push_message_sent_event: true,
                    mute_notification: false,
                    now,
                },
                state,
            );
        }
    });
    user_canister::c2c_handle_bot_messages::Response::Success
}

pub(crate) struct HandleMessageArgs {
    pub sender: UserId,
    pub message_id: Option<MessageId>,
    pub sender_message_index: Option<MessageIndex>,
    pub sender_name: String,
    pub sender_display_name: Option<String>,
    pub content: MessageContentInternal,
    pub replies_to: Option<C2CReplyContext>,
    pub forwarding: bool,
    pub is_bot: bool,
    pub sender_avatar_id: Option<u128>,
    pub push_message_sent_event: bool,
    pub mute_notification: bool,
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

pub(crate) fn handle_message_impl(args: HandleMessageArgs, state: &mut RuntimeState) -> EventWrapper<Message> {
    let chat_id = args.sender.into();
    let replies_to = convert_reply_context(args.replies_to, args.sender, state);
    let files = args.content.blob_references();

    let push_message_args = PushMessageArgs {
        thread_root_message_index: None,
        message_id: args.message_id.unwrap_or_else(|| state.env.rng().gen()),
        sender: args.sender,
        content: args.content,
        mentioned: Vec::new(),
        replies_to,
        forwarded: args.forwarding,
        sender_is_bot: args.is_bot,
        correlation_id: 0,
        now: args.now,
    };

    let chat = if let Some(c) = state.data.direct_chats.get_mut(&chat_id) {
        c
    } else {
        state
            .data
            .direct_chats
            .create(args.sender, args.is_bot, state.env.rng().gen(), args.now)
    };

    let message_id = push_message_args.message_id;

    let (message_event, event_payload) = chat.push_message(false, push_message_args, args.sender_message_index);

    if args.is_bot {
        chat.mark_read_up_to(message_event.event.message_index, false, args.now);
    }

    let this_canister_id = state.env.canister_id();
    if !args.mute_notification && !chat.notifications_muted.value && !state.data.suspended.value {
        let content = &message_event.event.content;
        let notification = Notification::DirectMessage(DirectMessageNotification {
            sender: args.sender,
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

        let recipient = this_canister_id.into();

        state.push_notification(recipient, notification);
    }

    if args.push_message_sent_event {
        state.data.event_sink_client.push(
            EventBuilder::new("message_sent", args.now)
                .with_user(args.sender.to_string())
                .with_source(this_canister_id.to_string())
                .with_json_payload(&event_payload)
                .build(),
        );
    }

    register_timer_jobs(chat_id, message_id, &message_event, files, args.now, &mut state.data);

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
