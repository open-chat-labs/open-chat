use crate::direct_chat_core::{DirectChatCore, Participant};
use crate::unread_message_index_map::UnreadMessageIndexMap;
use chat_events::{ChatEvents, EventPusher, PushMessageArgs, Reader};
use serde::{Deserialize, Serialize};
use types::{
    DirectChatSummary, DirectChatSummaryUpdates, EventWrapper, Message, MessageIndex, Milliseconds, OptionUpdate,
    TimestampMillis, Timestamped, UserId, UserType,
};

/// A direct chat as held by one of its users: their own state for the chat plus a core. The user
/// is the core's first participant and `them` the second.
#[derive(Serialize, Deserialize)]
#[serde(from = "DirectChatSerde")]
pub struct DirectChat {
    pub them: UserId,
    pub user_type: UserType,
    pub notifications_muted: Timestamped<bool>,
    pub archived: Timestamped<bool>,
    // Maps our message indexes onto theirs, which is only needed while each user's canister holds
    // its own copy of the chat with its own message indexes
    pub unread_message_index_map: UnreadMessageIndexMap,
    pub core: DirectChatCore,
}

impl DirectChat {
    pub fn new(
        my_user_id: UserId,
        them: UserId,
        user_type: UserType,
        key_id: u32,
        events_ttl: Option<Milliseconds>,
        anonymized_chat_id: u128,
        now: TimestampMillis,
    ) -> DirectChat {
        DirectChat {
            them,
            user_type,
            notifications_muted: Timestamped::new(false, now),
            archived: Timestamped::new(false, now),
            unread_message_index_map: UnreadMessageIndexMap::default(),
            core: DirectChatCore::new(my_user_id, them, key_id, events_ttl, anonymized_chat_id, now),
        }
    }

    pub fn has_updates_since(&self, since: TimestampMillis) -> bool {
        self.last_updated() > since
    }

    pub fn last_updated(&self) -> TimestampMillis {
        [
            self.core.last_updated(),
            self.notifications_muted.timestamp,
            self.archived.timestamp,
        ]
        .into_iter()
        .max()
        .unwrap()
    }

    // `their_message_index` is the index the message has in the other user's copy of the chat, if
    // it was sent by them
    pub fn push_message<P: EventPusher>(
        &mut self,
        args: PushMessageArgs,
        their_message_index: Option<MessageIndex>,
        event_pusher: Option<P>,
    ) -> EventWrapper<Message> {
        let sender = if args.sender != self.them { Participant::First } else { Participant::Second };
        let message_event = self.core.push_message(args, sender, event_pusher);

        if let Some(their_message_index) = their_message_index {
            self.unread_message_index_map.add(
                self.core.events.stable_memory_prefix(),
                message_event.event.message_index,
                their_message_index,
            );
        }

        message_event
    }

    pub fn mark_read_up_to(&mut self, message_index: MessageIndex, me: bool, now: TimestampMillis) -> bool {
        let participant = if me { Participant::First } else { Participant::Second };
        self.core.mark_read_up_to(participant, message_index, now)
    }

    pub fn read_by_me_up_to(&self) -> &Timestamped<Option<MessageIndex>> {
        self.core.read_up_to(Participant::First)
    }

    pub fn read_by_them_up_to(&self) -> &Timestamped<Option<MessageIndex>> {
        self.core.read_up_to(Participant::Second)
    }

    pub fn to_summary(&self, my_user_id: UserId) -> DirectChatSummary {
        let events = &self.core.events;
        let events_reader = events.main_events_reader();
        let events_ttl = events.get_events_time_to_live();

        DirectChatSummary {
            them: self.them,
            last_updated: self.last_updated(),
            latest_message: events_reader.latest_message_event(Some(my_user_id)),
            latest_event_index: events_reader.latest_event_index().unwrap_or_default(),
            latest_message_index: events_reader.latest_message_index(),
            date_created: self.core.date_created,
            read_by_me_up_to: self.read_by_me_up_to().value,
            read_by_them_up_to: self.read_by_them_up_to().value,
            notifications_muted: self.notifications_muted.value,
            metrics: events.metrics().hydrate(),
            my_metrics: events
                .user_metrics(&my_user_id, None)
                .map(|m| m.hydrate())
                .unwrap_or_default(),
            archived: self.archived.value,
            events_ttl: events_ttl.value,
            events_ttl_last_updated: events_ttl.timestamp,
            video_call_in_progress: events.video_call_in_progress(Some(my_user_id)),
        }
    }

