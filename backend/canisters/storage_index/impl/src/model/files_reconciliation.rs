use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{FileRemoved, TimestampMillis};

// One-off: checks every file reference against the bucket holding the file, removing those whose
// file the bucket no longer holds. Until #9760 the index ignored the files the buckets reported
// removing in their responses to `c2c_sync_index`, and the uploads the buckets dropped part way
// through were never reported as removed at all, so those references were left behind, along with
// the bytes they counted towards their owners' allowances.
// TODO remove once it has completed in prod
#[derive(Serialize, Deserialize, Default)]
pub struct FilesReconciliation {
    started: Option<TimestampMillis>,
    completed: Option<TimestampMillis>,
    // The last file reference checked, which the next page of references starts after
    last_checked: Option<FileRemoved>,
    checked: u64,
    removed: u64,
    // References left unchecked because their bucket couldn't be asked about them
    skipped: u64,
}

impl FilesReconciliation {
    pub fn start(&mut self, now: TimestampMillis) {
        if self.started.is_none() {
            self.started = Some(now);
        }
    }

    pub fn in_progress(&self) -> bool {
        self.started.is_some() && self.completed.is_none()
    }

    pub fn last_checked(&self) -> Option<&FileRemoved> {
        self.last_checked.as_ref()
    }

    pub fn record_page(&mut self, last_checked: FileRemoved, checked: u64, removed: u64, skipped: u64) {
        self.last_checked = Some(last_checked);
        self.checked += checked;
        self.removed += removed;
        self.skipped += skipped;
    }

    pub fn complete(&mut self, now: TimestampMillis) {
        self.completed = Some(now);
    }

    pub fn metrics(&self) -> FilesReconciliationMetrics {
        FilesReconciliationMetrics {
            started: self.started,
            completed: self.completed,
            checked: self.checked,
            removed: self.removed,
            skipped: self.skipped,
        }
    }
}

#[derive(CandidType, Serialize, Debug)]
pub struct FilesReconciliationMetrics {
    pub started: Option<TimestampMillis>,
    pub completed: Option<TimestampMillis>,
    pub checked: u64,
    pub removed: u64,
    pub skipped: u64,
}
