use crate::memory::get_last_online_dates_memory;
use candid::Principal;
use ic_stable_structures::StableBTreeMap;
use serde::{Deserialize, Serialize};
use stable_memory::Memory;
use types::{TimestampMillis, UserId};

#[derive(Serialize, Deserialize)]
pub struct LastOnlineDates {
    #[serde(skip, default = "init_map")]
    map: StableBTreeMap<Principal, TimestampMillis, Memory>,
}

impl LastOnlineDates {
    pub fn mark_online(&mut self, user_id: UserId, now: TimestampMillis) {
        self.map.insert(user_id.into(), now);
    }

    pub fn get(&self, user_id: UserId) -> Option<TimestampMillis> {
        self.map.get(&user_id.into())
    }

    pub fn iter(&self) -> impl Iterator<Item = (Principal, TimestampMillis)> + '_ {
        self.map.iter()
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
