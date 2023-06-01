use crate::timer_job_types::{DeleteFileReferencesJob, TimerJob};
use crate::{mutate_state, read_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_timer_jobs::TimerJobs;
use canister_tracing_macros::trace;
use chat_events::{PushMessageArgs, Reader};
use ic_cdk_macros::update;
use types::{
    BlobReference, CanisterId, DirectMessageNotification, EventWrapper, Message, MessageContent, MessageContentInitial,
    MessageId, MessageIndex, Notification, ReplyContext, TimestampMillis, UserId,
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
            if !verify_user(local_user_index_canister_id, user_id, false).await {
                panic!("This request is not from an OpenChat user");
            }
            user_id
        }
    };

    mutate_state(|state| {
        let now = state.env.now();
        for message in args.messages {
            // Messages sent c2c can be retried so the same messageId may be received multiple
            // times, so here we skip any messages whose messageId already exists.
            if let Some(chat) = state.data.direct_chats.get(&sender_user_id.into()) {
                if chat
                    .events
                    .main_events_reader(now)
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
                    now,
                },
                false,
                state,
            );
        }
    });

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
        let content: MessageContentInitial = message.content.clone().into();
        if let Err(error) = content.validate_for_new_direct_message(sender_user_id, false, now) {
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
                    content: message.content,
                    replies_to: None,
                    forwarding: false,
                    correlation_id: 0,
                    is_bot: true,
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
    pub content: MessageContent,
    pub replies_to: Option<C2CReplyContext>,
    pub forwarding: bool,
    pub correlation_id: u64,
    pub is_bot: bool,
    pub now: TimestampMillis,
}

enum SenderStatus {
    Ok(UserId),
    Blocked,
    UnknownUser(CanisterId, UserId),
}

fn get_sender_status(state: &RuntimeState) -> SenderStatus {
    let sender = state.env.caller().into();

    if state.data.blocked_users.contains(&sender) {
        SenderStatus::Blocked
    } else if state.data.direct_chats.get(&sender.into()).is_some() {
        SenderStatus::Ok(sender)
    } else {
        SenderStatus::UnknownUser(state.data.local_user_index_canister_id, sender)
    }
}

async fn verify_user(local_user_index_canister_id: CanisterId, user_id: UserId, is_bot: bool) -> bool {
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
    let replies_to = convert_reply_context(args.replies_to, sender, args.now, state);
    let initial_content: MessageContentInitial = args.content.into();
    let content = initial_content.new_content_into_internal();
    let files = content.blob_references();

    let push_message_args = PushMessageArgs {
        thread_root_message_index: None,
        message_id: args.message_id.unwrap_or_else(|| MessageId::generate(state.env.rng())),
        sender,
        content,
        replies_to,
        forwarded: args.forwarding,
        correlation_id: args.correlation_id,
        now: args.now,
    };

    let message_event =
        state
            .data
            .direct_chats
            .push_message(false, sender, args.sender_message_index, push_message_args, args.is_bot);

    register_timer_jobs(&message_event, files, args.now, &mut state.data.timer_jobs);

    if let Some(chat) = state.data.direct_chats.get_mut(&sender.into()) {
        if args.is_bot {
            chat.mark_read_up_to(message_event.event.message_index, false, args.now);
        }
        if !mute_notification && !chat.notifications_muted.value && !*state.data.suspended {
            let notification = Notification::DirectMessageNotification(DirectMessageNotification {
                sender,
                thread_root_message_index: None,
                sender_name: args.sender_name,
                message: message_event.clone(),
            });

            let recipient = state.env.canister_id().into();

            state.push_notification(vec![recipient], notification);
        }
    }

    message_event
}

fn convert_reply_context(
    replies_to: Option<C2CReplyContext>,
    sender: UserId,
    now: TimestampMillis,
    state: &RuntimeState,
) -> Option<ReplyContext> {
    match replies_to? {
        C2CReplyContext::ThisChat(message_id) => {
            let chat_id = sender.into();
            state
                .data
                .direct_chats
                .get(&chat_id)
                .and_then(|chat| chat.events.main_events_reader(now).event_index(message_id.into()))
                .map(|event_index| ReplyContext {
                    chat_id_if_other: None,
                    event_list_if_other: None,
                    event_index,
                })
        }
        C2CReplyContext::OtherChat(chat_id, event_index) => Some(ReplyContext {
            chat_id_if_other: Some(chat_id),
            event_list_if_other: Some((chat_id, None)),
            event_index,
        }),
        C2CReplyContext::OtherEventList(chat_id, thread_root_message_index, event_index) => Some(ReplyContext {
            chat_id_if_other: Some(chat_id),
            event_list_if_other: Some((chat_id, thread_root_message_index)),
            event_index,
        }),
    }
}

fn register_timer_jobs(
    message_event: &EventWrapper<Message>,
    file_references: Vec<BlobReference>,
    now: TimestampMillis,
    timer_jobs: &mut TimerJobs<TimerJob>,
) {
    if !file_references.is_empty() {
        if let Some(expiry) = message_event.expires_at {
            timer_jobs.enqueue_job(
                TimerJob::DeleteFileReferences(DeleteFileReferencesJob { files: file_references }),
                expiry,
                now,
            );
        }
    }
}
