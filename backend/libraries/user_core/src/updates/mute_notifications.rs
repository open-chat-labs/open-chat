use crate::User;
use types::{ChatId, TimestampMillis, Timestamped};

// Only direct chats are muted here: groups and channels are muted via their own canisters. A chat
// the user doesn't have is skipped.
pub fn toggle_mute_notifications(user: &mut User, chat_id: ChatId, mute: bool, now: TimestampMillis) {
    if let Some(chat) = user.direct_chats.get_mut(&chat_id) {
        chat.notifications_muted = Timestamped::new(mute, now);
    }
}
