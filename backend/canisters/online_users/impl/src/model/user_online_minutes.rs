use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use types::{TimestampMillis, UserId};
use utils::time::MonthKey;

#[derive(Serialize, Deserialize, Default)]
pub struct UserOnlineMinutes {
    months: BTreeMap<MonthKey, OnlineMinutesForMonth>,
}

impl UserOnlineMinutes {
    pub fn incr(&mut self, user_id: UserId, now: TimestampMillis) -> u16 {
        let month_key = MonthKey::from_timestamp(now);
        let entry = self.months.entry(month_key).or_default().users.entry(user_id).or_default();
        let new_count = entry.saturating_add(1);
        *entry = new_count;
        new_count
    }

    pub fn get(&self, user_id: UserId, month_key: MonthKey) -> u16 {
        self.months
            .get(&month_key)
            .and_then(|m| m.users.get(&user_id).copied())
            .unwrap_or_default()
    }

    pub fn get_all_filtered(&self, month_key: MonthKey, min_mins: u16) -> Vec<(UserId, u16)> {
        self.months
            .get(&month_key)
            .iter()
            .flat_map(|m| &m.users)
            .filter(|(_, m)| **m >= min_mins)
            .map(|(u, m)| (*u, *m))
            .collect()
    }
}

#[derive(Serialize, Deserialize, Default)]
struct OnlineMinutesForMonth {
    users: BTreeMap<UserId, u16>,
}
