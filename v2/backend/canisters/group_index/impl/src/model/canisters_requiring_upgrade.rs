use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::collections::{HashSet, VecDeque};
use types::{ChatId, Version};

#[derive(CandidType, Serialize, Deserialize)]
pub struct FailedUpgrade {
    pub chat_id: ChatId,
    pub from_version: Version,
    pub to_version: Version,
}

#[derive(CandidType, Serialize, Deserialize, Default)]
pub struct CanistersRequiringUpgrade {
    pending: VecDeque<ChatId>,
    in_progress: HashSet<ChatId>,
    failed: VecDeque<FailedUpgrade>,
}

impl CanistersRequiringUpgrade {
    pub fn enqueue(&mut self, chat_id: ChatId) {
        self.pending.push_back(chat_id);
    }

    pub fn try_take_next(&mut self) -> Option<ChatId> {
        let chat_id = self.pending.pop_front()?;
        self.in_progress.insert(chat_id);
        Some(chat_id)
    }

    pub fn mark_success(&mut self, chat_id: &ChatId) {
        self.in_progress.remove(chat_id);
    }

    pub fn mark_failure(&mut self, failed_upgrade: FailedUpgrade) {
        self.in_progress.remove(&failed_upgrade.chat_id);
        self.failed.push_back(failed_upgrade);
    }

    pub fn metrics(&self) -> Metrics {
        Metrics {
            pending: self.pending.len(),
            in_progress: self.in_progress.len(),
            failed: self.failed.len(),
        }
    }
}

pub struct Metrics {
    pub pending: usize,
    pub in_progress: usize,
    pub failed: usize,
}
