use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet};
use types::{Achievement, UserId};

#[derive(Serialize, Deserialize, Default)]
pub struct Achievements {
    achievements: BTreeMap<UserId, BTreeSet<Achievement>>,
}

impl Achievements {
    pub fn award(&mut self, user_id: UserId, achievement: Achievement) -> Option<Achievement> {
        self.achievements
            .entry(user_id)
            .or_default()
            .insert(achievement)
            .then_some(achievement)
    }

    pub fn remove_user(&mut self, user_id: &UserId) {
        self.achievements.remove(user_id);
    }
}