    pub fn to_summary_updates(&self, updates_since: TimestampMillis, my_user_id: UserId) -> DirectChatSummaryUpdates {
        let events = &self.core.events;
        let events_reader = events.main_events_reader();

        let has_new_events = events_reader.latest_event_timestamp().is_some_and(|ts| ts > updates_since);
        let latest_message = events_reader.latest_message_event_if_updated(updates_since, Some(my_user_id));
        let latest_event_index = if has_new_events { events_reader.latest_event_index() } else { None };
        let latest_message_index = if has_new_events { events_reader.latest_message_index() } else { None };
        let notifications_muted = self.notifications_muted.if_set_after(updates_since).copied();
        let metrics = if has_new_events { Some(events.metrics().hydrate()) } else { None };
        let events_ttl = events.get_events_time_to_live();
        let updated_events: Vec<_> = events
            .recently_updated_events(updates_since, usize::MAX)
            .into_iter()
            .map(|(_, e, ts)| (e, ts))
            .collect();

        DirectChatSummaryUpdates {
            chat_id: self.them.into(),
            last_updated: self.last_updated(),
            latest_message,
            latest_event_index,
            latest_message_index,
            read_by_me_up_to: self.read_by_me_up_to().if_set_after(updates_since).copied().flatten(),
            read_by_them_up_to: self.read_by_them_up_to().if_set_after(updates_since).copied().flatten(),
            notifications_muted,
            updated_events,
            metrics,
            my_metrics: events.user_metrics(&my_user_id, Some(updates_since)).map(|m| m.hydrate()),
            archived: self.archived.if_set_after(updates_since).copied(),
            events_ttl: events_ttl
                .if_set_after(updates_since)
                .copied()
                .map_or(OptionUpdate::NoChange, OptionUpdate::from_update),
            events_ttl_last_updated: (events_ttl.timestamp > updates_since).then_some(events_ttl.timestamp),
            video_call_in_progress: events.video_call_in_progress_updates(Some(my_user_id), updates_since),
        }
    }
}

// Reads a `DirectChat` in either its current shape or the shape from before the core was split out,
// in which the core's fields sat directly on the chat.
// TODO: Remove the legacy fields after next release
#[derive(Deserialize)]
struct DirectChatSerde {
    them: UserId,
    user_type: UserType,
    notifications_muted: Timestamped<bool>,
    archived: Timestamped<bool>,
    unread_message_index_map: UnreadMessageIndexMap,
    #[serde(default)]
    core: Option<DirectChatCore>,
    #[serde(default)]
    date_created: Option<TimestampMillis>,
    #[serde(default)]
    events: Option<ChatEvents>,
    #[serde(default)]
    read_by_me_up_to: Option<Timestamped<Option<MessageIndex>>>,
    #[serde(default)]
    read_by_them_up_to: Option<Timestamped<Option<MessageIndex>>>,
}

