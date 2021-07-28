use crate::common::user::CreatedUser;
use candid::CandidType;
use serde::Deserialize;
use shared::time::TimestampMillis;
use shared::types::UserId;

#[derive(CandidType, Deserialize)]
pub struct UserSummary {
    user_id: UserId,
    username: String,
    seconds_since_last_online: u32,
}

impl UserSummary {
    pub fn new(user: &CreatedUser, now: TimestampMillis) -> UserSummary {
        let millis_since_last_online = now - user.last_online;
        let seconds_since_last_online = (millis_since_last_online / 1000) as u32;

        UserSummary {
            user_id: user.user_id,
            username: user.username.clone(),
            seconds_since_last_online,
        }
    }

    pub fn user_id(&self) -> UserId {
        self.user_id
    }

    pub fn username(&self) -> String {
        self.username.clone()
    }

    pub fn seconds_since_last_online(&self) -> u32 {
        self.seconds_since_last_online
    }
}

#[derive(CandidType, Deserialize)]
pub struct PartialUserSummary {
    user_id: UserId,
    username: Option<String>,
    seconds_since_last_online: u32,
}

impl PartialUserSummary {
    pub fn new(user: &CreatedUser, include_username: bool, now: TimestampMillis) -> PartialUserSummary {
        let millis_since_last_online = now - user.last_online;
        let seconds_since_last_online = (millis_since_last_online / 1000) as u32;

        PartialUserSummary {
            user_id: user.user_id,
            username: if include_username { Some(user.username.clone()) } else { None },
            seconds_since_last_online,
        }
    }

    pub fn user_id(&self) -> UserId {
        self.user_id
    }

    pub fn username(&self) -> Option<String> {
        self.username.as_ref().cloned()
    }

    pub fn seconds_since_last_online(&self) -> u32 {
        self.seconds_since_last_online
    }
}
