use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use types::{CanisterId, FileId, TimestampMillis};

// One-off: adds a reference for each file a bucket holds which the index has no reference for,
// charging its owner as if they had uploaded it. Until #9761 a forwarded file was reported to the
// index as the original file's, and the one-off files reconciliation (#9765) removed those
// references, so no one was charged for the forwarded copies, and once the original owner deleted
// their own file no one was paying for the bytes at all.
//
// Once every bucket has been paged through, each owner over their limit has their oldest files
// removed, as an upload over the limit would. No more is freed than they were charged, so an owner
// who was already over their limit (eg. whose Diamond membership lapsed) loses no more than the
// backfill added, and may be left over it.
// TODO remove once it has completed in prod
#[derive(Serialize, Deserialize, Default)]
pub struct FilesBackfill {
    started: Option<TimestampMillis>,
    completed: Option<TimestampMillis>,
    stage: Stage,
    // The bytes charged to each owner, until they've been checked against their limit
    charged: BTreeMap<Principal, u64>,
    checked: u64,
    added: u64,
    // Files whose owner the index has no record of, which are left without a reference
    unknown_owner: u64,
    owners_charged: u64,
    bytes_charged: u64,
    owners_over_limit: u64,
    // Owners over their limit holding too many files to check in one go, who are left to be
    // brought under it by their next upload
    owners_with_too_many_files: u64,
    files_removed: u64,
    bytes_removed: u64,
    // Buckets whose files couldn't all be paged through
    buckets_skipped: Vec<CanisterId>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Copy, Debug)]
pub enum Stage {
    // Paging through each bucket's files in turn, in order of canister id, from just after `after`.
    // A `bucket` of `None` is before the first bucket.
    AddingReferences {
        bucket: Option<CanisterId>,
        after: Option<FileId>,
    },
    // Every bucket has been paged through, so the owners charged are checked against their limits
    RemovingFiles,
}

impl Default for Stage {
    fn default() -> Self {
        Stage::AddingReferences {
            bucket: None,
            after: None,
        }
    }
}

// The outcome of checking an owner the backfill charged against their limit
pub enum LimitCheck {
    NotOverLimit,
    TooManyFiles,
    FilesRemoved { files: u64, bytes: u64 },
}

// The outcome of backfilling a reference to a file a bucket holds
pub enum BackfilledReference {
    AlreadyReferenced,
    UnknownOwner,
    Added { charged: u64 },
}

impl FilesBackfill {
    pub fn start(&mut self, now: TimestampMillis) {
        if self.started.is_none() {
            self.started = Some(now);
        }
    }

    pub fn in_progress(&self) -> bool {
        self.started.is_some() && self.completed.is_none()
    }

    pub fn stage(&self) -> Stage {
        self.stage
    }

    pub fn set_stage(&mut self, stage: Stage) {
        self.stage = stage;
    }

    pub fn record(&mut self, owner: Principal, reference: BackfilledReference) {
        self.checked += 1;
        match reference {
            BackfilledReference::AlreadyReferenced => {}
            BackfilledReference::UnknownOwner => self.unknown_owner += 1,
            BackfilledReference::Added { charged } => {
                self.added += 1;
                if charged > 0 {
                    let total = self.charged.entry(owner).or_default();
                    if *total == 0 {
                        self.owners_charged += 1;
                    }
                    *total += charged;
                    self.bytes_charged += charged;
                }
            }
        }
    }

    pub fn skip_bucket(&mut self, bucket: CanisterId) {
        self.buckets_skipped.push(bucket);
    }

    // The next owner charged, along with what they were charged, which is then no longer held
    pub fn pop_charged(&mut self) -> Option<(Principal, u64)> {
        self.charged.pop_first()
    }

    pub fn record_limit_check(&mut self, check: LimitCheck) {
        match check {
            LimitCheck::NotOverLimit => {}
            LimitCheck::TooManyFiles => {
                self.owners_over_limit += 1;
                self.owners_with_too_many_files += 1;
            }
            LimitCheck::FilesRemoved { files, bytes } => {
                self.owners_over_limit += 1;
                self.files_removed += files;
                self.bytes_removed += bytes;
            }
        }
    }

    pub fn complete(&mut self, now: TimestampMillis) {
        self.completed = Some(now);
    }

    pub fn is_complete_after_removing_files(&self) -> bool {
        matches!(self.stage, Stage::RemovingFiles) && self.charged.is_empty()
    }

    pub fn metrics(&self) -> FilesBackfillMetrics {
        FilesBackfillMetrics {
            started: self.started,
            completed: self.completed,
            stage: self.stage,
            checked: self.checked,
            added: self.added,
            unknown_owner: self.unknown_owner,
            owners_charged: self.owners_charged,
            bytes_charged: self.bytes_charged,
            owners_over_limit: self.owners_over_limit,
            owners_with_too_many_files: self.owners_with_too_many_files,
            files_removed: self.files_removed,
            bytes_removed: self.bytes_removed,
            buckets_skipped: self.buckets_skipped.clone(),
        }
    }
}

#[derive(CandidType, Serialize, Debug)]
pub struct FilesBackfillMetrics {
    pub started: Option<TimestampMillis>,
    pub completed: Option<TimestampMillis>,
    pub stage: Stage,
    pub checked: u64,
    pub added: u64,
    pub unknown_owner: u64,
    pub owners_charged: u64,
    pub bytes_charged: u64,
    pub owners_over_limit: u64,
    pub owners_with_too_many_files: u64,
    pub files_removed: u64,
    pub bytes_removed: u64,
    pub buckets_skipped: Vec<CanisterId>,
}
