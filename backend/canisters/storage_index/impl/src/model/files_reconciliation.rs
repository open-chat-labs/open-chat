use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{FileRemoved, TimestampMillis};

// One-off: checks every file reference against the bucket holding the file, removing those whose
// file the bucket no longer holds. Until #9760 the index ignored the files the buckets reported
// removing in their responses to `c2c_sync_index`, and the uploads the buckets dropped part way
// through were never reported as removed at all, so those references were left behind, along with
// the bytes they counted towards their owners' allowances.
//
// It also removes the references to files the bucket holds with a different owner or created
// time. Until #9761 a forwarded file was reported to the index as the original file's, whereas
// the bucket reports it as the forwarder's once it's removed, so the reference would never go.
// Removing it charges no one: the forwarder was never charged for it, and the original owner is
// still charged through their own file for as long as they keep it.
// TODO remove once it has completed in prod
#[derive(Serialize, Deserialize, Default)]
pub struct FilesReconciliation {
    started: Option<TimestampMillis>,
    completed: Option<TimestampMillis>,
    // The last file reference checked, which the next page of references starts after
    last_checked: Option<FileRemoved>,
    checked: u64,
    // References removed because the bucket no longer holds the file
    missing: u64,
    // References removed because the bucket holds the file with a different owner or created time
    mismatched: u64,
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

    pub fn record_page(&mut self, last_checked: FileRemoved, page: PageResult) {
        self.last_checked = Some(last_checked);
        self.checked += page.checked;
        self.missing += page.missing;
        self.mismatched += page.mismatched;
        self.skipped += page.skipped;
    }

    pub fn complete(&mut self, now: TimestampMillis) {
        self.completed = Some(now);
    }

    pub fn metrics(&self) -> FilesReconciliationMetrics {
        FilesReconciliationMetrics {
            started: self.started,
            completed: self.completed,
            checked: self.checked,
            missing: self.missing,
            mismatched: self.mismatched,
            skipped: self.skipped,
        }
    }
}

#[derive(Default)]
pub struct PageResult {
    pub checked: u64,
    pub missing: u64,
    pub mismatched: u64,
    pub skipped: u64,
}

#[derive(CandidType, Serialize, Debug)]
pub struct FilesReconciliationMetrics {
    pub started: Option<TimestampMillis>,
    pub completed: Option<TimestampMillis>,
    pub checked: u64,
    pub missing: u64,
    pub mismatched: u64,
    pub skipped: u64,
}
