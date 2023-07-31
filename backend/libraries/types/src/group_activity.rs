use crate::TimestampMillis;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Default)]
pub struct PublicCommunityActivity {
    pub timestamp: TimestampMillis,
    pub member_count: u32,
    pub channel_count: u32,
    pub last_hour: Activity,
    pub last_day: Activity,
}

#[derive(Serialize, Deserialize, Debug, Default)]
pub struct PublicGroupActivity {
    pub timestamp: TimestampMillis,
    pub member_count: u32,
    pub last_hour: Activity,
    pub last_day: Activity,
}

#[derive(Serialize, Deserialize, Debug, Default)]
pub struct Activity {
    pub messages: u32,
    pub message_unique_users: u32,
    pub reactions: u32,
    pub reaction_unique_users: u32,
}

impl PublicCommunityActivity {
    pub fn new(channel_count: u32, now: TimestampMillis) -> PublicCommunityActivity {
        PublicCommunityActivity {
            timestamp: now,
            member_count: 1,
            channel_count,
            ..Default::default()
        }
    }
}

impl PublicGroupActivity {
    pub fn new(now: TimestampMillis) -> PublicGroupActivity {
        PublicGroupActivity {
            timestamp: now,
            member_count: 1,
            ..Default::default()
        }
    }
}
