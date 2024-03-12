use crate::guards::caller_is_video_call_operator;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_tracing_macros::trace;
use chat_events::{MessageContentInternal, PushMessageArgs};
use ic_cdk_macros::update;
use rand::Rng;
use types::{
    CallParticipant, DirectMessageNotification, EventWrapper, Message, MessageId, MessageIndex, Notification, UserId,
    VideoCallContent,
};
use user_canister::start_video_call::{Response::*, *};
use user_canister::{StartVideoCallArgs, UserCanisterEvent};

#[update(guard = "caller_is_video_call_operator")]
#[trace]
fn start_video_call(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| {
        let sender = args.initiator;
        if state.data.suspended.value || state.data.blocked_users.contains(&sender) {
            return NotAuthorized;
        }

        let StartVideoCallResult {
            message_event,
            mute_notification,
        } = handle_start_video_call(args.message_id, None, sender, sender, state);

        if !mute_notification {
            let notification = Notification::DirectMessage(DirectMessageNotification {
                sender,
                thread_root_message_index: None,
                message_index: message_event.event.message_index,
                event_index: message_event.index,
                sender_name: args.initiator_username,
                sender_display_name: args.initiator_display_name,
                message_type: message_event.event.content.message_type(),
                message_text: None,
                image_url: None,
                sender_avatar_id: args.initiator_avatar_id,
                crypto_transfer: None,
            });

            state.push_notification(state.env.canister_id().into(), notification);
        }

        state.push_user_canister_event(
            sender.into(),
            UserCanisterEvent::StartVideoCall(Box::new(StartVideoCallArgs {
                message_id: args.message_id,
                message_index: message_event.event.message_index,
            })),
        );

        Success
    })
}

pub fn handle_start_video_call(
    message_id: MessageId,
    their_message_index: Option<MessageIndex>,
    sender: UserId,
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
                user_id: sender,
                joined: now,
            }],
            ended: None,
        }),
        mentioned: Vec::new(),
        replies_to: None,
        forwarded: false,
        sender_is_bot: true,
        sender_name_override: None,
        correlation_id: 0,
        now,
    };

    let chat = if let Some(c) = state.data.direct_chats.get_mut(&other.into()) {
        c
    } else {
        state.data.direct_chats.create(other, false, state.env.rng().gen(), now)
    };
    let mute_notification = their_message_index.is_some() || chat.notifications_muted.value;

    let message_event = chat.push_message(
        false,
        push_message_args,
        their_message_index,
        Some(&mut state.data.event_sink_client),
    );

    if let Some(expiry) = message_event.expires_at {
        state.data.handle_event_expiry(expiry, now);
    }

    StartVideoCallResult {
        message_event,
        mute_notification,
    }
}

pub struct StartVideoCallResult {
    pub message_event: EventWrapper<Message>,
    pub mute_notification: bool,
}
