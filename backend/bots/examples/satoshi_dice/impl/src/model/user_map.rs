use crate::MAX_ROLLS_PER_HOUR;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use types::{Milliseconds, TimestampMillis, UserId};
use utils::time::HOUR_IN_MS;

#[derive(Serialize, Deserialize, Default)]
pub struct UserMap {
    users: HashMap<UserId, UserData>,
}

#[derive(Serialize, Deserialize)]
pub struct DiceRoll {
    pub timestamp: TimestampMillis,
    pub roll: u8,
    pub amount_in: u64,
    pub amount_out: u64,
}

#[derive(Serialize, Deserialize)]
struct UserData {
    added: TimestampMillis,
    rolls: Vec<DiceRoll>,
}

impl UserMap {
    pub fn add_user(&mut self, user_id: UserId, now: TimestampMillis) {
        self.users.entry(user_id).or_insert(UserData {
            added: now,
            rolls: Vec::new(),
        });
    }

    pub fn time_until_next_roll_permitted(&self, user_id: &UserId, now: TimestampMillis) -> Option<Milliseconds> {
        let user = self.users.get(user_id)?;
        if user.rolls.len() < MAX_ROLLS_PER_HOUR {
            Some(0)
        } else {
            Some((user.rolls[user.rolls.len() - MAX_ROLLS_PER_HOUR].timestamp + HOUR_IN_MS).saturating_sub(now))
        }
    }

    pub fn add_roll(&mut self, user_id: &UserId, roll: DiceRoll) -> bool {
        if let Some(user) = self.users.get_mut(user_id) {
            user.rolls.push(roll);
            true
        } else {
            false
        }
    }

    pub fn len(&self) -> usize {
        self.users.len()
    }
}
