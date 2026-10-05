use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use types::{CanisterId, FileId, TimestampMillis};

// One-off: adds a reference for each file a bucket holds which the index has no reference for,
// charging its owner as if they had uploaded it. Until #9761 a forwarded file was reported to the
// index as the original file's, and `FilesReconciliation` removed those references, so no one was
// charged for the forwarded copies, and once the original owner deleted their own file no one was
// paying for the bytes at all.
//
// Once every bucket has been paged through, each owner whose charges took them over their limit
// has their oldest files removed, as an upload over the limit would. Only up to the bytes they were
// charged are removed, so an owner who was already over their limit (eg. whose Diamond membership
// lapsed) loses no more than the backfill added.
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

    // Up to `max_count` of the owners charged, along with what they were charged, which are then no
    // longer held
    pub fn take_charged(&mut self, max_count: usize) -> Vec<(Principal, u64)> {
        (0..max_count).map_while(|_| self.charged.pop_first()).collect()
    }

    pub fn record_files_removed(&mut self, count: u64, bytes: u64) {
        self.owners_over_limit += 1;
        self.files_removed += count;
        self.bytes_removed += bytes;
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
    pub files_removed: u64,
    pub bytes_removed: u64,
    pub buckets_skipped: Vec<CanisterId>,
}
