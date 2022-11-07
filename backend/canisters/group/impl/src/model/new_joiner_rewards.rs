use ic_ledger_types::BlockIndex;
use itertools::Itertools;
use serde::{Deserialize, Serialize};
use std::collections::hash_map::Entry::{Occupied, Vacant};
use std::collections::HashMap;
use types::{TimestampMillis, UserId, ICP};

#[derive(Serialize, Deserialize)]
pub struct NewJoinerRewards {
    count_remaining: usize,
    reward_amount: ICP,
    start: Option<TimestampMillis>,
    end: Option<TimestampMillis>,
    rewards: HashMap<UserId, NewJoinerReward>,
}

impl NewJoinerRewards {
    #[allow(dead_code)]
    pub fn new(
        count: usize,
        reward_amount: ICP,
        start: Option<TimestampMillis>,
        end: Option<TimestampMillis>,
    ) -> NewJoinerRewards {
        NewJoinerRewards {
            count_remaining: count,
            reward_amount,
            start,
            end,
            rewards: HashMap::new(),
        }
    }

    pub fn try_claim_user_reward(
        &mut self,
        user_id: UserId,
        now: TimestampMillis,
    ) -> Result<ICP, ClaimNewJoinerRewardFailureReason> {
        if let Some(start) = self.start {
            if now < start {
                return Err(ClaimNewJoinerRewardFailureReason::NotYetStarted(start));
            }
        }
        if let Some(end) = self.end {
            if now > end {
                return Err(ClaimNewJoinerRewardFailureReason::Ended(end));
            }
        }
        if self.count_remaining > 0 {
            match self.rewards.entry(user_id) {
                Vacant(e) => {
                    e.insert(NewJoinerReward {
                        user_id,
                        timestamp: now,
                        amount: self.reward_amount,
                        status: NewJoinerRewardStatus::Pending,
                    });
                }
                Occupied(e) if matches!(e.get().status, NewJoinerRewardStatus::Failed(_)) => {
                    *e.into_mut() = NewJoinerReward {
                        user_id,
                        timestamp: now,
                        amount: self.reward_amount,
                        status: NewJoinerRewardStatus::Pending,
                    };
                }
                _ => return Err(ClaimNewJoinerRewardFailureReason::AlreadyClaimed),
            }
            self.count_remaining = self.count_remaining.saturating_sub(1);
            Ok(self.reward_amount)
        } else {
            Err(ClaimNewJoinerRewardFailureReason::NoneRemaining)
        }
    }

    pub fn update_status(&mut self, user_id: &UserId, status: NewJoinerRewardStatus) {
        if let Some(reward) = self.rewards.get_mut(user_id) {
            reward.status = status;
        }
    }

    pub fn metrics(&self) -> NewJoinerRewardMetrics {
        self.into()
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct NewJoinerReward {
    user_id: UserId,
    timestamp: TimestampMillis,
    amount: ICP,
    status: NewJoinerRewardStatus,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub enum NewJoinerRewardStatus {
    Pending,
    Completed(BlockIndex),
    Failed(String),
}

pub enum ClaimNewJoinerRewardFailureReason {
    NotYetStarted(TimestampMillis),
    Ended(TimestampMillis),
    NoneRemaining,
    AlreadyClaimed,
}

#[derive(Serialize, Debug)]
pub struct NewJoinerRewardMetrics {
    count_remaining: usize,
    reward_amount: ICP,
    start: Option<TimestampMillis>,
    end: Option<TimestampMillis>,
    rewards: Vec<NewJoinerReward>,
}

impl From<&NewJoinerRewards> for NewJoinerRewardMetrics {
    fn from(rewards: &NewJoinerRewards) -> Self {
        NewJoinerRewardMetrics {
            count_remaining: rewards.count_remaining,
            reward_amount: rewards.reward_amount,
            start: rewards.start,
            end: rewards.end,
            rewards: rewards
                .rewards
                .values()
                .cloned()
                .sorted_unstable_by_key(|r| r.timestamp)
                .collect(),
        }
    }
}
