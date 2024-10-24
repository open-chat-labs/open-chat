use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use types::{CanisterId, TimestampMillis, UserId};
use user_index_canister::ExternalAchievementInitial;

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct ExternalAchievements {
    achievements: HashMap<u32, ExternalAchievementInternal>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ExternalAchievementInternal {
    pub name: String,
    pub logo: String,
    pub url: String,
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
    // This will either a register a new external achievement or update an existing entry with the same id
    pub fn register(&mut self, achievement: ExternalAchievementInitial, now: TimestampMillis) -> bool {
        if self
            .achievements
            .iter()
            .any(|(id, a)| a.name == achievement.name && *id != achievement.id)
        {
            return false;
        }

        self.achievements.insert(
            achievement.id,
            ExternalAchievementInternal {
                name: achievement.name,
                logo: achievement.logo,
                url: achievement.url,
                canister_id: achievement.canister_id,
                chit_reward: achievement.chit_reward,
                registered: now,
                expires: achievement.expires,
                initial_chit_budget: achievement.chit_budget,
                remaining_chit_budget: achievement.chit_budget,
                budget_exhausted: None,
                awarded: HashSet::new(),
            },
        );

        // TODO: Create a timer to delete the awarded users HashSet once the achievement has expired

        true
    }

    pub fn award(
        &mut self,
        id: u32,
        user_id: UserId,
        caller: CanisterId,
        now: TimestampMillis,
        test_mode: bool,
    ) -> AwardResult {
        let Some(achievement) = self.achievements.get_mut(&id) else {
            return AwardResult::NotFound;
        };

        if !test_mode && achievement.canister_id != caller {
            return AwardResult::InvalidCaller;
        }

        if achievement.expires <= now {
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
        }

        AwardResult::Success(AwardSuccessResult {
            name: achievement.name.clone(),
            chit_reward: achievement.chit_reward,
            remaining_chit_budget: achievement.remaining_chit_budget,
        })
    }

    pub fn get(&self, id: u32) -> Option<&ExternalAchievementInternal> {
        self.achievements.get(&id)
    }

    pub fn iter(&self) -> impl Iterator<Item = (&u32, &ExternalAchievementInternal)> {
        self.achievements.iter()
    }

    pub fn metrics(&self) -> Vec<ExternalAchievementMetrics> {
        self.achievements
            .iter()
            .map(|(id, a)| ExternalAchievementMetrics {
                id: *id,
                name: a.name.clone(),
                logo_len: a.logo.len(),
                url: a.url.clone(),
                canister_id: a.canister_id,
                chit_reward: a.chit_reward,
                registered: a.registered,
                expires: a.expires,
                initial_chit_budget: a.initial_chit_budget,
                remaining_chit_budget: a.remaining_chit_budget,
                budget_exhausted: a.budget_exhausted,
                awarded: a.awarded.len(),
            })
            .collect()
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
    pub name: String,
    pub chit_reward: u32,
    pub remaining_chit_budget: u32,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ExternalAchievementMetrics {
    pub id: u32,
    pub name: String,
    pub logo_len: usize,
    pub url: String,
    pub canister_id: CanisterId,
    pub chit_reward: u32,
    pub registered: TimestampMillis,
    pub expires: TimestampMillis,
    pub initial_chit_budget: u32,
    pub remaining_chit_budget: u32,
    pub budget_exhausted: Option<TimestampMillis>,
    pub awarded: usize,
}
