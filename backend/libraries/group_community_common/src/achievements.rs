use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use types::{Achievement, UserId};

#[derive(Serialize, Deserialize, Default)]
pub struct Achievements {
    achievements: HashMap<UserId, HashSet<Achievement>>,
}

impl Achievements {
    pub fn award(&mut self, user_id: UserId, achievement: Achievement) -> Option<Achievement> {
        self.achievements
            .entry(user_id)
            .or_default()
            .insert(achievement)
            .then_some(achievement)
    }
}
