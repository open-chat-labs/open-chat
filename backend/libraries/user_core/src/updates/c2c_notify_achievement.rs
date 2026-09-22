use crate::User;
use types::{Achievement, CanisterId, TimestampMillis};

// Awards the achievements, provided the caller is one of the user's groups or communities. Returns
// None if it isn't, else whether any were newly awarded, on which the caller tells the
// LocalUserIndex of the user's new CHIT balance.
pub fn c2c_notify_achievement(
    user: &mut User,
    caller: CanisterId,
    achievements: Vec<Achievement>,
    now: TimestampMillis,
) -> Option<bool> {
    if !user.communities.exists(&caller.into()) && !user.group_chats.exists(&caller.into()) {
        return None;
    }

    let mut awarded = false;
    for achievement in achievements {
        awarded |= user.award_achievement(achievement, now);
    }
    Some(awarded)
}
