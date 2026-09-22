use serde::{Deserialize, Serialize};
use stable_memory_map::{
    Entry, KeyPrefix, MessageActivityEventId, MessageActivityEventIdKeyPrefix, MessageActivityEventKey,
    MessageActivityEventKeyPrefix, StableMemoryMapInner, with_map, with_map_mut,
};
use std::collections::VecDeque;
use std::ops::RangeInclusive;
use types::{Chat, EventIndex, MessageId, MessageIndex, TimestampMillis, UserId};
use user_canister::{MessageActivity, MessageActivityEvent, MessageActivitySummary};

// The events in the user's message activity feed, of which no more than `MAX_EVENTS` are kept.
// They are stored in the stable memory map for small entries, keyed by timestamp, with a second
// entry per event keyed by the event's identity (chat, thread, message and activity type) which
// holds the event's timestamp, so that a new event for the same activity on the same message can
// find and replace the existing one.
#[derive(Serialize, Deserialize, Default)]
pub struct MessageActivityEvents {
    // The events which were held on the heap, which are all moved into stable memory in
    // `post_upgrade` by `migrate_to_stable_memory`, so this is always empty otherwise.
    // TODO: Remove this after next release
    #[serde(rename = "events", default, skip_serializing)]
    on_heap: VecDeque<MessageActivityEvent>,
    #[serde(default)]
    in_stable_memory_count: u32,
    read_up_to: TimestampMillis,
    last_updated: TimestampMillis,
}

impl MessageActivityEvents {
    const MAX_EVENTS: u32 = 1000;

    pub fn push(&mut self, event: MessageActivityEvent, now: TimestampMillis) {
        let id = event_id(&event);
        let id_key = MessageActivityEventIdKeyPrefix::new().create_key(&id);
        let prefix = MessageActivityEventKeyPrefix::new();

        with_map_mut(|m| {
            let timestamp_bytes = event.timestamp.to_be_bytes().to_vec();
            let previous_timestamp = match m.entry(id_key) {
                Entry::Occupied(e) => Some(timestamp_from_bytes(&e.insert(timestamp_bytes).into_value())),
                Entry::Vacant(e) => {
                    e.insert(timestamp_bytes);
                    None
                }
            };

            if let Some(previous_timestamp) = previous_timestamp {
                // Remove the existing event for the same activity on the same message
                m.remove(prefix.create_key(&(previous_timestamp, id.clone())));
                self.in_stable_memory_count -= 1;
            } else if self.in_stable_memory_count >= MessageActivityEvents::MAX_EVENTS {
                // Keep no more than MAX_EVENTS. The oldest event can't be for the same activity on
                // the same message, since there is no existing event for that.
                self.remove_oldest(m);
            }

            m.insert(prefix.create_key(&(event.timestamp, id)), event_to_bytes(event));
            self.in_stable_memory_count += 1;
        });

        self.last_updated = now;
    }

    pub fn mark_read_up_to(&mut self, read_up_to: TimestampMillis, now: TimestampMillis) {
        self.read_up_to = read_up_to;
        self.last_updated = now;
    }

    pub fn summary(&self) -> MessageActivitySummary {
        with_map(|m| MessageActivitySummary {
            read_up_to: self.read_up_to,
            unread_count: m.range(keys_after(self.read_up_to)).count() as u32,
            latest_event_timestamp: m.range(all_keys()).next_back().map_or(0, |(k, _)| k.timestamp()),
        })
    }

    // Returns the events newer than `since`, ordered by timestamp descending
    pub fn latest_events(&self, since: TimestampMillis) -> Vec<MessageActivityEvent> {
        with_map(|m| m.range(keys_after(since)).rev().map(|(_, v)| event_from_bytes(&v)).collect())
    }

    pub fn len(&self) -> u32 {
        self.in_stable_memory_count
    }

    pub fn is_empty(&self) -> bool {
        self.in_stable_memory_count == 0
    }

    pub fn last_updated(&self) -> TimestampMillis {
        self.last_updated
    }

    // Moves the events which were held on the heap into stable memory, returning how many were
    // moved. There are at most `MAX_EVENTS` of them, so they are all moved at once.
    // TODO: Remove this after next release
    pub fn migrate_to_stable_memory(&mut self) -> usize {
        if self.on_heap.is_empty() {
            return 0;
        }

        let prefix = MessageActivityEventKeyPrefix::new();
        let id_prefix = MessageActivityEventIdKeyPrefix::new();
        let mut events = Vec::with_capacity(self.on_heap.len());
        let mut id_entries = Vec::with_capacity(self.on_heap.len());

        // The events on the heap are ordered by timestamp descending, so taking them oldest first
        // puts their timestamp keys in key order
        for event in std::mem::take(&mut self.on_heap).into_iter().rev() {
            let id = event_id(&event);
            id_entries.push((id_prefix.create_key(&id), event.timestamp.to_be_bytes().to_vec()));
            events.push((prefix.create_key(&(event.timestamp, id)), event_to_bytes(event)));
        }
        id_entries.sort_unstable_by(|(a, _), (b, _)| a.cmp(b));

        let count = events.len();
        with_map_mut(|m| {
            m.insert_many(events);
            m.insert_many(id_entries);
        });
        self.in_stable_memory_count += count as u32;
        count
    }

