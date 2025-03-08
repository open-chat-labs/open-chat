use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use types::{TimestampMillis, UserId};
use utils::time::MonthKey;

#[derive(Serialize, Deserialize, Default)]
pub struct UserOnlineMinutes {
    months: BTreeMap<MonthKey, OnlineMinutesForMonth>,
}

impl UserOnlineMinutes {
    pub fn incr(&mut self, user_id: UserId, now: TimestampMillis) {
        let month_key = MonthKey::from_timestamp(now);
        *self.months.entry(month_key).or_default().users.entry(user_id).or_default() += 1;
    }

    pub fn get(&self, user_id: UserId, month_key: MonthKey) -> u32 {
        self.months
            .get(&month_key)
            .and_then(|m| m.users.get(&user_id).copied())
            .unwrap_or_default()
    }
}

#[derive(Serialize, Deserialize, Default)]
struct OnlineMinutesForMonth {
    users: BTreeMap<UserId, u32>,
}
