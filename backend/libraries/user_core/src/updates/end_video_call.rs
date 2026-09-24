use crate::User;
use chat_events::{EventPusher, Reader};
use oc_error_codes::OCErrorCode;
use types::{
    CallDismissalKind, DirectCallDismissedNotification, DirectChatUserNotificationPayload, MessageId, OCResult,
    TimestampMillis, UserId,
};

// Marks the call in the user's chat with `them` ended. A call the user started is pushed to the
// event store by the pusher given, once, from the starter's side. Returns the notification that
// stops whichever of the user's devices is still ringing, unless they have muted the chat.
pub fn end_video_call<P: EventPusher>(
    user: &mut User,
    my_user_id: UserId,
    them: UserId,
    message_id: MessageId,
    now: TimestampMillis,
    event_pusher: impl FnOnce() -> P,
) -> OCResult<Option<DirectChatUserNotificationPayload>> {
    let chat = user.direct_chats.get_mut(&them.into()).ok_or(OCErrorCode::MessageNotFound)?;
    let was_started_by_me = chat
        .events()
        .main_events_reader()
        .message_internal(message_id.into())
        .map(|m| m.sender != them)
        .unwrap_or_default();
    let i_was_in_the_call = chat.events().video_call_participants_of(message_id).contains(&my_user_id);
    let muted = chat.notifications_muted.value;

    chat.end_video_call(message_id.into(), now, was_started_by_me.then(event_pusher))?;

    Ok((!muted).then_some(DirectChatUserNotificationPayload::DirectCallDismissed(
        DirectCallDismissedNotification {
            them,
            message_id,
            kind: if i_was_in_the_call { CallDismissalKind::AnsweredElsewhere } else { CallDismissalKind::Ended },
        },
    )))
}
