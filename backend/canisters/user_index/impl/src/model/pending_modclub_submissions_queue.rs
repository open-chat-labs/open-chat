use modclub_canister::submitHtmlContent::Level;
use serde::{Deserialize, Serialize};
use std::collections::VecDeque;

#[derive(Serialize, Deserialize, Default)]
pub struct PendingModclubSubmissionsQueue {
    pending_submissions: VecDeque<PendingModclubSubmission>,
}

impl PendingModclubSubmissionsQueue {
    pub fn push(&mut self, pending_payment: PendingModclubSubmission) {
        self.pending_submissions.push_back(pending_payment);
    }

    pub fn pop(&mut self) -> Option<PendingModclubSubmission> {
        self.pending_submissions.pop_front()
    }

    pub fn is_empty(&self) -> bool {
        self.pending_submissions.is_empty()
    }
}

#[derive(Serialize, Deserialize)]
pub struct PendingModclubSubmission {
    pub report_index: u64,
    pub html_report: String,
    pub level: Level,
}
