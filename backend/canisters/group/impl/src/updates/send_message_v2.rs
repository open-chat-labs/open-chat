use crate::activity_notifications::handle_activity_notification;
use crate::timer_job_types::{DeleteFileReferencesJob, EndPollJob};
use crate::{mutate_state, run_regular_jobs, Data, RuntimeState, TimerJob};
use canister_api_macros::update_candid_and_msgpack;
use canister_timer_jobs::TimerJobs;
use canister_tracing_macros::trace;
use chat_events::{PushMessageArgs, Reader};
use group_canister::send_message_v2::{Response::*, *};
use std::collections::HashSet;
use types::{
    BlobReference, ContentValidationError, EventIndex, EventWrapper, GroupMessageNotification, GroupReplyContext,
    MentionInternal, Message, MessageContent, MessageContentInitial, MessageIndex, Notification, TimestampMillis, UserId, CryptoTransaction,
};

#[update_candid_and_msgpack]
#[trace]
fn send_message(args: group_canister::send_message::Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| send_message_impl(args.into(), state))
}

#[update_candid_and_msgpack]
#[trace]
fn send_message_v2(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| send_message_impl(args, state))
}

fn send_message_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    if runtime_state.data.is_frozen() {
        return ChatFrozen;
    }

    let caller = runtime_state.env.caller();
    if let Some(participant) = runtime_state.data.participants.get(caller) {
        if participant.suspended.value {
            return UserSuspended;
        }

        let now = runtime_state.env.now();

        if let Err(error) = args.content.validate_for_new_message(false, args.forwarding, now) {
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
                ContentValidationError::PrizeEndDateInThePast => InvalidRequest("Prize ended in the past".to_string()),
            };
        }

        if let Some(transfer) = match &args.content {
            MessageContentInitial::Crypto(c) => Some(&c.transfer),
            MessageContentInitial::Prize(c) => Some(&c.transfer),
            _ => None
        } {
            if !matches!(transfer, CryptoTransaction::Completed(_)) {
                return InvalidRequest("The crypto transaction must be completed".to_string());
            }
        }

        let permissions = &runtime_state.data.permissions;

        if args.thread_root_message_index.is_some() {
            if !participant.role.can_reply_in_thread(permissions) {
                return NotAuthorized;
            }
        } else if !participant.role.can_send_messages(permissions) {
            return NotAuthorized;
        }

        if matches!(args.content, MessageContentInitial::Poll(_)) && !participant.role.can_create_polls(permissions) {
            return NotAuthorized;
        }

        if let Some(root_message_index) = args.thread_root_message_index {
            if !runtime_state.data.events.is_accessible(
                participant.min_visible_event_index(),
                None,
                root_message_index.into(),
                now,
            ) {
                return ThreadMessageNotFound;
            }
        }

        let sender = participant.user_id;
        let min_visible_event_index = participant.min_visible_event_index();
        let user_being_replied_to = args.replies_to.as_ref().and_then(|r| {
            get_user_being_replied_to(
                r,
                min_visible_event_index,
                args.thread_root_message_index,
                now,
                &runtime_state.data,
            )
        });
        let content = args.content.new_content_into_internal();
        let files = content.blob_references();

        let push_message_args = PushMessageArgs {
            sender,
            thread_root_message_index: args.thread_root_message_index,
            message_id: args.message_id,
            content,
            replies_to: args.replies_to.map(|r| r.into()),
            forwarded: args.forwarding,
            correlation_id: args.correlation_id,
            now,
        };

        let message_event = runtime_state.data.events.push_message(push_message_args);

        register_timer_jobs(
            args.thread_root_message_index,
            &message_event,
            files,
            now,
            &mut runtime_state.data.timer_jobs,
        );

        let event_index = message_event.index;
        let message_index = message_event.event.message_index;
        let expires_at = message_event.expires_at;

        let mut mentions: HashSet<_> = args
            .mentioned
            .iter()
            .map(|m| m.user_id)
            .chain(user_being_replied_to)
            .collect();

        let mut notification_recipients = HashSet::new();
        let mut thread_participants = None;

        if let Some(thread_root_message) = args.thread_root_message_index.and_then(|root_message_index| {
            runtime_state
                .data
                .events
                .visible_main_events_reader(min_visible_event_index, now)
                .message_internal(root_message_index.into())
                .cloned()
        }) {
            notification_recipients.insert(thread_root_message.sender);

            if let Some(thread_summary) = thread_root_message.thread_summary {
                thread_participants = Some(thread_summary.participant_ids);

                let is_first_reply = thread_summary.reply_count == 1;
                if is_first_reply {
                    mentions.insert(thread_root_message.sender);
                }
            }

            for user_id in mentions.iter().copied().chain([sender]) {
                runtime_state
                    .data
                    .participants
                    .add_thread(&user_id, thread_root_message.message_index);
            }
        }

        mentions.remove(&sender);
        for user_id in mentions.iter() {
            if let Some(participant) = runtime_state.data.participants.get_by_user_id_mut(user_id) {
                participant.mentions_v2.add(
                    MentionInternal {
                        thread_root_message_index: args.thread_root_message_index,
                        message_index,
                    },
                    now,
                );
            }
        }

        notification_recipients.extend(runtime_state.data.participants.users_to_notify(thread_participants));
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
        });

        runtime_state.push_notification(notification_recipients, notification);

        handle_activity_notification(runtime_state);

        Success(SuccessResult {
            event_index,
            message_index,
            timestamp: now,
            expires_at,
        })
    } else {
        CallerNotInGroup
    }
}

fn register_timer_jobs(
    thread_root_message_index: Option<MessageIndex>,
    message_event: &EventWrapper<Message>,
    file_references: Vec<BlobReference>,
    now: TimestampMillis,
    timer_jobs: &mut TimerJobs<TimerJob>,
) {
    if let MessageContent::Poll(p) = &message_event.event.content {
        if let Some(end_date) = p.config.end_date {
            timer_jobs.enqueue_job(
                TimerJob::EndPoll(EndPollJob {
                    thread_root_message_index,
                    message_index: message_event.event.message_index,
                }),
                end_date,
                now,
            );
        }
    }

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

fn get_user_being_replied_to(
    replies_to: &GroupReplyContext,
    min_visible_event_index: EventIndex,
    thread_root_message_index: Option<MessageIndex>,
    now: TimestampMillis,
    data: &Data,
) -> Option<UserId> {
    let events_reader = data
        .events
        .events_reader(min_visible_event_index, thread_root_message_index, now)?;

    events_reader
        .message_internal(replies_to.event_index.into())
        .map(|message| message.sender)
}
