use modclub_canister::submitHtmlContent::Level;
use serde::{Deserialize, Serialize};
use std::collections::VecDeque;

#[derive(Serialize, Deserialize, Default)]
pub struct PendingModclubSubmissionsQueue {
    pending_submissions: VecDeque<PendingModclubSubmission>,
}

impl PendingModclubSubmissionsQueue {
    pub fn push(&mut self, pending_submission: PendingModclubSubmission) {
        self.pending_submissions.push_back(pending_submission);
    }

    pub fn pop(&mut self) -> Option<PendingModclubSubmission> {
        self.pending_submissions.pop_front()
    }

    pub fn is_empty(&self) -> bool {
        self.pending_submissions.is_empty()
    }

    pub fn len(&self) -> usize {
        self.pending_submissions.len()
    }
}

#[derive(Serialize, Deserialize)]
pub struct PendingModclubSubmission {
    pub report_index: u64,
    pub title: String,
    pub html_report: String,
    pub level: Level,
}
