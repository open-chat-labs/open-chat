use crate::guards::caller_is_video_call_operator;
use crate::timer_job_types::RemoveExpiredEventsJob;
use crate::{mutate_state, run_regular_jobs, RuntimeState, TimerJob};
use canister_tracing_macros::trace;
use chat_events::{MessageContentInternal, PushMessageArgs};
use event_sink_client::EventBuilder;
use ic_cdk_macros::update;
use rand::Rng;
use types::{
    CallParticipant, ChatId, DirectMessageNotification, EventWrapper, Message, MessageId, MessageIndex, Notification, UserId,
    VideoCallContent,
};
use user_canister::send_message_v2::SuccessResult;
use user_canister::start_video_call::{Response::*, *};
use user_canister::{StartVideoCallArgs, UserCanisterEvent};
use utils::consts::VIDEO_CALL_BOT_USERNAME;

#[update(guard = "caller_is_video_call_operator")]
#[trace]
fn start_video_call(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| {
        if state.data.suspended.value || state.data.blocked_users.contains(&args.initiator) {
            return NotAuthorized;
        }

        let sender: UserId = state.env.caller().into();

        let StartVideoCallResult { chat_id, message_event } =
            handle_start_video_call(args.message_id, None, sender, args.initiator, args.initiator, state);

        state.push_user_canister_event(
            args.initiator.into(),
            UserCanisterEvent::StartVideoCall(Box::new(StartVideoCallArgs {
                message_id: args.message_id,
                message_index: message_event.event.message_index,
                sender,
                initiator: args.initiator,
            })),
        );

        Success(SuccessResult {
            chat_id,
            event_index: message_event.index,
            message_index: message_event.event.message_index,
            timestamp: message_event.timestamp,
            expires_at: message_event.expires_at,
        })
    })
}

pub fn handle_start_video_call(
    message_id: MessageId,
    message_index: Option<MessageIndex>,
    sender: UserId,
    initiator: UserId,
    other: UserId,
    state: &mut RuntimeState,
) -> StartVideoCallResult {
    let now = state.env.now();

    let push_message_args = PushMessageArgs {
        thread_root_message_index: None,
        message_id,
        sender,
        content: MessageContentInternal::VideoCall(VideoCallContent {
            participants: vec![CallParticipant {
                user_id: initiator,
                joined: now,
            }],
            ended: None,
        }),
        mentioned: Vec::new(),
        replies_to: None,
        forwarded: false,
        sender_is_bot: true,
        correlation_id: 0,
        now,
    };

    let chat = if let Some(c) = state.data.direct_chats.get_mut(&other.into()) {
        c
    } else {
        state.data.direct_chats.create(other, false, state.env.rng().gen(), now)
    };

    let notifications_muted = message_index.is_some() || chat.notifications_muted.value;

    let (message_event, event_payload) = chat.push_message(false, push_message_args, message_index);

    if let Some(expiry) = message_event.expires_at {
        if state.data.next_event_expiry.map_or(true, |ex| expiry < ex) {
            state.data.next_event_expiry = Some(expiry);

            let timer_jobs = &mut state.data.timer_jobs;
            timer_jobs.cancel_jobs(|j| matches!(j, TimerJob::RemoveExpiredEvents(_)));
            timer_jobs.enqueue_job(TimerJob::RemoveExpiredEvents(RemoveExpiredEventsJob), expiry, now);
        }
    }

    state.data.event_sink_client.push(
        EventBuilder::new("message_sent", now)
            .with_user(VIDEO_CALL_BOT_USERNAME.to_string())
            .with_source(sender.to_string())
            .with_json_payload(&event_payload)
            .build(),
    );

    if !notifications_muted {
        let content = &message_event.event.content;
        let notification = Notification::DirectMessage(DirectMessageNotification {
            sender,
            thread_root_message_index: None,
            message_index: message_event.event.message_index,
            event_index: message_event.index,
            sender_name: VIDEO_CALL_BOT_USERNAME.to_string(),
            sender_display_name: None,
            message_type: content.message_type(),
            message_text: None,
            image_url: None,
            sender_avatar_id: None,
            crypto_transfer: None,
        });

        state.push_notification(state.env.canister_id().into(), notification);
    }

    StartVideoCallResult {
        chat_id: other.into(),
        message_event,
    }
}

pub struct StartVideoCallResult {
    pub chat_id: ChatId,
    pub message_event: EventWrapper<Message>,
}
