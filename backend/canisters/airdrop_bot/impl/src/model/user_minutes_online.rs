use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use types::UserId;
use utils::time::MonthKey;

#[derive(Serialize, Deserialize, Default)]
pub struct UserMinutesOnline {
    per_month: BTreeMap<MonthKey, BTreeMap<UserId, u16>>,
}

impl UserMinutesOnline {
    pub fn get(&self, user_id: &UserId, month_key: &MonthKey) -> u16 {
        self.per_month
            .get(month_key)
            .and_then(|m| m.get(user_id))
            .copied()
            .unwrap_or_default()
    }

    pub fn push(&mut self, user_id: UserId, month_key: MonthKey, minutes_online: u16) {
        self.per_month.entry(month_key).or_default().insert(user_id, minutes_online);
    }
}
