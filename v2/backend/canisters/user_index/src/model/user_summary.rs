use candid::CandidType;
use crate::model::user::CreatedUser;
use shared::time::TimestampMillis;
use shared::types::UserId;

#[derive(CandidType)]
pub struct UserSummary {
    user_id: UserId,
    username: String,
    seconds_since_last_online: u32,
}

impl UserSummary {
    // You can pass in now = None if you know that the user is online now
    pub fn new(user: &CreatedUser, now: Option<TimestampMillis>) -> UserSummary {
        let mut seconds_since_last_online: u32 = 0;
        if let Some(t) = now {
            let millis_since_last_online = t - user.last_online;
            seconds_since_last_online = (millis_since_last_online / 1000) as u32;
        }

        UserSummary {
            user_id: user.user_id,
            username: user.username.clone(),
            seconds_since_last_online
        }
    }
}