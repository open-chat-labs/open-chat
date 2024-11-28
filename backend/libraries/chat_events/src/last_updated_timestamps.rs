use constants::calculate_summary_updates_data_removal_cutoff;
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet};
use types::{EventIndex, MessageIndex, TimestampMillis};

#[derive(Serialize, Deserialize, Default)]
#[serde(from = "LastUpdatedTimestampsTrimmed")]
pub struct LastUpdatedTimestamps {
    by_timestamp: BTreeSet<(TimestampMillis, Option<MessageIndex>, EventIndex)>,
    #[serde(skip)]
    by_event_index: BTreeMap<(Option<MessageIndex>, EventIndex), TimestampMillis>,
    latest_update_removed: TimestampMillis,
}

impl LastUpdatedTimestamps {
    pub fn mark_updated(
        &mut self,
        thread_root_message_index: Option<MessageIndex>,
        event_index: EventIndex,
        now: TimestampMillis,
    ) {
        self.prune(now);

        if let Some(previous) = self.by_event_index.insert((thread_root_message_index, event_index), now) {
            self.by_timestamp.remove(&(previous, thread_root_message_index, event_index));
        }
        self.by_timestamp.insert((now, thread_root_message_index, event_index));
    }

    pub fn iter(&self) -> impl Iterator<Item = (Option<MessageIndex>, EventIndex, TimestampMillis)> + '_ {
        self.by_timestamp.iter().rev().cloned().map(|(ts, r, e)| (r, e, ts))
    }

    pub fn last_updated(
        &self,
        thread_root_message_index: Option<MessageIndex>,
        event_index: EventIndex,
    ) -> Option<TimestampMillis> {
        self.by_event_index.get(&(thread_root_message_index, event_index)).copied()
    }

    pub fn latest_update_removed(&self) -> TimestampMillis {
        self.latest_update_removed
    }

    pub fn prune(&mut self, now: TimestampMillis) -> u32 {
        let cutoff = calculate_summary_updates_data_removal_cutoff(now);

        let still_valid = self.by_timestamp.split_off(&(cutoff, None, 0.into()));
        let removed = std::mem::replace(&mut self.by_timestamp, still_valid);
        let count_removed = removed.len() as u32;

        if let Some((ts, _, _)) = removed.last() {
            self.latest_update_removed = *ts;
        }
        for (_, tr, e) in removed {
            self.by_event_index.remove(&(tr, e));
        }
        count_removed
    }
}

#[derive(Deserialize)]
pub struct LastUpdatedTimestampsTrimmed {
    by_timestamp: BTreeSet<(TimestampMillis, Option<MessageIndex>, EventIndex)>,
    #[serde(default)]
    latest_update_removed: TimestampMillis,
}

impl From<LastUpdatedTimestampsTrimmed> for LastUpdatedTimestamps {
    fn from(value: LastUpdatedTimestampsTrimmed) -> Self {
        let mut by_event_index = BTreeMap::new();
        for (ts, tr, e) in value.by_timestamp.iter() {
            by_event_index.insert((*tr, *e), *ts);
        }

        LastUpdatedTimestamps {
            by_timestamp: value.by_timestamp,
            by_event_index,
            latest_update_removed: value.latest_update_removed,
        }
    }
}
