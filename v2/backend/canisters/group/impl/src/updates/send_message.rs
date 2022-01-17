use crate::updates::handle_activity_notification;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::trace;
use chat_events::{ChatEventInternal, PushMessageArgs};
use group_canister::send_message::{Response::*, *};
use ic_cdk_macros::update;
use types::{ContentValidationError, GroupMessageNotification, Notification, UserId};

#[update]
#[trace]
fn send_message(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| send_message_impl(args, state))
}

fn send_message_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let caller = runtime_state.env.caller();
    if let Some(participant) = runtime_state.data.participants.get_by_principal_mut(&caller) {
        if let Err(error) = args.content.validate() {
            return match error {
                ContentValidationError::Empty => MessageEmpty,
                ContentValidationError::TextTooLong(max_length) => TextTooLong(max_length),
            };
        }

        let now = runtime_state.env.now();
        let sender = participant.user_id;
        let replies_to_user_id = args
            .replies_to
            .as_ref()
            .map(|r| {
                if let Some(ChatEventInternal::Message(message)) =
                    runtime_state.data.events.get(r.event_index).map(|e| &e.event)
                {
                    Some(message.sender)
                } else {
                    None
                }
            })
            .flatten();

        let push_message_args = PushMessageArgs {
            sender,
            message_id: args.message_id,
            content: args.content,
            replies_to: args.replies_to.map(|r| r.into()),
            now,
        };

        let message_event = runtime_state.data.events.push_message(push_message_args);

        handle_activity_notification(runtime_state);

        let event_index = message_event.index;
        let message_index = message_event.event.message_index;

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
        if let Some(user_id) = replies_to_user_id {
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
