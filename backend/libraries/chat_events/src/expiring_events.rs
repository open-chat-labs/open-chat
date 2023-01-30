use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use types::{EventIndex, MessageIndex, RangeSet, TimestampMillis, Timestamped};

#[derive(Serialize, Deserialize, Default)]
pub struct ExpiringEvents {
    event_expiry_dates: BTreeMap<(TimestampMillis, EventIndex), ()>,
    // We don't remove message indexes from this map so that we can send expired message ranges
    // incrementally to the frontend
    message_expiry_dates: BTreeMap<(TimestampMillis, MessageIndex), ()>,
    expired_message_ranges: Timestamped<RangeSet<MessageIndex>>,
}

impl ExpiringEvents {
    pub fn insert(&mut self, event_index: EventIndex, message_index: Option<MessageIndex>, expires_at: TimestampMillis) {
        self.event_expiry_dates.insert((expires_at, event_index), ());

        message_index.map(|m| self.message_expiry_dates.insert((expires_at, m), ()));
    }

    pub fn expired_messages(&self, now: TimestampMillis) -> RangeSet<MessageIndex> {
        let mut ranges = self.expired_message_ranges.value.clone();
        for message_index in self.messages_expired_since(self.expired_message_ranges.timestamp, now) {
            ranges.insert(message_index);
        }
        ranges
    }

    pub fn expired_messages_since(&self, since: TimestampMillis, now: TimestampMillis) -> RangeSet<MessageIndex> {
        let mut ranges = RangeSet::default();
        for message_index in self.messages_expired_since(since, now) {
            ranges.insert(message_index);
        }
        ranges
    }

    pub fn next_message_expiry(&self, now: TimestampMillis) -> Option<TimestampMillis> {
        self.message_expiry_dates
            .range((now, MessageIndex::default())..)
            .next()
            .map(|((ts, _), _)| *ts)
    }

    pub fn process_expired_events(&mut self, now: TimestampMillis) -> Vec<EventIndex> {
        let mut expired_events = Vec::new();
        while let Some(next) = self.take_next_expired_event(now) {
            expired_events.push(next);
        }

        let last_updated = self.expired_message_ranges.timestamp;
        let expired_messages: Vec<_> = self.messages_expired_since(last_updated, now).collect();

        if !expired_messages.is_empty() {
            self.expired_message_ranges.update(
                |ranges| {
                    for message_index in expired_messages {
                        ranges.insert(message_index);
                    }
                },
                now,
            );
        }

        expired_events
    }

    fn take_next_expired_event(&mut self, now: TimestampMillis) -> Option<EventIndex> {
        self.event_expiry_dates
            .first_entry()
            .filter(|e| e.key().0 < now)
            .map(|e| e.remove_entry())
            .map(|((_, event_index), _)| event_index)
    }

    fn messages_expired_since(&self, since: TimestampMillis, now: TimestampMillis) -> impl Iterator<Item = MessageIndex> + '_ {
        self.message_expiry_dates
            .range((since, MessageIndex::default())..(now, MessageIndex::default()))
            .map(|((_, message_index), _)| *message_index)
    }
}
