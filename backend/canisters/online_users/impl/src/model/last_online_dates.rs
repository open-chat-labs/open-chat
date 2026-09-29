use crate::memory::{Memory, get_last_online_dates_memory};
use candid::Principal;
use ic_stable_structures::StableBTreeMap;
use serde::{Deserialize, Serialize};
use types::{TimestampMillis, UserId};

#[derive(Serialize, Deserialize)]
pub struct LastOnlineDates {
    #[serde(skip, default = "init_map")]
    map: StableBTreeMap<Principal, TimestampMillis, Memory>,
}

impl LastOnlineDates {
    pub fn mark_online(&mut self, user_id: UserId, now: TimestampMillis) -> Option<TimestampMillis> {
        self.map.insert(user_id.as_principal(), now)
    }

    pub fn get(&self, user_id: UserId) -> Option<TimestampMillis> {
        self.map.get(&user_id.as_principal())
    }

    pub fn remove(&mut self, user_id: UserId) -> Option<TimestampMillis> {
        self.map.remove(&user_id.as_principal())
    }

    // Moves the user's last online date from their old id to their new one, keeping whichever is
    // later if there is one for both
    pub fn migrate_user_id(&mut self, old_user_id: UserId, new_user_id: UserId) {
        if let Some(last_online) = self.map.remove(&old_user_id.as_principal())
            && self.get(new_user_id).is_none_or(|ts| ts < last_online)
        {
            self.map.insert(new_user_id.as_principal(), last_online);
        }
    }

    pub fn count_online_since(&self, since: TimestampMillis) -> u32 {
        self.map.values().filter(|last_online| *last_online >= since).count() as u32
    }

    pub fn iter(&self) -> impl Iterator<Item = (Principal, TimestampMillis)> + '_ {
        self.map.iter().map(|e| e.into_pair())
    }
}

fn init_map() -> StableBTreeMap<Principal, TimestampMillis, Memory> {
    let memory = get_last_online_dates_memory();

    StableBTreeMap::init(memory)
}

impl Default for LastOnlineDates {
    fn default() -> Self {
        LastOnlineDates { map: init_map() }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn user_id(i: u8) -> UserId {
        Principal::from_slice(&[i]).into()
    }

    #[test]
    fn migrate_user_id_keeps_the_later_date() {
        let mut dates = LastOnlineDates::default();
        dates.mark_online(user_id(1), 20);
        dates.mark_online(user_id(2), 10);
        dates.mark_online(user_id(3), 10);
        dates.mark_online(user_id(4), 20);

        dates.migrate_user_id(user_id(1), user_id(2));
        dates.migrate_user_id(user_id(3), user_id(4));
        dates.migrate_user_id(user_id(5), user_id(6));

        assert_eq!(dates.get(user_id(1)), None);
        assert_eq!(dates.get(user_id(2)), Some(20));
        assert_eq!(dates.get(user_id(3)), None);
        assert_eq!(dates.get(user_id(4)), Some(20));
        assert_eq!(dates.get(user_id(6)), None);
    }
}
