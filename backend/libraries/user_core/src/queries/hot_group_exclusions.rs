use crate::User;
use types::{ChatId, TimestampMillis};

pub fn hot_group_exclusions(user: &User, now: TimestampMillis) -> Vec<ChatId> {
    user.hot_group_exclusions.get_all(now).copied().collect()
}
