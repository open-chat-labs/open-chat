use crate::User;
use types::{TimestampMillis, Timestamped};
use user_canister::c2c_set_user_suspended::SuccessResult;

// Returns the user's groups and communities, which the UserIndex suspends them in
pub fn c2c_set_user_suspended(user: &mut User, suspended: bool, now: TimestampMillis) -> SuccessResult {
    user.suspended = Timestamped::new(suspended, now);
    SuccessResult {
        groups: user.group_chats.iter().map(|g| g.chat_id).collect(),
        communities: user.communities.iter().map(|c| c.community_id).collect(),
    }
}