    fn remove_oldest(&mut self, m: &mut StableMemoryMapInner) {
        let Some((key, bytes)) = m.range(all_keys()).next() else {
            return;
        };
        m.remove(key);
        m.remove(MessageActivityEventIdKeyPrefix::new().create_key(&event_id(&event_from_bytes(&bytes))));
        self.in_stable_memory_count -= 1;
    }
}

// The keys of the events with timestamps greater than `since`
fn keys_after(since: TimestampMillis) -> RangeInclusive<MessageActivityEventKey> {
    let prefix = MessageActivityEventKeyPrefix::new();
    prefix.timestamp_bound(since.saturating_add(1))..=prefix.timestamp_bound(TimestampMillis::MAX)
}

fn all_keys() -> RangeInclusive<MessageActivityEventKey> {
    let prefix = MessageActivityEventKeyPrefix::new();
    prefix.timestamp_bound(0)..=prefix.timestamp_bound(TimestampMillis::MAX)
}

fn event_id(event: &MessageActivityEvent) -> MessageActivityEventId {
    MessageActivityEventId {
        chat: event.chat,
        thread_root_message_index: event.thread_root_message_index,
        message_index: event.message_index,
        activity: activity_to_u8(event.activity),
    }
}

// These values are stored in stable memory so must never change
fn activity_to_u8(activity: MessageActivity) -> u8 {
    match activity {
        MessageActivity::Mention => 1,
        MessageActivity::Reaction => 2,
        MessageActivity::QuoteReply => 3,
        MessageActivity::Tip => 4,
        MessageActivity::Crypto => 5,
        MessageActivity::PollVote => 6,
        MessageActivity::P2PSwapAccepted => 7,
    }
}

fn timestamp_from_bytes(bytes: &[u8]) -> TimestampMillis {
    u64::from_be_bytes(bytes.try_into().unwrap())
}

fn event_to_bytes(event: MessageActivityEvent) -> Vec<u8> {
    msgpack::serialize_then_unwrap(MessageActivityEventValue::from(event))
}

fn event_from_bytes(bytes: &[u8]) -> MessageActivityEvent {
    msgpack::deserialize_then_unwrap::<MessageActivityEventValue>(bytes).into()
}

// The form in which events are stored in stable memory
#[derive(Serialize, Deserialize)]
struct MessageActivityEventValue {
    #[serde(rename = "c")]
    chat: Chat,
    #[serde(rename = "t", default, skip_serializing_if = "Option::is_none")]
    thread_root_message_index: Option<MessageIndex>,
    #[serde(rename = "i")]
    message_index: MessageIndex,
    #[serde(rename = "m")]
    message_id: MessageId,
    #[serde(rename = "e")]
    event_index: EventIndex,
    #[serde(rename = "a")]
    activity: MessageActivity,
    #[serde(rename = "ts")]
    timestamp: TimestampMillis,
    #[serde(rename = "u", default, skip_serializing_if = "Option::is_none")]
    user_id: Option<UserId>,
}

impl From<MessageActivityEvent> for MessageActivityEventValue {
    fn from(event: MessageActivityEvent) -> Self {
        MessageActivityEventValue {
            chat: event.chat,
            thread_root_message_index: event.thread_root_message_index,
            message_index: event.message_index,
            message_id: event.message_id,
            event_index: event.event_index,
            activity: event.activity,
            timestamp: event.timestamp,
            user_id: event.user_id,
        }
    }
}

