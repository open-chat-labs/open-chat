use crate::TimestampMillis;
use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Debug, Default)]
pub struct PublicGroupActivity {
    pub timestamp: TimestampMillis,
    pub last_hour: Activity,
    pub last_day: Activity,
}

#[derive(CandidType, Serialize, Deserialize, Debug, Default)]
pub struct Activity {
    pub user_count_change: i32,
    pub messages: u32,
    pub message_unique_users: u32,
    pub reactions: u32,
    pub reaction_unique_users: u32,
}
