use crate::updates::handle_activity_notification;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use candid::Encode;
use canister_api_macros::update_candid_and_msgpack;
use canister_tracing_macros::trace;
use chat_events::{ChatEventInternal, GroupChatEvents, PushMessageArgs};
use group_canister::send_message::{Response::*, *};
use serde_bytes::ByteBuf;
use types::{
    CanisterId, ContentValidationError, EventWrapper, GroupMessageNotification, GroupReplyContext, Message, MessageContent,
    MessageIndex, Notification, TimestampMillis, UserId,
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

        if !participant.role.can_send_messages(permissions) {
            return NotAuthorized;
        }

        if matches!(args.content, MessageContent::Poll(_)) && !participant.role.can_create_polls(permissions) {
            return NotAuthorized;
        }

        let sender = participant.user_id;
        let user_being_replied_to = args
            .replies_to
            .as_ref()
            .and_then(|r| get_user_being_replied_to(r, &runtime_state.data.events));

        let push_message_args = PushMessageArgs {
            sender,
            message_id: args.message_id,
            content: args.content.new_content_into_internal(),
            replies_to: args.replies_to.map(|r| r.into()),
            now,
            forwarded: args.forwarding,
        };

        let message_event = runtime_state.data.events.push_message(push_message_args);

        handle_activity_notification(runtime_state);

        let event_index = message_event.index;
        let message_index = message_event.event.message_index;

        register_callbacks_if_required(&message_event, runtime_state);

        let mut notification_recipients = runtime_state.data.participants.users_to_notify(sender);

        let mut add_mention = |user_id: UserId| {
            if runtime_state.data.participants.add_mention(&user_id, message_index) {
                // Also notify any mentioned participants regardless of whether they have muted notifications for the group
                notification_recipients.insert(user_id);
            }
        };

        for u in &args.mentioned {
            add_mention(u.user_id);
        }
        if let Some(user_id) = user_being_replied_to {
            if user_id != sender {
                add_mention(user_id);
            }
        }

        let notification = Notification::GroupMessageNotification(GroupMessageNotification {
            chat_id: runtime_state.env.canister_id().into(),
            group_name: runtime_state.data.name.clone(),
            sender,
            sender_name: args.sender_name,
            message: message_event,
            mentioned: args.mentioned,
            hide: false,
        });

        runtime_state.push_notification(notification_recipients.into_iter().collect(), notification);

        Success(SuccessResult {
            event_index,
            message_index,
            timestamp: now,
        })
    } else {
        CallerNotInGroup
    }
}

fn register_callbacks_if_required(message_event: &EventWrapper<Message>, runtime_state: &mut RuntimeState) {
    if let MessageContent::Poll(p) = &message_event.event.content {
        if let Some(end_date) = p.config.end_date {
            ic_cdk::spawn(register_end_poll_callback(
                runtime_state.data.callback_canister_id,
                message_event.event.message_index,
                end_date,
            ));
        }
    }
}

async fn register_end_poll_callback(canister_id: CanisterId, message_index: MessageIndex, end_date: TimestampMillis) {
    let payload = ByteBuf::from(Encode!(&group_canister::c2c_end_poll::Args { message_index }).unwrap());
    let args = callback_canister::c2c_register_callback::Args {
        method_name: "c2c_end_poll".to_string(),
        payload,
        timestamp: end_date,
    };
    let _ = callback_canister_c2c_client::c2c_register_callback(canister_id, &args).await;
}

fn get_user_being_replied_to(replies_to: &GroupReplyContext, events: &GroupChatEvents) -> Option<UserId> {
    if let Some(ChatEventInternal::Message(message)) = events.get(replies_to.event_index).map(|e| &e.event) {
        Some(message.sender)
    } else {
        None
    }
}
