use multi_user_canister::{MessageActivity, MessageActivityEvent, MessageActivitySummary};
use serde::{Deserialize, Serialize};
use stable_memory_map::{
    Entry, KeyPrefix, MessageActivityEventId, MessageActivityEventIdKeyPrefix, MessageActivityEventKey,
    MessageActivityEventKeyPrefix, StableMemoryMapInner, with_map, with_map_mut,
};
use std::collections::HashSet;
use std::ops::RangeInclusive;
use types::{Chat, EventIndex, MessageId, MessageIndex, TimestampMillis, UserId};

// The events in the user's message activity feed, of which no more than `MAX_EVENTS` are kept.
// They are stored in the stable memory map for small entries, keyed by timestamp, with a second
// entry per event keyed by the event's identity (chat, thread, message and activity type) which
// holds the event's timestamp, so that a new event for the same activity on the same message can
// find and replace the existing one.
#[derive(Serialize, Deserialize, Default)]
pub struct MessageActivityEvents {
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

    // The ids the events hold: the other users in the direct chats they are in, and the users who
    // caused them
    pub fn user_ids(&self) -> HashSet<UserId> {
        with_map(|m| {
            let mut user_ids = HashSet::new();
            for (_, bytes) in m.range(all_keys()) {
                let event = event_from_bytes(&bytes);
                if let Chat::Direct(chat_id) = event.chat {
                    user_ids.insert(chat_id.into());
                }
                user_ids.extend(event.user_id);
            }
            user_ids
        })
    }

    // Replaces the chat each event is in with `latest_chat` of it, and the user who caused it with
    // `latest_user_id` of them, so that events from before users were migrated to MultiUser
    // canisters hold their latest ids. The chat is part of an event's identity, so an event which
    // ends up with the same identity as another is only kept if it is the newer of the two, as when
    // one is pushed. Events keep their timestamps, so clients which already have them aren't sent
    // them again. Returns how many events were changed.
    pub fn migrate_user_ids(
        &mut self,
        latest_chat: impl Fn(Chat) -> Chat,
        latest_user_id: impl Fn(UserId) -> UserId,
        now: TimestampMillis,
    ) -> u32 {
        let to_update: Vec<_> = with_map(|m| {
            m.range(all_keys())
                .filter_map(|(key, bytes)| {
                    let event = event_from_bytes(&bytes);
                    let chat = latest_chat(event.chat);
                    let user_id = event.user_id.map(&latest_user_id);
                    (chat != event.chat || user_id != event.user_id).then(|| {
                        let updated = MessageActivityEvent {
                            chat,
                            user_id,
                            ..event.clone()
                        };
                        (key, event, updated)
                    })
                })
                .collect()
        });
        if to_update.is_empty() {
            return 0;
        }
        let count = to_update.len() as u32;
        let id_prefix = MessageActivityEventIdKeyPrefix::new();
        let prefix = MessageActivityEventKeyPrefix::new();

        with_map_mut(|m| {
            // Each event is removed before any is added back, so that none is taken for an event
            // with its new identity
            let mut updated_events = Vec::with_capacity(to_update.len());
            for (key, event, updated) in to_update {
                m.remove(key);
                m.remove(id_prefix.create_key(&event_id(&event)));
                self.in_stable_memory_count = self.in_stable_memory_count.saturating_sub(1);
                updated_events.push(updated);
            }
            for event in updated_events {
                let id = event_id(&event);
                let id_key = id_prefix.create_key(&id);
                if let Some(existing) = m.get(id_key.clone()).map(|bytes| timestamp_from_bytes(&bytes)) {
                    if existing >= event.timestamp {
                        continue;
                    }
                    m.remove(prefix.create_key(&(existing, id.clone())));
                    self.in_stable_memory_count = self.in_stable_memory_count.saturating_sub(1);
                }
                m.insert(id_key, event.timestamp.to_be_bytes().to_vec());
                m.insert(prefix.create_key(&(event.timestamp, id)), event_to_bytes(event));
                self.in_stable_memory_count += 1;
            }
        });

        self.last_updated = now;
        count
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
    fn ids_from_before_a_migration_are_replaced_keeping_the_newer_of_two_events_which_collide() {
        init_stable_memory_map();
        let mut events = MessageActivityEvents::default();
        let user = |i: u8| UserId::from(Principal::from_slice(&[i; 10]));
        let direct = |i: u8| Chat::Direct(user(i).into());
        let event = |chat: Chat, message_index: u32, timestamp: TimestampMillis, user_id: UserId| MessageActivityEvent {
            chat,
            user_id: Some(user_id),
            ..random_event(message_index, MessageActivity::Reaction, timestamp)
        };
        let group = Chat::Group(Principal::from_slice(&[1; 10]).into());
        let (old, new, other) = (1, 2, 3);
        // In the chat with the migrated user, under their old id
        events.push(event(direct(old), 1, 100, user(old)), 100);
        // Collides with the next, which is newer, once moved
        events.push(event(direct(old), 2, 110, user(old)), 110);
        events.push(event(direct(new), 2, 120, user(new)), 120);
        // Collides with the next, which is older, once moved
        events.push(event(direct(old), 3, 140, user(old)), 140);
        events.push(event(direct(new), 3, 130, user(new)), 130);
        // In a group, caused by the migrated user under their old id
        events.push(event(group, 4, 150, user(old)), 150);
        // Nothing to replace
        events.push(event(direct(other), 5, 160, user(other)), 160);
        assert_eq!(events.user_ids(), HashSet::from([user(old), user(new), user(other)]));

        let latest = |user_id: UserId| if user_id == user(old) { user(new) } else { user_id };
        let latest_chat = |chat: Chat| match chat {
            Chat::Direct(chat_id) => Chat::Direct(latest(chat_id.into()).into()),
            _ => chat,
        };
        assert_eq!(events.migrate_user_ids(latest_chat, latest, 200), 4);

        let held: Vec<_> = events
            .latest_events(0)
            .into_iter()
            .map(|e| (e.chat, u32::from(e.message_index), e.timestamp, e.user_id))
            .collect();
        assert_eq!(
            held,
            vec![
                (direct(other), 5, 160, Some(user(other))),
                (group, 4, 150, Some(user(new))),
                (direct(new), 3, 140, Some(user(new))),
                (direct(new), 2, 120, Some(user(new))),
                (direct(new), 1, 100, Some(user(new))),
            ]
        );
        assert_eq!(events.len(), 5);
        assert_eq!(events.last_updated(), 200);
        assert!(!events.user_ids().contains(&user(old)));

        // The id entries were kept in step, so a newer event for the same activity on the same
        // message replaces the one held
        events.push(event(direct(new), 3, 300, user(new)), 300);
        assert_eq!(events.len(), 5);
        assert_eq!(events.latest_events(0).len(), 5);
        assert_eq!(events.migrate_user_ids(latest_chat, latest, 400), 0);
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