impl From<DirectChatSerde> for DirectChat {
    fn from(value: DirectChatSerde) -> Self {
        let core = value.core.unwrap_or_else(|| {
            DirectChatCore::from_parts(
                value.date_created.expect("date_created"),
                value.events.expect("events"),
                value.read_by_me_up_to.expect("read_by_me_up_to"),
                value.read_by_them_up_to.expect("read_by_them_up_to"),
            )
        });

        DirectChat {
            them: value.them,
            user_type: value.user_type,
            notifications_muted: value.notifications_muted,
            archived: value.archived,
            unread_message_index_map: value.unread_message_index_map,
            core,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use candid::Principal;
    use chat_events::{MessageContentInternal, NullEventPusher, TextContentInternal};
    use ic_stable_structures::DefaultMemoryImpl;
    use ic_stable_structures::memory_manager::{MemoryId, MemoryManager};
    use types::MessageId;

    #[test]
    fn messages_are_read_by_their_sender_and_read_positions_are_kept_per_user() {
        init_stable_memory_map();
        let me = user(1);
        let them = user(2);
        let mut chat = DirectChat::new(me, them, UserType::User, 1, None, 123, 1);

        chat.push_message::<NullEventPusher>(message(me, 1, 100), None, None);
        assert_eq!(chat.read_by_me_up_to().value, Some(0.into()));
        assert_eq!(chat.read_by_them_up_to().value, None);

        chat.push_message::<NullEventPusher>(message(them, 2, 200), Some(7.into()), None);
        assert_eq!(chat.read_by_me_up_to().value, Some(0.into()));
        assert_eq!(chat.read_by_them_up_to().value, Some(1.into()));

        assert!(chat.mark_read_up_to(1.into(), true, 300));
        assert_eq!(chat.read_by_me_up_to().value, Some(1.into()));
        assert_eq!(chat.last_updated(), 300);

        // The message they sent had index 7 in their copy of the chat
        let events_prefix = chat.core.events.stable_memory_prefix();
        assert_eq!(
            chat.unread_message_index_map
                .get_max_read_up_to_of_theirs(events_prefix, &1.into()),
            Some(7.into())
        );

        let summary = chat.to_summary(me);
        assert_eq!(summary.them, them);
        assert_eq!(summary.read_by_me_up_to, Some(1.into()));
        assert_eq!(summary.read_by_them_up_to, Some(1.into()));
        assert_eq!(summary.latest_message_index, Some(1.into()));
        assert_eq!(summary.date_created, 1);
    }

    #[test]
    fn muting_or_archiving_counts_as_an_update() {
        init_stable_memory_map();
        let mut chat = DirectChat::new(user(1), user(2), UserType::User, 1, None, 123, 1);
        assert_eq!(chat.last_updated(), 1);

        chat.archived = Timestamped::new(true, 50);
        assert!(chat.has_updates_since(49));
        assert!(!chat.has_updates_since(50));

        chat.notifications_muted = Timestamped::new(true, 80);
        assert_eq!(chat.last_updated(), 80);
        assert_eq!(chat.to_summary_updates(60, user(1)).notifications_muted, Some(true));
        assert_eq!(chat.to_summary_updates(60, user(1)).archived, None);
    }

    #[test]
    fn chats_serialized_before_the_core_was_split_out_are_deserialized() {
        init_stable_memory_map();
        let me = user(1);
        let them = user(2);
        let mut chat = DirectChat::new(me, them, UserType::Bot, 1, None, 123, 1);
        chat.push_message::<NullEventPusher>(message(them, 1, 100), None, None);
        chat.mark_read_up_to(0.into(), true, 150);
        chat.notifications_muted = Timestamped::new(true, 200);

        // The shape `DirectChat` was serialized in with the core's fields directly on the chat
        #[derive(Serialize)]
        struct LegacyDirectChat<'a> {
            them: UserId,
            date_created: TimestampMillis,
            events: &'a ChatEvents,
            unread_message_index_map: &'a UnreadMessageIndexMap,
            read_by_me_up_to: &'a Timestamped<Option<MessageIndex>>,
            read_by_them_up_to: &'a Timestamped<Option<MessageIndex>>,
            notifications_muted: &'a Timestamped<bool>,
            archived: &'a Timestamped<bool>,
            user_type: UserType,
        }

        let legacy = LegacyDirectChat {
            them,
            date_created: chat.core.date_created,
            events: &chat.core.events,
            unread_message_index_map: &chat.unread_message_index_map,
            read_by_me_up_to: chat.read_by_me_up_to(),
            read_by_them_up_to: chat.read_by_them_up_to(),
            notifications_muted: &chat.notifications_muted,
            archived: &chat.archived,
            user_type: UserType::Bot,
        };

        let from_legacy: DirectChat = msgpack::deserialize_then_unwrap(&msgpack::serialize_then_unwrap(&legacy));
        let round_tripped: DirectChat = msgpack::deserialize_then_unwrap(&msgpack::serialize_then_unwrap(&chat));

        for deserialized in [from_legacy, round_tripped] {
            assert_eq!(deserialized.them, them);
            assert_eq!(deserialized.user_type, UserType::Bot);
            assert_eq!(deserialized.notifications_muted, chat.notifications_muted);
            assert_eq!(deserialized.archived, chat.archived);
            assert_eq!(deserialized.core.date_created, 1);
            assert_eq!(deserialized.read_by_me_up_to(), chat.read_by_me_up_to());
            assert_eq!(deserialized.read_by_them_up_to(), chat.read_by_them_up_to());
            assert_eq!(deserialized.last_updated(), chat.last_updated());
            assert_eq!(
                deserialized.core.events.main_events_reader().latest_message_index(),
                Some(0.into())
            );
        }
    }

    fn message(sender: UserId, message_id: u128, now: TimestampMillis) -> PushMessageArgs {
        PushMessageArgs {
            sender,
            thread_root_message_index: None,
            message_id: MessageId::from(message_id),
            content: MessageContentInternal::Text(TextContentInternal {
                text: "hello".to_string(),
            }),
            sender_context: None,
            mentioned: Vec::new(),
            replies_to: None,
            forwarded: false,
            sender_is_bot: false,
            block_level_markdown: false,
            og_previews: Vec::new(),
            now,
        }
    }

    fn user(i: u8) -> UserId {
        Principal::from_slice(&[i; 10]).into()
    }

    fn init_stable_memory_map() {
        let memory = MemoryManager::init(DefaultMemoryImpl::default());
        stable_memory_map::init_with_small_entries_map(memory.get(MemoryId::new(1)), memory.get(MemoryId::new(2)));
    }
}
