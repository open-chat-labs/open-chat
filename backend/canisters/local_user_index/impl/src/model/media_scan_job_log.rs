use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, VecDeque};
use tracing::warn;
use types::{CanisterId, MediaScanJob, MediaScanRequest, Milliseconds, TimestampMillis};

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
    // When the current front entry became the front (approximate: mid-log eviction can leave
    // this older than the true front, which only overestimates the age - the safe direction
    // for stall detection). With `last_verdict_at`, the stall signal: a front entry older
    // than the threshold with no recent verdicts means nothing is consuming the log
    #[serde(default)]
    front_since: TimestampMillis,
    #[serde(default)]
    last_verdict_at: TimestampMillis,
    #[serde(default)]
    dropped: u64,
    #[serde(default)]
    stall_alerted_at: Option<TimestampMillis>,
}

pub struct MediaScanStallInfo {
    pub jobs_pending: u32,
    pub oldest_job_age: Milliseconds,
    pub latest_job_index: u64,
}

impl MediaScanJobLog {
    pub fn push(&mut self, source: CanisterId, is_group: bool, request: MediaScanRequest, now: TimestampMillis) -> u64 {
        if self.jobs.is_empty() {
            self.front_since = now;
        }
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

    pub fn prune(&mut self, up_to_job_index: u64, now: TimestampMillis) -> u32 {
        let mut removed = 0;
        while self.jobs.front().is_some_and(|j| j.job_index <= up_to_job_index) {
            let job = self.jobs.pop_front().unwrap();
            self.decrement_source(job.source);
            removed += 1;
        }
        if removed > 0 {
            self.front_since = now;
        }
        removed
    }

    // Any verdict submission proves the worker end-to-end path is alive. Returns true when
    // this ends a previously alerted stall, so the caller can raise the all-clear.
    pub fn record_verdict_activity(&mut self, now: TimestampMillis) -> bool {
        self.last_verdict_at = now;
        self.stall_alerted_at.take().is_some()
    }

    // Returns stall details when jobs are waiting but nothing is consuming them, and marks
    // the stall alerted so it fires once per episode (re-arming after `realert_after`)
    pub fn check_stalled(
        &mut self,
        threshold: Milliseconds,
        realert_after: Milliseconds,
        now: TimestampMillis,
    ) -> Option<MediaScanStallInfo> {
        if !self.jobs.is_empty()
            && now.saturating_sub(self.front_since) > threshold
            && now.saturating_sub(self.last_verdict_at) > threshold
            && self.stall_alerted_at.is_none_or(|at| now.saturating_sub(at) > realert_after)
        {
            self.stall_alerted_at = Some(now);
            Some(MediaScanStallInfo {
                jobs_pending: self.jobs.len() as u32,
                oldest_job_age: now.saturating_sub(self.front_since),
                latest_job_index: self.latest_job_index,
            })
        } else {
            None
        }
    }

    pub fn last_verdict_at(&self) -> TimestampMillis {
        self.last_verdict_at
    }

    pub fn dropped(&self) -> u64 {
        self.dropped
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
            self.dropped += 1;
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
