use fire_and_forget_handler::FireAndForgetHandler;
use msgpack::serialize_then_unwrap;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use types::{Achievement, UserId};
use user_canister::c2c_notify_achievement;

#[derive(Serialize, Deserialize, Default)]
pub struct Achievements {
    achievements: HashMap<UserId, HashSet<Achievement>>,
}

impl Achievements {
    pub fn notify_user(
        &mut self,
        user_id: UserId,
        achievements: Vec<Achievement>,
        fire_and_forget_handler: &mut FireAndForgetHandler,
    ) {
        if achievements.is_empty() {
            return;
        }

        let existing = self.achievements.entry(user_id).or_default();

        let achievements: Vec<_> = achievements.into_iter().filter(|a| existing.insert(a.clone())).collect();

        if achievements.is_empty() {
            return;
        }

        let args = c2c_notify_achievement::Args { achievements };

        fire_and_forget_handler.send(
            user_id.into(),
            "c2c_notify_achievement_msgpack".to_string(),
            serialize_then_unwrap(args),
        );
    }
}
