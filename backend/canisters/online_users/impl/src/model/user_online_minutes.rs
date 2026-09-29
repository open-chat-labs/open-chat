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

    // Moves the user's minutes online in each month from their old id to their new one, adding them
    // to any recorded for their new id
    pub fn migrate_user_id(&mut self, old_user_id: UserId, new_user_id: UserId) {
        for month in self.months.values_mut() {
            if let Some(minutes) = month.users.remove(&old_user_id) {
                let entry = month.users.entry(new_user_id).or_default();
                *entry = entry.saturating_add(minutes);
            }
        }
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

#[cfg(test)]
mod tests {
    use super::*;
    use candid::Principal;

    fn user_id(i: u8) -> UserId {
        Principal::from_slice(&[i]).into()
    }

    #[test]
    fn migrate_user_id_moves_each_month_adding_to_the_new_id() {
        let month1 = MonthKey::new(2026, 8);
        let month2 = month1.next();
        let mut minutes = UserOnlineMinutes::default();
        minutes.incr(user_id(1), month1.start_timestamp());
        minutes.incr(user_id(1), month2.start_timestamp());
        minutes.incr(user_id(1), month2.start_timestamp());
        minutes.incr(user_id(2), month2.start_timestamp());
        minutes.incr(user_id(3), month2.start_timestamp());

        minutes.migrate_user_id(user_id(1), user_id(2));

        assert_eq!(minutes.get(user_id(1), month1), 0);
        assert_eq!(minutes.get(user_id(1), month2), 0);
        assert_eq!(minutes.get(user_id(2), month1), 1);
        assert_eq!(minutes.get(user_id(2), month2), 3);
        assert_eq!(minutes.get(user_id(3), month2), 1);
    }
}
