use serde::{Deserialize, Serialize};
use types::{CanisterId, Document, TimestampMillis};
use user_index_canister::ExternalAchievementInitial;

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct ExternalAchievements {
    achievements: Vec<ExternalAchievementInternal>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ExternalAchievementInternal {
    pub name: String,
    pub logo: Document,
    pub canister_id: CanisterId,
    pub chit_reward: u32,
    pub registered: TimestampMillis,
    pub expires: TimestampMillis,
    pub initial_chit_budget: u32,
    pub remaining_chit_budget: u32,
    pub budget_exhausted: Option<TimestampMillis>,
}

impl ExternalAchievements {
    #[allow(dead_code)]
    pub fn register(&mut self, achievement: ExternalAchievementInitial, now: TimestampMillis) -> bool {
        if self.achievements.iter().any(|a| a.name == achievement.name) {
            return false;
        }

        self.achievements.push(ExternalAchievementInternal {
            name: achievement.name,
            logo: achievement.logo,
            canister_id: achievement.canister_id,
            chit_reward: achievement.chit_reward,
            registered: now,
            expires: achievement.expires,
            initial_chit_budget: achievement.chit_budget,
            remaining_chit_budget: achievement.chit_budget,
            budget_exhausted: None,
        });

        true
    }

    pub fn get(&self, name: &str) -> Option<&ExternalAchievementInternal> {
        self.achievements.iter().find(|a| a.name == name)
    }

    pub fn iter(&self) -> impl Iterator<Item = &ExternalAchievementInternal> {
        self.achievements.iter()
    }

    pub fn award(&mut self, name: &str, now: TimestampMillis) -> bool {
        if let Some(achievement) = self.achievements.iter_mut().find(|a| a.name == name) {
            achievement.remaining_chit_budget = achievement.remaining_chit_budget.saturating_sub(achievement.chit_reward);
            if achievement.remaining_chit_budget < achievement.chit_reward {
                achievement.budget_exhausted = Some(now);
            }
            true
        } else {
            false
        }
    }
}
