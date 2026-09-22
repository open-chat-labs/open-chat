use crate::User;
use oc_error_codes::OCErrorCode;
use types::{
    CallDismissalKind, DirectCallDismissedNotification, DirectChatUserNotificationPayload, OCResult, TimestampMillis, UserId,
    VideoCallPresence,
};
use user_canister::join_video_call::Args;

// Records the user joining the call in their chat. On success the caller tells the other user's
// canister and awards the `JoinedCall` achievement.
pub fn join_video_call(user: &mut User, args: &Args, my_user_id: UserId, now: TimestampMillis) -> OCResult {
    user.verify_not_suspended()?;

    if user.blocked_users.contains(&args.user_id) {
        return Err(OCErrorCode::TargetUserBlocked.into());
    }

    let chat = user
        .direct_chats
        .get_mut(&args.user_id.into())
        .ok_or(OCErrorCode::ChatNotFound)?;
    chat.set_video_call_presence(my_user_id, args.message_id, VideoCallPresence::Default, now)?;
    Ok(())
}

// The push that stops this user's other devices ringing once they have joined (open-chat
// #9456). None when the chat is muted, since a muted chat never rang.
pub fn answered_dismissal(user: &User, args: &Args) -> Option<DirectChatUserNotificationPayload> {
    let chat = user.direct_chats.get(&args.user_id.into())?;
    (!chat.notifications_muted.value).then(|| {
        DirectChatUserNotificationPayload::DirectCallDismissed(DirectCallDismissedNotification {
            them: args.user_id,
            message_id: args.message_id,
            kind: CallDismissalKind::AnsweredElsewhere,
        })
    })
}