impl From<MessageActivityEventValue> for MessageActivityEvent {
    fn from(value: MessageActivityEventValue) -> Self {
        MessageActivityEvent {
            chat: value.chat,
            thread_root_message_index: value.thread_root_message_index,
            message_index: value.message_index,
            message_id: value.message_id,
            event_index: value.event_index,
            activity: value.activity,
            timestamp: value.timestamp,
            user_id: value.user_id,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use candid::Principal;
    use ic_stable_structures::DefaultMemoryImpl;
    use ic_stable_structures::memory_manager::{MemoryId, MemoryManager};
    use rand::{Rng, rng};
    use std::collections::VecDeque;

    #[test]
    fn events_are_returned_newest_first() {
        init_stable_memory_map();
        let mut events = MessageActivityEvents::default();

        for i in 1..=50u32 {
            let timestamp = 1000 + (rng().next_u64() % 1000);
            events.push(random_event(i, MessageActivity::Reaction, timestamp), timestamp);
        }

        assert_eq!(events.len(), 50);
        let latest = events.latest_events(0);
        assert_eq!(latest.len(), 50);
        assert!(latest.windows(2).all(|w| w[0].timestamp >= w[1].timestamp));

        let since = 1500;
        let expected = latest.iter().filter(|e| e.timestamp > since).count();
        assert_eq!(events.latest_events(since).len(), expected);

        let summary = events.summary();
        assert_eq!(summary.unread_count, 50);
        assert_eq!(summary.latest_event_timestamp, latest[0].timestamp);
    }

    #[test]
    fn matching_event_replaces_existing_one() {
        init_stable_memory_map();
        let mut events = MessageActivityEvents::default();

        events.push(random_event(1, MessageActivity::Reaction, 100), 100);
        events.push(random_event(1, MessageActivity::Tip, 200), 200);
        // A second reaction to the same message replaces the first
        events.push(random_event(1, MessageActivity::Reaction, 300), 300);

        assert_eq!(events.len(), 2);
        let latest = events.latest_events(0);
        assert_eq!(latest.len(), 2);
        assert_eq!(latest[0].activity, MessageActivity::Reaction);
        assert_eq!(latest[0].timestamp, 300);
        assert_eq!(latest[1].activity, MessageActivity::Tip);
        assert_eq!(latest[1].timestamp, 200);
    }

    #[test]
    fn oldest_event_removed_once_max_events_reached() {
        init_stable_memory_map();
        let mut events = MessageActivityEvents::default();
        let max = MessageActivityEvents::MAX_EVENTS;

        for i in 1..=max + 10 {
            events.push(random_event(i, MessageActivity::Mention, i as u64), i as u64);
        }

        assert_eq!(events.len(), max);
        let latest = events.latest_events(0);
        assert_eq!(latest.len(), max as usize);
        assert_eq!(latest[0].timestamp, (max + 10) as u64);
        assert_eq!(latest[max as usize - 1].timestamp, 11);
        assert_eq!(events.latest_events(10).len(), max as usize);
        assert_eq!(events.summary().unread_count, max);

        // The removed events' id entries must have been removed too, so that they don't count as
        // replacements
        events.push(random_event(1, MessageActivity::Mention, 5000), 5000);
        assert_eq!(events.len(), max);
        assert_eq!(events.latest_events(0).len(), max as usize);
    }

    #[test]
    fn summary_reflects_read_up_to() {
        init_stable_memory_map();
        let mut events = MessageActivityEvents::default();

        for i in 1..=20u32 {
            events.push(random_event(i, MessageActivity::QuoteReply, i as u64 * 10), i as u64 * 10);
        }
        events.mark_read_up_to(150, 300);

        let summary = events.summary();
        assert_eq!(summary.read_up_to, 150);
        assert_eq!(summary.unread_count, 5);
        assert_eq!(summary.latest_event_timestamp, 200);
        assert_eq!(events.last_updated(), 300);
    }

    #[test]
    fn events_on_heap_are_migrated_to_stable_memory() {
        init_stable_memory_map();
        let mut on_heap = VecDeque::new();
        for i in 1..=100u32 {
            on_heap.push_front(random_event(i, MessageActivity::Reaction, i as u64));
        }
        let mut events = MessageActivityEvents {
            on_heap,
            in_stable_memory_count: 0,
            read_up_to: 50,
            last_updated: 100,
        };

        assert_eq!(events.migrate_to_stable_memory(), 100);
        assert!(events.on_heap.is_empty());
        assert_eq!(events.migrate_to_stable_memory(), 0);

        assert_eq!(events.len(), 100);
        let latest = events.latest_events(0);
        assert_eq!(latest.len(), 100);
        assert!(latest.windows(2).all(|w| w[0].timestamp > w[1].timestamp));
        assert_eq!(latest[0].timestamp, 100);
        let summary = events.summary();
        assert_eq!(summary.unread_count, 50);
        assert_eq!(summary.latest_event_timestamp, 100);

        // The migrated events' id entries are in place, so a matching event replaces the existing one
        events.push(random_event(20, MessageActivity::Reaction, 200), 200);
        assert_eq!(events.len(), 100);
        let latest = events.latest_events(0);
        assert_eq!(latest.len(), 100);
        assert_eq!(latest[0].timestamp, 200);
        assert!(!latest.iter().any(|e| e.timestamp == 20));

        // The heap isn't serialized
        let deserialized: MessageActivityEvents = msgpack::deserialize_then_unwrap(&msgpack::serialize_then_unwrap(&events));
        assert_eq!(deserialized.len(), 100);
    }

    fn random_event(message_index: u32, activity: MessageActivity, timestamp: TimestampMillis) -> MessageActivityEvent {
        MessageActivityEvent {
            chat: Chat::Group(Principal::from_slice(&[1; 10]).into()),
            thread_root_message_index: None,
            message_index: message_index.into(),
            message_id: rng().next_u64().into(),
            event_index: (message_index + 5).into(),
            activity,
            timestamp,
            user_id: Some(Principal::from_slice(&[2; 10]).into()),
        }
    }

    fn init_stable_memory_map() {
        let memory = MemoryManager::init(DefaultMemoryImpl::default());
        stable_memory_map::init_with_small_entries_map(memory.get(MemoryId::new(1)), memory.get(MemoryId::new(2)));
    }
}
