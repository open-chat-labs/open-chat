use std::collections::HashSet;

use serde::{Deserialize, Serialize};
use types::{CanisterId, Document, TimestampMillis, UserId};
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
    pub awarded: HashSet<UserId>,
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
            awarded: HashSet::new(),
        });

        true
    }

    pub fn iter(&self) -> impl Iterator<Item = &ExternalAchievementInternal> {
        self.achievements.iter()
    }

    pub fn award(&mut self, user_id: UserId, name: &str, caller: CanisterId, now: TimestampMillis) -> AwardResult {
        let Some(achievement) = self.achievements.iter_mut().find(|a| a.name == name) else {
            return AwardResult::NotFound;
        };

        if achievement.canister_id != caller {
            return AwardResult::InvalidCaller;
        }

        if achievement.expires >= now {
            return AwardResult::Expired;
        }

        if achievement.remaining_chit_budget < achievement.chit_reward {
            return AwardResult::InsufficientBudget;
        }

        if !achievement.awarded.insert(user_id) {
            return AwardResult::AlreadyAwarded;
        }

        achievement.remaining_chit_budget -= achievement.chit_reward;

        if achievement.remaining_chit_budget < achievement.chit_reward {
            achievement.budget_exhausted = Some(now);
            achievement.awarded = HashSet::new();
        }

        AwardResult::Success(AwardSuccessResult {
            chit_reward: achievement.chit_reward,
            remaining_chit_budget: achievement.remaining_chit_budget,
        })
    }
}

pub enum AwardResult {
    Success(AwardSuccessResult),
    NotFound,
    AlreadyAwarded,
    InsufficientBudget,
    InvalidCaller,
    Expired,
}

pub struct AwardSuccessResult {
    pub chit_reward: u32,
    pub remaining_chit_budget: u32,
}