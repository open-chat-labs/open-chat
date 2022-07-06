use crate::updates::handle_activity_notification;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update_candid_and_msgpack;
use canister_tracing_macros::trace;
use chat_events::{ChatEventInternal, ChatEvents, PushMessageArgs};
use group_canister::send_message::{Response::*, *};
use serde_bytes::ByteBuf;
use std::collections::HashSet;
use types::{
    CanisterId, ChatId, ContentValidationError, EventWrapper, GroupMessageNotification, GroupReplyContext, Message,
    MessageContent, MessageIndex, Notification, TimestampMillis, UserId,
};

#[update_candid_and_msgpack]
#[trace]
fn send_message(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| send_message_impl(args, state))
}

fn send_message_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let caller = runtime_state.env.caller();
    if let Some(participant) = runtime_state.data.participants.get(caller) {
        let now = runtime_state.env.now();

        if let Err(error) = args.content.validate_for_new_message(args.forwarding, now) {
            return match error {
                ContentValidationError::Empty => MessageEmpty,
                ContentValidationError::TextTooLong(max_length) => TextTooLong(max_length),
                ContentValidationError::InvalidPoll(reason) => InvalidPoll(reason),
                ContentValidationError::TransferCannotBeZero | ContentValidationError::TransferLimitExceeded(_) => {
                    unreachable!()
                }
                ContentValidationError::InvalidTypeForForwarding => {
                    InvalidRequest("Cannot forward this type of message".to_string())
                }
            };
        }

        let permissions = &runtime_state.data.permissions;

        if args.thread_root_message_index.is_some() {
            if !participant.role.can_reply_in_thread(permissions) {
                return NotAuthorized;
            }
        } else if !participant.role.can_send_messages(permissions) {
            return NotAuthorized;
        }

        if matches!(args.content, MessageContent::Poll(_)) && !participant.role.can_create_polls(permissions) {
            return NotAuthorized;
        }

        let sender = participant.user_id;
        let user_being_replied_to = args
            .replies_to
            .as_ref()
            .and_then(|r| get_user_being_replied_to(r, &runtime_state.data.events.main));

        let push_message_args = PushMessageArgs {
            sender,
            message_id: args.message_id,
            content: args.content.new_content_into_internal(),
            replies_to: args.replies_to.map(|r| r.into()),
            now,
            forwarded: args.forwarding,
        };

        let (message_event, thread_participants, root_message_sender, first_thread_reply) = match args.thread_root_message_index
        {
            Some(thread_message_index) => {
                if let Some(root_message) = runtime_state.data.events.main.message_by_message_index(thread_message_index) {
                    let root_message_sender = root_message.event.sender;

                    let thread_events = runtime_state
                        .data
                        .events
                        .threads
                        .entry(thread_message_index)
                        .or_insert_with(|| ChatEvents::new_thread());

                    let message_event = thread_events.push_message(push_message_args);

                    let thread_summary = runtime_state.data.events.main.update_thread_summary(
                        thread_message_index,
                        sender,
                        true,
                        message_event.index,
                        now,
                    );
                    (
                        message_event,
                        Some(thread_summary.participant_ids),
                        Some(root_message_sender),
                        thread_summary.reply_count == 1,
                    )
                } else {
                    return ThreadMessageNotFound;
                }
            }
            None => (
                runtime_state.data.events.main.push_message(push_message_args),
                None,
                None,
                false,
            ),
        };

        let event_index = message_event.index;
        let message_index = message_event.event.message_index;

        handle_activity_notification(runtime_state);

        register_callbacks_if_required(args.thread_root_message_index, &message_event, runtime_state);

        // Add mentions
        let mut mentions: HashSet<UserId> = args.mentioned.iter().map(|m| m.user_id).collect();
        if let Some(user_id) = user_being_replied_to {
            mentions.insert(user_id);
        }
        mentions.remove(&sender);

        for user_id in mentions.iter() {
            runtime_state
                .data
                .participants
                .add_mention(user_id, args.thread_root_message_index, message_index);
        }

        // If this is the first message in a thread then mention the original sender/message
        if let (Some(user_id), Some(root_message_index)) = (root_message_sender, args.thread_root_message_index) {
            if first_thread_reply {
                runtime_state
                    .data
                    .participants
                    .add_mention(&user_id, None, root_message_index);
            }
        }

        // Build the notification recipients list
        let mut notification_recipients = runtime_state.data.participants.users_to_notify(thread_participants.as_ref());
        if let Some(user_id) = root_message_sender {
            notification_recipients.insert(user_id);
        }
        notification_recipients.extend(&mentions);
        notification_recipients.remove(&sender);
        let notification_recipients: Vec<UserId> = notification_recipients.into_iter().collect();

        let notification = Notification::GroupMessageNotification(GroupMessageNotification {
            chat_id: runtime_state.env.canister_id().into(),
            thread_root_message_index: args.thread_root_message_index,
            group_name: runtime_state.data.name.clone(),
            sender,
            sender_name: args.sender_name,
            message: message_event,
            mentioned: args.mentioned,
            hide: false,
        });

        runtime_state.push_notification(notification_recipients, notification);

        Success(SuccessResult {
            event_index,
            message_index,
            timestamp: now,
        })
    } else {
        CallerNotInGroup
    }
}

fn register_callbacks_if_required(
    thread_root_message_index: Option<MessageIndex>,
    message_event: &EventWrapper<Message>,
    runtime_state: &mut RuntimeState,
) {
    if let MessageContent::Poll(p) = &message_event.event.content {
        if let Some(end_date) = p.config.end_date {
            ic_cdk::spawn(register_end_poll_callback(
                runtime_state.data.callback_canister_id,
                thread_root_message_index,
                message_event.event.message_index,
                end_date,
            ));
        }
    }
}

async fn register_end_poll_callback(
    canister_id: CanisterId,
    thread_root_message_index: Option<MessageIndex>,
    message_index: MessageIndex,
    end_date: TimestampMillis,
) {
    let payload = ByteBuf::from(msgpack::serialize(&group_canister::c2c_end_poll::Args {
        thread_root_message_index,
        message_index,
    }));
    let args = callback_canister::c2c_register_callback::Args {
        method_name: "c2c_end_poll_msgpack".to_string(),
        payload,
        timestamp: end_date,
    };
    let _ = callback_canister_c2c_client::c2c_register_callback(canister_id, &args).await;
}

fn get_user_being_replied_to(replies_to: &GroupReplyContext, events: &ChatEvents) -> Option<UserId> {
    if let Some(ChatEventInternal::Message(message)) = events.get(replies_to.event_index).map(|e| &e.event) {
        Some(message.sender)
    } else {
        None
    }
}
