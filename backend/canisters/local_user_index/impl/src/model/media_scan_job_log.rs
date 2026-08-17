use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, VecDeque};
use tracing::warn;
use types::{CanisterId, MediaScanJob, MediaScanRequest};

// Caps so that a prolonged worker outage or a flood of media cannot grow the log unboundedly;
// the oldest entries are dropped first so the most recent media still gets scanned. The
// per-source cap stops a single busy chat evicting every other chat's jobs.
const TOTAL_CAP: usize = 20_000;
const PER_SOURCE_CAP: usize = 2_000;

// Media scan jobs awaiting the off-chain scanning worker. An append-only indexed log rather
// than a queue: the worker polls `media_scan_jobs` from its cursor and acks by watermark via
// `submit_media_scan_verdicts`, which prunes from the front. Jobs are keyed by a
// monotonically increasing index so re-delivery after a worker restart is at-least-once, and
// verdict application downstream is idempotent.
#[derive(Serialize, Deserialize, Default)]
pub struct MediaScanJobLog {
    jobs: VecDeque<MediaScanJob>,
    latest_job_index: u64,
    per_source: BTreeMap<CanisterId, usize>,
}

impl MediaScanJobLog {
    pub fn push(&mut self, source: CanisterId, is_group: bool, request: MediaScanRequest) -> u64 {
        self.latest_job_index += 1;
        self.jobs.push_back(MediaScanJob {
            job_index: self.latest_job_index,
            source,
            is_group,
            request,
        });
        *self.per_source.entry(source).or_default() += 1;

        if self.per_source.get(&source).copied().unwrap_or_default() > PER_SOURCE_CAP {
            self.drop_oldest_from_source(source);
        } else if self.jobs.len() > TOTAL_CAP {
            let largest = self
                .per_source
                .iter()
                .max_by_key(|(_, count)| **count)
                .map(|(id, _)| *id)
                .unwrap();
            self.drop_oldest_from_source(largest);
        }

        self.latest_job_index
    }

    // Indexes are monotonic but NOT dense: per-source eviction removes entries from the middle
    // of the log, so positions must be found by search rather than offset arithmetic
    pub fn iter(&self, from_job_index: u64) -> impl Iterator<Item = &MediaScanJob> {
        let start = self.jobs.partition_point(|j| j.job_index < from_job_index);
        self.jobs.range(start..)
    }

    pub fn get(&self, job_index: u64) -> Option<&MediaScanJob> {
        let position = self.jobs.partition_point(|j| j.job_index < job_index);
        self.jobs.get(position).filter(|j| j.job_index == job_index)
    }

    pub fn prune(&mut self, up_to_job_index: u64) -> u32 {
        let mut removed = 0;
        while self.jobs.front().is_some_and(|j| j.job_index <= up_to_job_index) {
            let job = self.jobs.pop_front().unwrap();
            self.decrement_source(job.source);
            removed += 1;
        }
        removed
    }

    pub fn latest_job_index(&self) -> u64 {
        self.latest_job_index
    }

    pub fn len(&self) -> usize {
        self.jobs.len()
    }

    fn drop_oldest_from_source(&mut self, source: CanisterId) {
        if let Some(position) = self.jobs.iter().position(|j| j.source == source) {
            self.jobs.remove(position);
            self.decrement_source(source);
            warn!(%source, "Media scan job log full, dropping oldest entry");
        }
    }

    fn decrement_source(&mut self, source: CanisterId) {
        if let Some(count) = self.per_source.get_mut(&source) {
            *count = count.saturating_sub(1);
            if *count == 0 {
                self.per_source.remove(&source);
            }
        }
    }
}
